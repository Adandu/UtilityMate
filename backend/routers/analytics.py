from collections import defaultdict
from datetime import date, datetime, timezone
import os
from typing import Dict, Iterable, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database.session import SQLALCHEMY_DATABASE_URL, get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.domain_logic import build_forecast, compute_budget_statuses, generate_invoice_alerts

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def read_version() -> str:
    candidate = os.path.join(BASE_DIR, "VERSION")
    if os.path.exists(candidate):
        with open(candidate, "r", encoding="utf-8") as version_file:
            return version_file.read().strip()
    return os.getenv("APP_VERSION", "unknown")


def read_release_notes() -> str:
    candidate = os.path.join(BASE_DIR, "RELEASE_NOTES.md")
    if os.path.exists(candidate):
        with open(candidate, "r", encoding="utf-8") as notes_file:
            return notes_file.read().strip()
    return "Release notes are not available."


def month_start(day: date) -> date:
    return day.replace(day=1)


def shift_months(day: date, months: int) -> date:
    year = day.year + ((day.month - 1 + months) // 12)
    month = ((day.month - 1 + months) % 12) + 1
    return date(year, month, 1)


def enumerate_months(start: date, end: date) -> List[date]:
    months: List[date] = []
    cursor = month_start(start)
    limit = month_start(end)
    while cursor <= limit:
        months.append(cursor)
        cursor = shift_months(cursor, 1)
    return months


def resolve_period(
    invoices: List[database_models.Invoice],
    period_key: str,
    custom_start: Optional[date],
    custom_end: Optional[date],
) -> Tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    current_month = month_start(today)

    if period_key == "custom":
        if not custom_start or not custom_end:
            raise HTTPException(status_code=400, detail="Custom period requires start_date and end_date")
        if custom_start > custom_end:
            raise HTTPException(status_code=400, detail="Custom start_date must be on or before end_date")
        return custom_start, custom_end

    if period_key == "last_3_months":
        return shift_months(current_month, -2), today
    if period_key == "last_6_months":
        return shift_months(current_month, -5), today
    if period_key == "last_1_year":
        return shift_months(current_month, -11), today
    if period_key == "all_time":
        if invoices:
            return min(inv.invoice_date for inv in invoices), max(inv.invoice_date for inv in invoices)
        return current_month, today

    raise HTTPException(status_code=400, detail="Unsupported period key")


def build_summary(db: Session, current_user: database_models.User):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.user_id == current_user.id
    ).all()
    alerts = db.query(database_models.Alert).filter(
        database_models.Alert.user_id == current_user.id,
        database_models.Alert.is_read == False,
    ).count()
    today = datetime.now(timezone.utc).date()
    overdue = [inv for inv in invoices if inv.status != "paid" and inv.due_date and inv.due_date < today]
    total = sum(inv.amount for inv in invoices)
    unpaid_total = sum(inv.amount for inv in invoices if inv.status != "paid")
    months = max(1, len({inv.invoice_date.strftime("%Y-%m") for inv in invoices}) if invoices else 1)
    return api_schemas.AnalyticsSummary(
        total_spend=round(total, 2),
        invoice_count=len(invoices),
        overdue_invoices=len(overdue),
        needs_review_count=len([inv for inv in invoices if inv.needs_review]),
        active_alerts=alerts,
        unpaid_total=round(unpaid_total, 2),
        avg_monthly_spend=round(total / months, 2),
    )


def build_monthly_series(
    monthly_data: Dict[str, Dict[str, float]],
    month_labels: Iterable[date],
    forecast_lookup: Dict[Tuple[int, int], float],
) -> List[api_schemas.DashboardSeriesPoint]:
    series: List[api_schemas.DashboardSeriesPoint] = []
    for bucket in month_labels:
        key = bucket.strftime("%Y-%m")
        cost = monthly_data[key]["cost"]
        consumption = monthly_data[key]["consumption"]
        unit_cost = round(cost / consumption, 4) if consumption > 0 else None
        history = forecast_lookup.get((bucket.year, bucket.month))
        forecast_cost = round(history, 2) if history is not None else None
        series.append(api_schemas.DashboardSeriesPoint(
            label=key,
            cost=round(cost, 2),
            consumption=round(consumption, 3),
            unit_cost=unit_cost,
            forecast_cost=forecast_cost,
        ))
    return series


def build_forecast_lookup(invoices: List[database_models.Invoice]) -> Dict[Tuple[int, int], float]:
    grouped_costs: Dict[int, Dict[int, List[float]]] = defaultdict(lambda: defaultdict(list))
    for invoice in invoices:
        grouped_costs[invoice.invoice_date.month][invoice.invoice_date.year].append(invoice.amount)

    forecast_lookup: Dict[Tuple[int, int], float] = {}
    years = sorted({invoice.invoice_date.year for invoice in invoices})
    months = sorted({invoice.invoice_date.month for invoice in invoices})
    for year in years:
        for month in months:
            history_years = [prior for prior in years if prior < year and grouped_costs[month].get(prior)]
            if not history_years:
                continue
            history_values = [
                sum(grouped_costs[month][prior]) / len(grouped_costs[month][prior])
                for prior in history_years
            ]
            forecast_lookup[(year, month)] = sum(history_values) / len(history_values)
    return forecast_lookup


def compute_previous_period_cost(
    invoices: List[database_models.Invoice],
    start_date: date,
    end_date: date,
) -> float:
    month_count = max(1, len(enumerate_months(start_date, end_date)))
    previous_start = shift_months(month_start(start_date), -month_count)
    previous_end = shift_months(month_start(start_date), 0)
    total = sum(
        invoice.amount
        for invoice in invoices
        if previous_start <= invoice.invoice_date < previous_end
    )
    return round(total, 2)


def invoice_base_query(db: Session, current_user: database_models.User):
    return db.query(database_models.Invoice).options(
        joinedload(database_models.Invoice.provider).joinedload(database_models.Provider.category),
        joinedload(database_models.Invoice.location),
    ).filter(database_models.Invoice.user_id == current_user.id)


@router.get("/summary", response_model=api_schemas.AnalyticsSummary)
def analytics_summary(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    compute_budget_statuses(db, current_user)
    generate_invoice_alerts(db, current_user)
    db.commit()
    return build_summary(db, current_user)


@router.get("/report", response_model=api_schemas.ReportBundle)
def analytics_report(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    budget_statuses = compute_budget_statuses(db, current_user)
    generate_invoice_alerts(db, current_user)
    db.commit()
    alerts = db.query(database_models.Alert).filter(
        database_models.Alert.user_id == current_user.id
    ).order_by(database_models.Alert.created_at.desc()).limit(10).all()
    return api_schemas.ReportBundle(
        summary=build_summary(db, current_user),
        budget_statuses=budget_statuses,
        alerts=alerts,
        forecast=build_forecast(db, current_user),
    )


@router.get("/about", response_model=api_schemas.AboutResponse)
def about(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    allowed_origins = [origin.strip() for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost,http://127.0.0.1,http://localhost:5173",
    ).split(",") if origin.strip()]
    stats = api_schemas.AppStats(
        invoices=db.query(database_models.Invoice).filter(database_models.Invoice.user_id == current_user.id).count(),
        locations=db.query(database_models.Location).filter(database_models.Location.user_id == current_user.id).count(),
        providers=db.query(database_models.Provider).filter(
            or_(database_models.Provider.user_id == None, database_models.Provider.user_id == current_user.id)
        ).count(),
        categories=db.query(database_models.Category).filter(
            or_(database_models.Category.user_id == None, database_models.Category.user_id == current_user.id)
        ).count(),
        households=db.query(database_models.Household).filter(database_models.Household.owner_user_id == current_user.id).count(),
        manual_meter_readings=db.query(database_models.ConsumptionIndex).filter(
            database_models.ConsumptionIndex.user_id == current_user.id,
            database_models.ConsumptionIndex.source_type == "manual",
        ).count(),
        unread_alerts=db.query(database_models.Alert).filter(
            database_models.Alert.user_id == current_user.id,
            database_models.Alert.is_read == False,
        ).count(),
    )
    environment = api_schemas.AppEnvironmentInfo(
        api_version=read_version(),
        database_dialect=SQLALCHEMY_DATABASE_URL.split(":", 1)[0],
        upload_dir=os.getenv("UPLOAD_DIR", "data/invoices"),
        app_env=os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "production")),
        allowed_origins=allowed_origins,
        server_time_utc=datetime.now(timezone.utc),
    )
    return api_schemas.AboutResponse(
        version=environment.api_version,
        release_notes_markdown=read_release_notes(),
        stats=stats,
        environment=environment,
    )


@router.get("/dashboard", response_model=api_schemas.DashboardAnalyticsResponse)
def dashboard_analytics(
    period: str = Query("last_6_months"),
    location_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    locations = db.query(database_models.Location).filter(
        database_models.Location.user_id == current_user.id
    ).order_by(database_models.Location.name.asc()).all()

    if location_id is not None and not any(location.id == location_id for location in locations):
        raise HTTPException(status_code=404, detail="Location not found")

    all_invoices = invoice_base_query(db, current_user).order_by(database_models.Invoice.invoice_date.asc()).all()
    selected_invoices = [
        invoice for invoice in all_invoices
        if location_id is None or invoice.location_id == location_id
    ]
    resolved_start, resolved_end = resolve_period(selected_invoices, period, start_date, end_date)
    month_labels = enumerate_months(resolved_start, resolved_end)

    filtered_invoices = [
        invoice for invoice in selected_invoices
        if resolved_start <= invoice.invoice_date <= resolved_end
    ]
    comparison_invoices = [
        invoice for invoice in all_invoices
        if resolved_start <= invoice.invoice_date <= resolved_end
    ]

    overall_monthly: Dict[str, Dict[str, float]] = defaultdict(lambda: {"cost": 0.0, "consumption": 0.0})
    category_monthly: Dict[int, Dict[str, Dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"cost": 0.0, "consumption": 0.0}))
    category_meta: Dict[int, Tuple[str, str]] = {}

    for invoice in filtered_invoices:
        bucket = invoice.invoice_date.strftime("%Y-%m")
        overall_monthly[bucket]["cost"] += invoice.amount
        overall_monthly[bucket]["consumption"] += invoice.consumption_value or 0.0
        if invoice.provider and invoice.provider.category:
            category = invoice.provider.category
            category_meta[category.id] = (category.name, category.unit)
            category_monthly[category.id][bucket]["cost"] += invoice.amount
            category_monthly[category.id][bucket]["consumption"] += invoice.consumption_value or 0.0

    overall_forecast_lookup = build_forecast_lookup(selected_invoices)
    overall_cost_series = build_monthly_series(overall_monthly, month_labels, overall_forecast_lookup)

    comparison_rollups: Dict[int, Dict[int, Dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"cost": 0.0, "consumption": 0.0}))
    for invoice in comparison_invoices:
        if invoice.provider and invoice.provider.category:
            category_id = invoice.provider.category.id
            comparison_rollups[category_id][invoice.location_id]["cost"] += invoice.amount
            comparison_rollups[category_id][invoice.location_id]["consumption"] += invoice.consumption_value or 0.0

    category_sections: List[api_schemas.DashboardCategorySection] = []
    for category_id, monthly in sorted(category_monthly.items(), key=lambda item: category_meta[item[0]][0].lower()):
        name, unit = category_meta[category_id]
        category_invoices = [
            invoice for invoice in selected_invoices
            if invoice.provider and invoice.provider.category and invoice.provider.category.id == category_id
        ]
        forecast_lookup = build_forecast_lookup(category_invoices)
        monthly_series = build_monthly_series(monthly, month_labels, forecast_lookup)
        total_cost = sum(point.cost for point in monthly_series)
        total_consumption = sum(point.consumption for point in monthly_series)
        avg_unit_cost = round(total_cost / total_consumption, 4) if total_consumption > 0 else None

        location_comparison: List[api_schemas.LocationComparisonPoint] = []
        for location in locations:
            location_totals = comparison_rollups[category_id][location.id]
            unit_cost = (
                round(location_totals["cost"] / location_totals["consumption"], 4)
                if location_totals["consumption"] > 0 else None
            )
            location_comparison.append(api_schemas.LocationComparisonPoint(
                location_id=location.id,
                location_name=location.name,
                cost=round(location_totals["cost"], 2),
                consumption=round(location_totals["consumption"], 3),
                unit_cost=unit_cost,
            ))

        category_sections.append(api_schemas.DashboardCategorySection(
            category_id=category_id,
            category_name=name,
            unit=unit,
            total_cost=round(total_cost, 2),
            total_consumption=round(total_consumption, 3),
            avg_unit_cost=avg_unit_cost,
            monthly_series=monthly_series,
            location_comparison=location_comparison,
        ))

    total_cost = sum(invoice.amount for invoice in filtered_invoices)
    previous_period_cost = compute_previous_period_cost(selected_invoices, resolved_start, resolved_end)
    if previous_period_cost > 0:
        change_ratio = round((total_cost - previous_period_cost) / previous_period_cost, 4)
    elif total_cost > 0:
        change_ratio = 1.0
    else:
        change_ratio = 0.0

    summary = api_schemas.DashboardSummary(
        total_cost=round(total_cost, 2),
        avg_monthly_cost=round(total_cost / max(1, len(month_labels)), 2),
        previous_period_cost=previous_period_cost,
        change_ratio=change_ratio,
        active_categories=len(category_sections),
        months_covered=len(month_labels),
    )

    return api_schemas.DashboardAnalyticsResponse(
        summary=summary,
        available_locations=locations,
        selected_location_id=location_id,
        period_key=period,
        start_date=resolved_start,
        end_date=resolved_end,
        overall_cost_series=overall_cost_series,
        category_sections=category_sections,
    )
