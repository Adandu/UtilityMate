from collections import defaultdict
from datetime import date, datetime, timezone
from io import BytesIO
import os
from typing import Dict, Iterable, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database.session import SQLALCHEMY_DATABASE_URL, get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.domain_logic import build_forecast, compute_budget_statuses, generate_invoice_alerts

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CATEGORY_DISPLAY_ORDER = {
    "Energy": 0,
    "Gas": 1,
    "Cold Water": 2,
    "Hot Water": 3,
    "Shared Water": 4,
    "Heating": 5,
}


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
    dates: List[date],
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
        if dates:
            return min(dates), max(dates)
        return current_month, today

    raise HTTPException(status_code=400, detail="Unsupported period key")


def build_summary(db: Session, current_user: database_models.User):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.user_id == current_user.id
    ).all()
    statement_lines = db.query(database_models.AssociationStatementLine).join(
        database_models.AssociationStatement,
        database_models.AssociationStatementLine.statement_id == database_models.AssociationStatement.id,
    ).filter(
        database_models.AssociationStatementLine.user_id == current_user.id,
    ).all()
    statement_totals = build_statement_total_rows(statement_lines)
    alerts = db.query(database_models.Alert).filter(
        database_models.Alert.user_id == current_user.id,
        database_models.Alert.is_read == False,
    ).count()
    today = datetime.now(timezone.utc).date()
    overdue = [inv for inv in invoices if inv.status != "paid" and inv.due_date and inv.due_date < today]
    total = sum(inv.amount for inv in invoices) + sum(item.amount for item in statement_totals)
    unpaid_total = sum(inv.amount for inv in invoices if inv.status != "paid")
    month_keys = {inv.invoice_date.strftime("%Y-%m") for inv in invoices}
    month_keys.update(
        item.invoice_date.strftime("%Y-%m")
        for item in statement_totals
    )
    months = max(1, len(month_keys) if month_keys else 1)
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
    previous_year_lookup: Dict[Tuple[int, int], float],
    forecast_lookup: Dict[Tuple[int, int], float],
) -> List[api_schemas.DashboardSeriesPoint]:
    series: List[api_schemas.DashboardSeriesPoint] = []
    for bucket in month_labels:
        key = bucket.strftime("%Y-%m")
        cost = monthly_data[key]["cost"]
        consumption = monthly_data[key]["consumption"]
        unit_cost = round(cost / consumption, 4) if consumption > 0 else None
        previous_year_cost = previous_year_lookup.get((bucket.year, bucket.month))
        history = forecast_lookup.get((bucket.year, bucket.month))
        last_year_cost = round(previous_year_cost, 2) if previous_year_cost is not None else None
        forecast_cost = round(history, 2) if history is not None else None
        series.append(api_schemas.DashboardSeriesPoint(
            label=key,
            cost=round(cost, 2),
            consumption=round(consumption, 3),
            unit_cost=unit_cost,
            last_year_cost=last_year_cost,
            forecast_cost=forecast_cost,
        ))
    return series


def build_history_lookups(
    invoices: List[database_models.Invoice],
) -> Tuple[Dict[Tuple[int, int], float], Dict[Tuple[int, int], float]]:
    grouped_costs: Dict[int, Dict[int, List[float]]] = defaultdict(lambda: defaultdict(list))
    for invoice in invoices:
        grouped_costs[invoice.invoice_date.month][invoice.invoice_date.year].append(invoice.amount)

    previous_year_lookup: Dict[Tuple[int, int], float] = {}
    forecast_lookup: Dict[Tuple[int, int], float] = {}
    years = sorted({invoice.invoice_date.year for invoice in invoices})
    months = sorted({invoice.invoice_date.month for invoice in invoices})
    for year in years:
        for month in months:
            if grouped_costs[month].get(year - 1):
                previous_year_lookup[(year, month)] = sum(grouped_costs[month][year - 1])
            history_years = [prior for prior in years if prior < year and grouped_costs[month].get(prior)]
            if not history_years:
                continue
            history_values = [
                sum(grouped_costs[month][prior])
                for prior in history_years
            ]
            forecast_lookup[(year, month)] = sum(history_values) / len(history_values)
    return previous_year_lookup, forecast_lookup


def build_statement_total_rows(
    lines: List[database_models.AssociationStatementLine],
) -> List[database_models.Invoice]:
    grouped: Dict[Tuple[int, int], Dict[str, Optional[float] | date]] = {}
    for line in lines:
        if not line.statement or not line.statement.statement_month:
            continue
        key = (line.statement_id, line.location_id)
        if key not in grouped:
            grouped[key] = {
                "invoice_date": line.statement.statement_month,
                "location_id": line.location_id,
                "summary_amount": None,
                "detail_amount": 0.0,
            }
        if line.line_kind == "statement_total":
            grouped[key]["summary_amount"] = line.amount
        elif line.include_in_overall_analytics:
            grouped[key]["detail_amount"] = float(grouped[key]["detail_amount"] or 0.0) + line.amount

    synthetic_rows: List[database_models.Invoice] = []
    for row in grouped.values():
        amount = row["summary_amount"]
        if amount is None:
            amount = row["detail_amount"]
        synthetic_rows.append(type("SyntheticInvoice", (), {
            "invoice_date": row["invoice_date"],
            "location_id": row["location_id"],
            "amount": amount or 0.0,
        })())
    return synthetic_rows


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


def statement_line_query(db: Session, current_user: database_models.User):
    return db.query(database_models.AssociationStatementLine).options(
        joinedload(database_models.AssociationStatementLine.statement),
        joinedload(database_models.AssociationStatementLine.location),
        joinedload(database_models.AssociationStatementLine.category),
    ).filter(database_models.AssociationStatementLine.user_id == current_user.id)


def build_dashboard_payload(
    db: Session,
    current_user: database_models.User,
    period: str,
    location_id: Optional[int],
    start_date: Optional[date],
    end_date: Optional[date],
) -> api_schemas.DashboardAnalyticsResponse:
    locations = db.query(database_models.Location).filter(
        database_models.Location.user_id == current_user.id
    ).order_by(database_models.Location.name.asc()).all()

    if location_id is not None and not any(location.id == location_id for location in locations):
        raise HTTPException(status_code=404, detail="Location not found")

    all_invoices = invoice_base_query(db, current_user).order_by(database_models.Invoice.invoice_date.asc()).all()
    all_statement_lines = statement_line_query(db, current_user).order_by(database_models.AssociationStatementLine.id.asc()).all()
    selected_invoices = [
        invoice for invoice in all_invoices
        if location_id is None or invoice.location_id == location_id
    ]
    selected_statement_lines = [
        line for line in all_statement_lines
        if location_id is None or line.location_id == location_id
    ]
    selected_dates = [invoice.invoice_date for invoice in selected_invoices]
    selected_dates.extend(
        line.statement.statement_month
        for line in selected_statement_lines
        if line.statement and line.statement.statement_month
    )
    resolved_start, resolved_end = resolve_period(selected_dates, period, start_date, end_date)
    month_labels = enumerate_months(resolved_start, resolved_end)

    filtered_invoices = [
        invoice for invoice in selected_invoices
        if resolved_start <= invoice.invoice_date <= resolved_end
    ]
    filtered_statement_lines = [
        line for line in selected_statement_lines
        if line.statement and resolved_start <= line.statement.statement_month <= resolved_end
    ]
    selected_statement_totals = build_statement_total_rows(selected_statement_lines)
    filtered_statement_totals = build_statement_total_rows(filtered_statement_lines)
    comparison_invoices = [
        invoice for invoice in all_invoices
        if resolved_start <= invoice.invoice_date <= resolved_end
    ]
    comparison_statement_lines = [
        line for line in all_statement_lines
        if line.statement and resolved_start <= line.statement.statement_month <= resolved_end
    ]
    comparison_statement_totals = build_statement_total_rows(comparison_statement_lines)

    overall_monthly: Dict[str, Dict[str, float]] = defaultdict(lambda: {"cost": 0.0, "consumption": 0.0})
    avizier_monthly: Dict[str, Dict[str, float]] = defaultdict(lambda: {"cost": 0.0, "consumption": 0.0})
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

    for item in filtered_statement_totals:
        bucket = item.invoice_date.strftime("%Y-%m")
        overall_monthly[bucket]["cost"] += item.amount
        avizier_monthly[bucket]["cost"] += item.amount

    for line in filtered_statement_lines:
        bucket = line.statement.statement_month.strftime("%Y-%m")
        if line.include_in_category_analytics and line.category:
            category = line.category
            category_meta[category.id] = (category.name, category.unit)
            category_monthly[category.id][bucket]["cost"] += line.amount
            if line.include_in_unit_cost:
                category_monthly[category.id][bucket]["consumption"] += line.consumption_value or 0.0

    overall_history_invoices = list(selected_invoices)
    overall_history_invoices.extend(selected_statement_totals)
    overall_previous_year_lookup, overall_forecast_lookup = build_history_lookups(overall_history_invoices)
    overall_cost_series = build_monthly_series(
        overall_monthly,
        month_labels,
        overall_previous_year_lookup,
        overall_forecast_lookup,
    )
    avizier_previous_year_lookup, avizier_forecast_lookup = build_history_lookups(selected_statement_totals)
    avizier_cost_series = build_monthly_series(
        avizier_monthly,
        month_labels,
        avizier_previous_year_lookup,
        avizier_forecast_lookup,
    )

    comparison_rollups: Dict[int, Dict[int, Dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"cost": 0.0, "consumption": 0.0}))
    avizier_comparison_rollups: Dict[int, float] = defaultdict(float)
    for invoice in comparison_invoices:
        if invoice.provider and invoice.provider.category:
            category_id = invoice.provider.category.id
            comparison_rollups[category_id][invoice.location_id]["cost"] += invoice.amount
            comparison_rollups[category_id][invoice.location_id]["consumption"] += invoice.consumption_value or 0.0

    for item in comparison_statement_totals:
        avizier_comparison_rollups[item.location_id] += item.amount

    for line in comparison_statement_lines:
        if line.include_in_category_analytics and line.category:
            category_id = line.category.id
            comparison_rollups[category_id][line.location_id]["cost"] += line.amount
            if line.include_in_unit_cost:
                comparison_rollups[category_id][line.location_id]["consumption"] += line.consumption_value or 0.0

    category_sections: List[api_schemas.DashboardCategorySection] = []
    for category_id, monthly in sorted(
        category_monthly.items(),
        key=lambda item: (
            CATEGORY_DISPLAY_ORDER.get(category_meta[item[0]][0], 999),
            category_meta[item[0]][0].lower(),
        ),
    ):
        name, unit = category_meta[category_id]
        category_invoices = [
            invoice for invoice in selected_invoices
            if invoice.provider and invoice.provider.category and invoice.provider.category.id == category_id
        ]
        category_history_points = list(category_invoices)
        category_history_points.extend(
            type("SyntheticInvoice", (), {
                "invoice_date": line.statement.statement_month,
                "amount": line.amount,
            })()
            for line in selected_statement_lines
            if line.include_in_category_analytics and line.category and line.category.id == category_id and line.statement
        )
        previous_year_lookup, forecast_lookup = build_history_lookups(category_history_points)
        monthly_series = build_monthly_series(
            monthly,
            month_labels,
            previous_year_lookup,
            forecast_lookup,
        )
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

    avizier_location_comparison = [
        api_schemas.LocationComparisonPoint(
            location_id=location.id,
            location_name=location.name,
            cost=round(avizier_comparison_rollups[location.id], 2),
            consumption=0.0,
            unit_cost=None,
        )
        for location in locations
    ]

    total_cost = sum(invoice.amount for invoice in filtered_invoices) + sum(item.amount for item in filtered_statement_totals)
    previous_period_cost = compute_previous_period_cost(overall_history_invoices, resolved_start, resolved_end)
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
        avizier_cost_series=avizier_cost_series,
        avizier_location_comparison=avizier_location_comparison,
        category_sections=category_sections,
    )


def render_chart_image(
    title: str,
    labels: List[str],
    series: List[Tuple[str, List[Optional[float]], str]],
    y_label: str,
) -> BytesIO:
    figure, axis = plt.subplots(figsize=(9, 3.4))
    for name, values, color in series:
        numeric_values = [float(value) if value is not None else None for value in values]
        axis.plot(labels, numeric_values, marker="o", linewidth=2, label=name, color=color)
    axis.set_title(title, fontsize=12, fontweight="bold")
    axis.set_ylabel(y_label)
    axis.grid(True, axis="y", alpha=0.2)
    axis.legend(loc="best")
    if len(labels) > 6:
        axis.tick_params(axis="x", rotation=35)
    figure.tight_layout()
    output = BytesIO()
    figure.savefig(output, format="png", dpi=160, bbox_inches="tight")
    plt.close(figure)
    output.seek(0)
    return output


def render_bar_chart_image(
    title: str,
    labels: List[str],
    values: List[float],
    color: str,
    y_label: str,
) -> BytesIO:
    figure, axis = plt.subplots(figsize=(9, 3.4))
    axis.bar(labels, values, color=color)
    axis.set_title(title, fontsize=12, fontweight="bold")
    axis.set_ylabel(y_label)
    axis.grid(True, axis="y", alpha=0.2)
    if len(labels) > 4:
        axis.tick_params(axis="x", rotation=20)
    figure.tight_layout()
    output = BytesIO()
    figure.savefig(output, format="png", dpi=160, bbox_inches="tight")
    plt.close(figure)
    output.seek(0)
    return output


def build_dashboard_pdf(
    dashboard: api_schemas.DashboardAnalyticsResponse,
    selected_location_name: str,
    selected_period_label: str,
) -> BytesIO:
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="UtilityMateHeading", parent=styles["Heading1"], fontSize=18, leading=22, textColor=colors.HexColor("#0f172a")))
    styles.add(ParagraphStyle(name="UtilityMateSubheading", parent=styles["Heading2"], fontSize=12, leading=15, textColor=colors.HexColor("#334155")))
    styles.add(ParagraphStyle(name="UtilityMateBody", parent=styles["BodyText"], fontSize=9, leading=12, textColor=colors.HexColor("#334155")))

    story = [
        Paragraph("UtilityMate Dashboard Export", styles["UtilityMateHeading"]),
        Spacer(1, 4 * mm),
        Paragraph(
            f"Location: <b>{selected_location_name}</b><br/>Period: <b>{selected_period_label}</b><br/>Range: <b>{dashboard.start_date}</b> to <b>{dashboard.end_date}</b>",
            styles["UtilityMateBody"],
        ),
        Spacer(1, 5 * mm),
    ]

    summary_table = Table(
        [
            ["Period Spend", "Average / Month", "Previous Period", "Tracked Categories"],
            [
                f"{dashboard.summary.total_cost:.2f} RON",
                f"{dashboard.summary.avg_monthly_cost:.2f} RON",
                f"{dashboard.summary.previous_period_cost:.2f} RON",
                str(dashboard.summary.active_categories),
            ],
        ],
        colWidths=[42 * mm, 42 * mm, 42 * mm, 42 * mm],
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([summary_table, Spacer(1, 6 * mm)])

    category_breakdown_rows = [["Utility", "Cost", "Share"]]
    total_cost = dashboard.summary.total_cost or 0.0
    for section in sorted(dashboard.category_sections, key=lambda item: item.total_cost, reverse=True):
        share = (section.total_cost / total_cost * 100) if total_cost > 0 else 0.0
        category_breakdown_rows.append([
            section.category_name,
            f"{section.total_cost:.2f} RON",
            f"{share:.1f}%",
        ])
    if len(category_breakdown_rows) == 1:
        category_breakdown_rows.append(["No category data", "0.00 RON", "0.0%"])

    story.append(Paragraph("Cost Breakdown by Utility", styles["UtilityMateSubheading"]))
    story.append(Spacer(1, 2 * mm))
    category_breakdown_table = Table(category_breakdown_rows, colWidths=[80 * mm, 45 * mm, 35 * mm])
    category_breakdown_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([category_breakdown_table, Spacer(1, 6 * mm)])

    overall_labels = [point.label for point in dashboard.overall_cost_series]
    overall_cost_chart = render_chart_image(
        "Monthly Cost Trend",
        overall_labels,
        [
            ("Cost", [point.cost for point in dashboard.overall_cost_series], "#0f766e"),
            ("Last Year", [point.last_year_cost for point in dashboard.overall_cost_series], "#2563eb"),
            ("Average Over the Years", [point.forecast_cost for point in dashboard.overall_cost_series], "#f97316"),
        ],
        "RON",
    )
    story.extend([
        Paragraph("Overall Trend", styles["UtilityMateSubheading"]),
        Spacer(1, 2 * mm),
        Image(overall_cost_chart, width=180 * mm, height=68 * mm),
        Spacer(1, 6 * mm),
    ])

    for section in dashboard.category_sections:
        story.append(Paragraph(section.category_name, styles["UtilityMateSubheading"]))
        story.append(Paragraph(
            f"Total Cost: <b>{section.total_cost:.2f} RON</b> | Total Consumption: <b>{section.total_consumption:.3f} {section.unit}</b> | Unit Cost: <b>{section.avg_unit_cost:.4f} RON / {section.unit}</b>" if section.avg_unit_cost is not None else
            f"Total Cost: <b>{section.total_cost:.2f} RON</b> | Total Consumption: <b>{section.total_consumption:.3f} {section.unit}</b> | Unit Cost: <b>No data</b>",
            styles["UtilityMateBody"],
        ))
        story.append(Spacer(1, 2 * mm))

        labels = [point.label for point in section.monthly_series]
        story.append(Image(
            render_chart_image(
                f"{section.category_name} Cost, Last Year, and Average Over the Years",
                labels,
                [
                    ("Cost", [point.cost for point in section.monthly_series], "#2563eb"),
                    ("Last Year", [point.last_year_cost for point in section.monthly_series], "#0f766e"),
                    ("Average Over the Years", [point.forecast_cost for point in section.monthly_series], "#f97316"),
                ],
                "RON",
            ),
            width=180 * mm,
            height=68 * mm,
        ))
        story.append(Spacer(1, 2 * mm))
        story.append(Image(
            render_chart_image(
                f"{section.category_name} Consumption and Unit Cost",
                labels,
                [
                    ("Consumption", [point.consumption for point in section.monthly_series], "#14b8a6"),
                    ("Unit Cost", [point.unit_cost for point in section.monthly_series], "#7c3aed"),
                ],
                f"{section.unit} / RON",
            ),
            width=180 * mm,
            height=68 * mm,
        ))
        story.append(Spacer(1, 2 * mm))
        story.append(Image(
            render_bar_chart_image(
                f"{section.category_name} Location Comparison",
                [point.location_name for point in section.location_comparison],
                [point.cost for point in section.location_comparison],
                "#0f766e",
                "RON",
            ),
            width=180 * mm,
            height=68 * mm,
        ))
        story.append(Spacer(1, 6 * mm))

    avizier_labels = [point.label for point in dashboard.avizier_cost_series]
    avizier_table_rows = [["Month", "Avizier Cost"]]
    for point in dashboard.avizier_cost_series:
        avizier_table_rows.append([point.label, f"{point.cost:.2f} RON"])
    if len(avizier_table_rows) == 1:
        avizier_table_rows.append(["No avizier data", "0.00 RON"])

    story.append(Paragraph("Avizier Cost per Month", styles["UtilityMateSubheading"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Image(
        render_chart_image(
            "Avizier Cost per Month",
            avizier_labels,
            [
                ("Cost", [point.cost for point in dashboard.avizier_cost_series], "#7c3aed"),
                ("Last Year", [point.last_year_cost for point in dashboard.avizier_cost_series], "#0f766e"),
                ("Average Over the Years", [point.forecast_cost for point in dashboard.avizier_cost_series], "#f97316"),
            ],
            "RON",
        ),
        width=180 * mm,
        height=68 * mm,
    ))
    story.append(Spacer(1, 2 * mm))
    avizier_table = Table(avizier_table_rows, colWidths=[80 * mm, 80 * mm])
    avizier_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([avizier_table, Spacer(1, 4 * mm)])
    story.append(Image(
        render_bar_chart_image(
            "Compare Locations for Avizier",
            [point.location_name for point in dashboard.avizier_location_comparison],
            [point.cost for point in dashboard.avizier_location_comparison],
            "#0f766e",
            "RON",
        ),
        width=180 * mm,
        height=68 * mm,
    ))
    story.extend([
        Spacer(1, 2 * mm),
        Paragraph(
            "The avizier comparison uses the current period filter across all locations and compares the apartment statement totals side by side.",
            styles["UtilityMateBody"],
        ),
        Spacer(1, 6 * mm),
    ])

    document.build(story)
    buffer.seek(0)
    return buffer


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
    return build_dashboard_payload(db, current_user, period, location_id, start_date, end_date)


@router.get("/dashboard-export")
def dashboard_export(
    period: str = Query("last_6_months"),
    location_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    dashboard = build_dashboard_payload(db, current_user, period, location_id, start_date, end_date)
    selected_location_name = "All Locations"
    if dashboard.selected_location_id is not None:
        selected_location_name = next(
            (
                location.name
                for location in dashboard.available_locations
                if location.id == dashboard.selected_location_id
            ),
            "Selected Location",
        )

    period_labels = {
        "last_3_months": "Last 3 Months",
        "last_6_months": "Last 6 Months",
        "last_1_year": "Last 1 Year",
        "custom": "Custom Period",
        "all_time": "All Time",
    }
    selected_period_label = period_labels.get(period, "Custom Period")
    pdf_buffer = build_dashboard_pdf(dashboard, selected_location_name, selected_period_label)
    filename = f"utilitymate-dashboard-{selected_location_name.lower().replace(' ', '-')}-{selected_period_label.lower().replace(' ', '-')}.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
