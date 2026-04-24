from collections import defaultdict
from datetime import date
from io import BytesIO
import os
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.rate_limiter import limiter

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RENT_PDF_LOGO_PATH = os.path.join(BASE_DIR, "backend", "assets", "utilitymate-logo.png")


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _next_month(value: date) -> date:
    return date(value.year + (1 if value.month == 12 else 0), 1 if value.month == 12 else value.month + 1, 1)


def _previous_month(value: date) -> date:
    return date(value.year - (1 if value.month == 1 else 0), 12 if value.month == 1 else value.month - 1, 1)


def _display_amount(value: float) -> str:
    normalized = 0.0 if abs(float(value)) < 0.005 else float(value)
    return f"{normalized:.2f}"


def _sort_tenant_statements(tenants: List[api_schemas.RentTenantStatement]) -> List[api_schemas.RentTenantStatement]:
    return sorted(
        tenants,
        key=lambda tenant: (
            (tenant.room_name or "").strip().lower(),
            tenant.tenant_name.strip().lower(),
        ),
    )


def _statement_effective_month(statement: database_models.AssociationStatement) -> Optional[date]:
    anchor = statement.posted_date or statement.statement_month
    return _month_start(anchor) if anchor else None


def _get_owned_lease(db: Session, user_id: int, lease_id: int):
    lease = db.query(database_models.RentLease).options(
        joinedload(database_models.RentLease.location),
        joinedload(database_models.RentLease.electricity_provider).joinedload(database_models.Provider.category),
        joinedload(database_models.RentLease.tenants).joinedload(database_models.RentTenant.default_room),
        joinedload(database_models.RentLease.rooms),
        joinedload(database_models.RentLease.months),
    ).filter(
        database_models.RentLease.id == lease_id,
        database_models.RentLease.user_id == user_id,
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Rent lease not found")
    return lease


def _validate_location(db: Session, user_id: int, location_id: int):
    location = db.query(database_models.Location).filter(
        database_models.Location.id == location_id,
        database_models.Location.user_id == user_id,
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


def _validate_provider(db: Session, user_id: int, provider_id: Optional[int]):
    if provider_id is None:
        return None
    provider = db.query(database_models.Provider).options(
        joinedload(database_models.Provider.category)
    ).filter(
        database_models.Provider.id == provider_id,
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    if provider.user_id not in (None, user_id):
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


def _serialize_lease_detail(db: Session, lease: database_models.RentLease, user_id: int):
    statement_months = {
        _statement_effective_month(statement)
        for statement in db.query(database_models.AssociationStatement)
        .join(database_models.AssociationStatementLine, database_models.AssociationStatementLine.statement_id == database_models.AssociationStatement.id)
        .filter(database_models.AssociationStatementLine.location_id == lease.location_id)
        .distinct()
        .all()
    }
    statement_months.discard(None)

    invoice_months_query = db.query(database_models.Invoice.invoice_date).filter(
        database_models.Invoice.location_id == lease.location_id
    )
    if lease.electricity_provider_id:
        invoice_months_query = invoice_months_query.filter(database_models.Invoice.provider_id == lease.electricity_provider_id)
    else:
        invoice_months_query = invoice_months_query.join(
            database_models.Provider, database_models.Provider.id == database_models.Invoice.provider_id
        ).join(
            database_models.Category, database_models.Category.id == database_models.Provider.category_id
        ).filter(database_models.Category.name == "Energy")

    for row in invoice_months_query.distinct().all():
        if row[0]:
            statement_months.add(_month_start(row[0]))

    configured_months = sorted(_month_start(month.month) for month in lease.months)
    return api_schemas.RentLeaseDetail(
        id=lease.id,
        name=lease.name,
        notes=lease.notes,
        is_active=lease.is_active,
        created_at=lease.created_at,
        location=lease.location,
        electricity_provider=lease.electricity_provider,
        tenants=lease.tenants,
        rooms=lease.rooms,
        available_statement_months=sorted(statement_months),
        configured_months=configured_months,
    )


def _get_or_build_month(
    lease: database_models.RentLease,
    month_value: date,
    existing_month: Optional[database_models.RentMonth],
):
    if existing_month:
        tenant_configs = {
            config.tenant_id: config
            for config in existing_month.tenant_configs
        }
        room_usages = {
            usage.room_id: usage.usage_value
            for usage in existing_month.room_usages
        }
        room_energy_usages = {
            usage.room_id: usage.usage_kwh
            for usage in existing_month.room_energy_usages
        }
        notes = existing_month.notes
    else:
        tenant_configs = {}
        room_usages = {}
        room_energy_usages = {}
        notes = None

    config_rows: List[api_schemas.RentTenantMonthConfig] = []
    for tenant in lease.tenants:
        config = tenant_configs.get(tenant.id)
        room = config.room if config and config.room else tenant.default_room
        config_rows.append(
            api_schemas.RentTenantMonthConfig(
                tenant_id=tenant.id,
                tenant_name=tenant.name,
                room_id=room.id if room else None,
                room_name=room.name if room else None,
                is_active=config.is_active if config else tenant.is_active_default,
                pays_rent=config.pays_rent if config else tenant.pays_rent_default,
                pays_utilities=config.pays_utilities if config else tenant.pays_utilities_default,
                rent_amount=float(config.rent_amount if config else tenant.default_rent_amount or 0.0),
                other_adjustment=float(config.other_adjustment if config else 0.0),
                other_adjustment_note=config.other_adjustment_note if config else None,
            )
        )

    usage_rows = [
        api_schemas.RentRoomUsage(
            room_id=room.id,
            room_name=room.name,
            usage_value=float(room_usages.get(room.id, 0.0)),
        )
        for room in lease.rooms
    ]

    energy_usage_rows = [
        api_schemas.RentRoomEnergyUsage(
            room_id=room.id,
            room_name=room.name,
            usage_kwh=float(room_energy_usages.get(room.id, 0.0)),
        )
        for room in lease.rooms
    ]

    return notes, config_rows, usage_rows, energy_usage_rows


def _calculate_source_summary(db: Session, lease: database_models.RentLease, month_value: date):
    electricity_query = db.query(database_models.Invoice).filter(
        database_models.Invoice.location_id == lease.location_id,
        database_models.Invoice.invoice_date >= month_value,
        database_models.Invoice.invoice_date < _next_month(month_value),
    )
    if lease.electricity_provider_id:
        electricity_query = electricity_query.filter(database_models.Invoice.provider_id == lease.electricity_provider_id)
    else:
        electricity_query = electricity_query.join(
            database_models.Provider, database_models.Provider.id == database_models.Invoice.provider_id
        ).join(
            database_models.Category, database_models.Category.id == database_models.Provider.category_id
        ).filter(database_models.Category.name == "Energy")

    electricity_invoices = electricity_query.all()
    electricity_total = sum(float(invoice.amount or 0.0) for invoice in electricity_invoices)
    electricity_consumption_total = sum(float(invoice.consumption_value or 0.0) for invoice in electricity_invoices)

    raw_statement_lines = db.query(database_models.AssociationStatementLine, database_models.AssociationStatement).join(
        database_models.AssociationStatement, database_models.AssociationStatement.id == database_models.AssociationStatementLine.statement_id
    ).filter(
        database_models.AssociationStatementLine.location_id == lease.location_id,
    ).all()

    statement_lines = [
        line
        for line, statement in raw_statement_lines
        if _statement_effective_month(statement) == month_value
    ]

    avizier_total = sum(
        float(line.amount or 0.0)
        for line in statement_lines
        if line.line_kind == "statement_total" and line.normalized_label == "Avizier Total"
    )
    heating_total = sum(
        float(line.amount or 0.0)
        for line in statement_lines
        if line.normalized_label == "Heating"
    )
    non_heating_utilities_total = max(avizier_total - heating_total, 0.0)

    return api_schemas.RentSourceSummary(
        electricity_total=float(electricity_total),
        electricity_consumption_total=float(electricity_consumption_total),
        avizier_total=float(avizier_total),
        heating_total=float(heating_total),
        non_heating_utilities_total=float(non_heating_utilities_total),
    )


def _build_source_summary_map(
    db: Session,
    lease: database_models.RentLease,
    months: List[date],
) -> Dict[date, api_schemas.RentSourceSummary]:
    if not months:
        return {}

    month_set = {_month_start(month) for month in months}
    earliest_month = min(month_set)
    latest_month = _next_month(max(month_set))
    earliest_statement_month = _previous_month(earliest_month)

    electricity_query = db.query(database_models.Invoice).filter(
        database_models.Invoice.location_id == lease.location_id,
        database_models.Invoice.invoice_date >= earliest_month,
        database_models.Invoice.invoice_date < latest_month,
    )
    if lease.electricity_provider_id:
        electricity_query = electricity_query.filter(database_models.Invoice.provider_id == lease.electricity_provider_id)
    else:
        electricity_query = electricity_query.join(
            database_models.Provider, database_models.Provider.id == database_models.Invoice.provider_id
        ).join(
            database_models.Category, database_models.Category.id == database_models.Provider.category_id
        ).filter(database_models.Category.name == "Energy")

    electricity_by_month: Dict[date, Dict[str, float]] = defaultdict(lambda: {"amount": 0.0, "consumption": 0.0})
    for invoice in electricity_query.all():
        invoice_month = _month_start(invoice.invoice_date)
        if invoice_month not in month_set:
            continue
        electricity_by_month[invoice_month]["amount"] += float(invoice.amount or 0.0)
        electricity_by_month[invoice_month]["consumption"] += float(invoice.consumption_value or 0.0)

    statement_totals_by_month: Dict[date, Dict[str, float]] = defaultdict(lambda: {"avizier": 0.0, "heating": 0.0})
    raw_statement_lines = db.query(
        database_models.AssociationStatementLine,
        database_models.AssociationStatement,
    ).join(
        database_models.AssociationStatement,
        database_models.AssociationStatement.id == database_models.AssociationStatementLine.statement_id,
    ).filter(
        database_models.AssociationStatementLine.location_id == lease.location_id,
        database_models.AssociationStatement.statement_month >= earliest_statement_month,
        database_models.AssociationStatement.statement_month < latest_month,
    ).all()

    for line, statement in raw_statement_lines:
        effective_month = _statement_effective_month(statement)
        if effective_month not in month_set:
            continue
        if line.line_kind == "statement_total" and line.normalized_label == "Avizier Total":
            statement_totals_by_month[effective_month]["avizier"] += float(line.amount or 0.0)
        if line.normalized_label == "Heating":
            statement_totals_by_month[effective_month]["heating"] += float(line.amount or 0.0)

    summary_map: Dict[date, api_schemas.RentSourceSummary] = {}
    for month in month_set:
        electricity = electricity_by_month[month]
        statement_totals = statement_totals_by_month[month]
        avizier_total = statement_totals["avizier"]
        heating_total = statement_totals["heating"]
        summary_map[month] = api_schemas.RentSourceSummary(
            electricity_total=float(electricity["amount"]),
            electricity_consumption_total=float(electricity["consumption"]),
            avizier_total=float(avizier_total),
            heating_total=float(heating_total),
            non_heating_utilities_total=float(max(avizier_total - heating_total, 0.0)),
        )
    return summary_map


def _build_room_tenant_map(tenant_configs: List[api_schemas.RentTenantMonthConfig]) -> Dict[int, List[int]]:
    room_tenant_map: Dict[int, List[int]] = defaultdict(list)
    for config in tenant_configs:
        if config.is_active and config.pays_utilities and config.room_id:
            room_tenant_map[config.room_id].append(config.tenant_id)
    return room_tenant_map


def _room_tenant_ids_or_all_payers(
    room_id: int,
    room_tenant_map: Dict[int, List[int]],
    utility_payers: List[api_schemas.RentTenantMonthConfig],
) -> List[int]:
    tenant_ids = room_tenant_map.get(room_id, [])
    if tenant_ids:
        return tenant_ids
    return [config.tenant_id for config in utility_payers]


def _calculate_heating_distribution(
    heating_total: float,
    utility_payers: List[api_schemas.RentTenantMonthConfig],
    room_usages: List[api_schemas.RentRoomUsage],
    room_tenant_map: Dict[int, List[int]],
):
    heating_by_tenant: Dict[int, float] = defaultdict(float)
    total_usage = sum(float(usage.usage_value) for usage in room_usages if float(usage.usage_value) > 0)
    heating_mode = "equal"
    if heating_total > 0 and total_usage > 0 and room_tenant_map:
        heating_mode = "room_usage"
        for usage in room_usages:
            usage_value = float(usage.usage_value)
            if usage_value <= 0:
                continue
            tenant_ids = _room_tenant_ids_or_all_payers(usage.room_id, room_tenant_map, utility_payers)
            if not tenant_ids:
                continue
            room_share = heating_total * (usage_value / total_usage)
            per_tenant_share = room_share / len(tenant_ids)
            for tenant_id in tenant_ids:
                heating_by_tenant[tenant_id] += per_tenant_share
    elif utility_payers:
        equal_heating = heating_total / len(utility_payers)
        for config in utility_payers:
            heating_by_tenant[config.tenant_id] = equal_heating
    return heating_by_tenant, heating_mode


def _calculate_electricity_distribution(
    electricity_total: float,
    electricity_consumption_total: float,
    utility_payers: List[api_schemas.RentTenantMonthConfig],
    room_energy_usages: List[api_schemas.RentRoomEnergyUsage],
    room_tenant_map: Dict[int, List[int]],
):
    electricity_by_tenant: Dict[int, float] = defaultdict(float)
    if not utility_payers:
        return electricity_by_tenant, "equal"

    if electricity_total <= 0 or electricity_consumption_total <= 0:
        equal_amount = electricity_total / len(utility_payers)
        for config in utility_payers:
            electricity_by_tenant[config.tenant_id] = equal_amount
        return electricity_by_tenant, "equal"

    assigned_kwh = 0.0
    for usage in room_energy_usages:
        usage_kwh = max(float(usage.usage_kwh), 0.0)
        if usage_kwh <= 0:
            continue
        tenant_ids = _room_tenant_ids_or_all_payers(usage.room_id, room_tenant_map, utility_payers)
        if not tenant_ids:
            continue
        assigned_kwh += usage_kwh
        per_tenant_kwh = usage_kwh / len(tenant_ids)
        for tenant_id in tenant_ids:
            electricity_by_tenant[tenant_id] += per_tenant_kwh

    remaining_kwh = max(electricity_consumption_total - assigned_kwh, 0.0)
    equal_remaining_kwh = remaining_kwh / len(utility_payers)
    for config in utility_payers:
        electricity_by_tenant[config.tenant_id] += equal_remaining_kwh

    unit_cost = electricity_total / electricity_consumption_total
    for tenant_id, consumption_kwh in list(electricity_by_tenant.items()):
        electricity_by_tenant[tenant_id] = consumption_kwh * unit_cost

    return electricity_by_tenant, "room_usage_remainder_split"


def _calculate_electricity_usage_distribution(
    electricity_consumption_total: float,
    utility_payers: List[api_schemas.RentTenantMonthConfig],
    room_energy_usages: List[api_schemas.RentRoomEnergyUsage],
    room_tenant_map: Dict[int, List[int]],
):
    usage_by_tenant: Dict[int, float] = defaultdict(float)
    if not utility_payers or electricity_consumption_total <= 0:
        return usage_by_tenant

    assigned_kwh = 0.0
    for usage in room_energy_usages:
        usage_kwh = max(float(usage.usage_kwh), 0.0)
        if usage_kwh <= 0:
            continue
        tenant_ids = _room_tenant_ids_or_all_payers(usage.room_id, room_tenant_map, utility_payers)
        if not tenant_ids:
            continue
        assigned_kwh += usage_kwh
        per_tenant_kwh = usage_kwh / len(tenant_ids)
        for tenant_id in tenant_ids:
            usage_by_tenant[tenant_id] += per_tenant_kwh

    remaining_kwh = max(electricity_consumption_total - assigned_kwh, 0.0)
    if remaining_kwh > 0:
        equal_remaining_kwh = remaining_kwh / len(utility_payers)
        for config in utility_payers:
            usage_by_tenant[config.tenant_id] += equal_remaining_kwh

    return usage_by_tenant


def _calculate_heating_usage_distribution(
    utility_payers: List[api_schemas.RentTenantMonthConfig],
    room_usages: List[api_schemas.RentRoomUsage],
    room_tenant_map: Dict[int, List[int]],
):
    usage_by_tenant: Dict[int, float] = defaultdict(float)
    if not utility_payers:
        return usage_by_tenant

    total_usage = sum(float(usage.usage_value) for usage in room_usages if float(usage.usage_value) > 0)
    if total_usage > 0 and room_tenant_map:
        for usage in room_usages:
            usage_value = max(float(usage.usage_value), 0.0)
            if usage_value <= 0:
                continue
            tenant_ids = _room_tenant_ids_or_all_payers(usage.room_id, room_tenant_map, utility_payers)
            if not tenant_ids:
                continue
            per_tenant_usage = usage_value / len(tenant_ids)
            for tenant_id in tenant_ids:
                usage_by_tenant[tenant_id] += per_tenant_usage
        return usage_by_tenant

    equal_usage = 1.0 / len(utility_payers)
    for config in utility_payers:
        usage_by_tenant[config.tenant_id] = equal_usage
    return usage_by_tenant


def _build_statement(
    db: Session,
    lease: database_models.RentLease,
    month_value: date,
):
    month_value = _month_start(month_value)
    months_by_key = {
        _month_start(month_row.month): month_row
        for month_row in db.query(database_models.RentMonth).options(
            joinedload(database_models.RentMonth.tenant_configs).joinedload(database_models.RentMonthTenant.room),
            joinedload(database_models.RentMonth.room_usages).joinedload(database_models.RentRoomUsage.room),
            joinedload(database_models.RentMonth.room_energy_usages).joinedload(database_models.RentRoomEnergyUsage.room),
        ).filter(database_models.RentMonth.lease_id == lease.id).all()
    }

    notes, tenant_configs, room_usages, room_energy_usages = _get_or_build_month(lease, month_value, months_by_key.get(month_value))
    payments = db.query(database_models.RentPayment).options(
        joinedload(database_models.RentPayment.tenant)
    ).filter(
        database_models.RentPayment.lease_id == lease.id,
        database_models.RentPayment.month == month_value,
    ).order_by(database_models.RentPayment.payment_date.asc()).all()

    ordered_months = sorted(set(months_by_key.keys()) | {month_value})
    source_summaries = _build_source_summary_map(db, lease, ordered_months)
    source_summary = source_summaries[month_value]
    utility_payers = [config for config in tenant_configs if config.is_active and config.pays_utilities]
    utility_payer_count = len(utility_payers)
    payment_rows = db.query(database_models.RentPayment).filter(
        database_models.RentPayment.lease_id == lease.id,
        database_models.RentPayment.month.in_(ordered_months),
    ).all()
    payment_totals_by_month: Dict[date, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for payment in payment_rows:
        payment_month = _month_start(payment.month)
        payment_totals_by_month[payment_month][payment.tenant_id] += float(payment.amount or 0.0)

    payment_totals = payment_totals_by_month.get(month_value, defaultdict(float))
    balances: Dict[int, float] = defaultdict(float)
    statement_rows: List[api_schemas.RentTenantStatement] = []
    electricity_mode = "equal"
    heating_mode = "equal"

    for current_month in ordered_months:
        _, current_configs, current_room_usages, current_room_energy_usages = _get_or_build_month(lease, current_month, months_by_key.get(current_month))
        current_sources = source_summaries[current_month]
        current_utility_payers = [config for config in current_configs if config.is_active and config.pays_utilities]
        current_utility_payer_count = len(current_utility_payers)
        current_shared_per_payer = (current_sources.non_heating_utilities_total / current_utility_payer_count) if current_utility_payer_count else 0.0

        current_room_tenant_map = _build_room_tenant_map(current_configs)
        current_electricity_by_tenant, current_electricity_mode = _calculate_electricity_distribution(
            current_sources.electricity_total,
            current_sources.electricity_consumption_total,
            current_utility_payers,
            current_room_energy_usages,
            current_room_tenant_map,
        )
        current_electricity_usage_by_tenant = _calculate_electricity_usage_distribution(
            current_sources.electricity_consumption_total,
            current_utility_payers,
            current_room_energy_usages,
            current_room_tenant_map,
        )
        current_heating_by_tenant, current_heating_mode = _calculate_heating_distribution(
            current_sources.heating_total,
            current_utility_payers,
            current_room_usages,
            current_room_tenant_map,
        )
        current_heating_usage_by_tenant = _calculate_heating_usage_distribution(
            current_utility_payers,
            current_room_usages,
            current_room_tenant_map,
        )
        current_payment_totals = payment_totals_by_month.get(current_month, defaultdict(float))

        current_rows: List[api_schemas.RentTenantStatement] = []
        for config in current_configs:
            electricity_amount = current_electricity_by_tenant.get(config.tenant_id, 0.0) if (config.is_active and config.pays_utilities) else 0.0
            shared_utilities_amount = current_shared_per_payer if (config.is_active and config.pays_utilities) else 0.0
            heating_amount = current_heating_by_tenant.get(config.tenant_id, 0.0) if (config.is_active and config.pays_utilities) else 0.0
            utilities_amount = shared_utilities_amount + heating_amount
            current_total = (config.rent_amount if config.pays_rent else 0.0) + electricity_amount + utilities_amount + config.other_adjustment
            previous_balance = balances[config.tenant_id]
            payments_in_month = current_payment_totals.get(config.tenant_id, 0.0)
            amount_due = previous_balance + current_total - payments_in_month

            row = api_schemas.RentTenantStatement(
                tenant_id=config.tenant_id,
                tenant_name=config.tenant_name,
                room_name=config.room_name,
                is_active=config.is_active,
                pays_rent=config.pays_rent,
                pays_utilities=config.pays_utilities,
                rent_amount=float(config.rent_amount if config.pays_rent else 0.0),
                electricity_usage_kwh=float(current_electricity_usage_by_tenant.get(config.tenant_id, 0.0) if (config.is_active and config.pays_utilities) else 0.0),
                electricity_amount=float(electricity_amount),
                shared_utilities_amount=float(shared_utilities_amount),
                heating_usage_value=float(current_heating_usage_by_tenant.get(config.tenant_id, 0.0) if (config.is_active and config.pays_utilities) else 0.0),
                heating_amount=float(heating_amount),
                utilities_amount=float(utilities_amount),
                other_adjustment=float(config.other_adjustment),
                other_adjustment_note=config.other_adjustment_note,
                current_total=float(current_total),
                previous_balance=float(previous_balance),
                payments_in_month=float(payments_in_month),
                amount_due=float(amount_due),
            )
            current_rows.append(row)
            balances[config.tenant_id] = amount_due

        if current_month == month_value:
            electricity_mode = current_electricity_mode
            heating_mode = current_heating_mode
            statement_rows = current_rows

    total_rent = sum(row.rent_amount for row in statement_rows)
    total_current = sum(row.current_total for row in statement_rows)
    total_due = sum(row.amount_due for row in statement_rows)
    total_payments = sum(payment_totals.values())

    return api_schemas.RentMonthStatement(
        month=month_value,
        notes=notes,
        source_summary=source_summary,
        utility_payer_count=utility_payer_count,
        electricity_allocation_mode=electricity_mode,
        heating_allocation_mode=heating_mode,
        tenant_configs=tenant_configs,
        room_usages=room_usages,
        room_energy_usages=room_energy_usages,
        payments=payments,
        tenant_statements=statement_rows,
        totals={
            "rent_total": float(total_rent),
            "electricity_total": float(source_summary.electricity_total),
            "avizier_total": float(source_summary.avizier_total),
            "current_total": float(total_current),
            "payments_total": float(total_payments),
            "amount_due_total": float(total_due),
        },
    )

def _build_person_breakdown_card(
    tenant: api_schemas.RentTenantStatement,
    styles,
) -> List:
    breakdown_rows = [
        ["Rent", f"{_display_amount(tenant.rent_amount)} RON", "Electricity", f"{_display_amount(tenant.electricity_amount)} RON"],
        ["Energy Usage", f"{_display_amount(tenant.electricity_usage_kwh)} kWh", "Heating", f"{_display_amount(tenant.heating_amount)} RON"],
        ["Heating Usage", _display_amount(tenant.heating_usage_value), "Shared Utilities", f"{_display_amount(tenant.shared_utilities_amount)} RON"],
        ["Other", f"{_display_amount(tenant.other_adjustment)} RON", "Previous", f"{_display_amount(tenant.previous_balance)} RON"],
        ["Payments", f"{_display_amount(-tenant.payments_in_month)} RON", "Amount Due", f"{_display_amount(tenant.amount_due)} RON"],
    ]
    if tenant.other_adjustment_note:
        breakdown_rows.append([
            "Adjustment Note",
            Paragraph(tenant.other_adjustment_note.replace("\n", "<br/>"), styles["RentBody"]),
            "",
            "",
        ])

    card_title = Paragraph(
        f"<b>{tenant.tenant_name}</b>{f' • {tenant.room_name}' if tenant.room_name else ''}",
        styles["RentBody"],
    )
    person_table = Table(breakdown_rows, colWidths=[34 * mm, 29 * mm, 36 * mm, 29 * mm])
    person_table_style = [
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]
    if tenant.other_adjustment_note:
        note_row_index = len(breakdown_rows) - 1
        person_table_style.extend([
            ("SPAN", (1, note_row_index), (3, note_row_index)),
            ("ALIGN", (1, note_row_index), (3, note_row_index), "LEFT"),
            ("VALIGN", (0, note_row_index), (-1, note_row_index), "TOP"),
        ])
    person_table.setStyle(TableStyle(person_table_style))
    return [card_title, Spacer(1, 1.5 * mm), person_table]


def _build_rent_statement_pdf(
    db: Session,
    lease: database_models.RentLease,
    statement: api_schemas.RentMonthStatement,
) -> BytesIO:
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="RentHeading", parent=styles["Heading1"], fontSize=18, leading=22, textColor=colors.HexColor("#0f172a")))
    styles.add(ParagraphStyle(name="RentSubheading", parent=styles["Heading2"], fontSize=10.5, leading=13, textColor=colors.HexColor("#334155")))
    styles.add(ParagraphStyle(name="RentBody", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.HexColor("#334155")))
    styles.add(ParagraphStyle(name="RentMeta", parent=styles["BodyText"], fontSize=10, leading=13, textColor=colors.HexColor("#334155")))

    month_label = statement.month.strftime("%B %Y")
    header_cells = ["", Paragraph("UtilityMate Rent Statement", styles["RentHeading"]), ""]
    if os.path.exists(RENT_PDF_LOGO_PATH):
        header_cells[0] = Image(RENT_PDF_LOGO_PATH, width=16 * mm, height=16 * mm)
        header_cells[2] = Spacer(16 * mm, 1)
    header_table = Table([header_cells], colWidths=[25 * mm, 227 * mm, 25 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story = [
        header_table,
        Spacer(1, 3 * mm),
        Paragraph(
            f"Workspace: <b>{lease.name}</b><br/>Location: <b>{lease.location.name}</b><br/>Month: <b>{month_label}</b>",
            styles["RentMeta"],
        ),
        Spacer(1, 4 * mm),
    ]

    summary_rows = [
        ["Rent", "Electricity", "Invoice kWh", "Avizier", "Heating", "Amount Due"],
        [
            f"{_display_amount(statement.totals['rent_total'])} RON",
            f"{_display_amount(statement.source_summary.electricity_total)} RON",
            f"{_display_amount(statement.source_summary.electricity_consumption_total)} kWh",
            f"{_display_amount(statement.source_summary.avizier_total)} RON",
            f"{_display_amount(statement.source_summary.heating_total)} RON",
            f"{_display_amount(statement.totals['amount_due_total'])} RON",
        ],
    ]
    summary_table = Table(summary_rows, colWidths=[44 * mm, 44 * mm, 44 * mm, 44 * mm, 44 * mm, 48 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([summary_table, Spacer(1, 4 * mm)])

    if statement.notes:
        story.extend([
            Paragraph("Month Notes", styles["RentSubheading"]),
            Spacer(1, 1.5 * mm),
            Paragraph(statement.notes.replace("\n", "<br/>"), styles["RentBody"]),
            Spacer(1, 4 * mm),
        ])

    story.extend([
        Paragraph("What Each Person Has to Pay", styles["RentSubheading"]),
        Spacer(1, 1.5 * mm),
    ])

    statement_rows = [[
        "Tenant",
        "Room",
        "Rent",
        "Electricity",
        "Shared Utilities",
        "Heating",
        "Other",
        "Previous",
        "Payments",
        "Amount Due",
    ]]
    sorted_tenants = _sort_tenant_statements(statement.tenant_statements)
    for tenant in sorted_tenants:
        statement_rows.append([
            tenant.tenant_name,
            tenant.room_name or "-",
            _display_amount(tenant.rent_amount),
            _display_amount(tenant.electricity_amount),
            _display_amount(tenant.shared_utilities_amount),
            _display_amount(tenant.heating_amount),
            _display_amount(tenant.other_adjustment),
            _display_amount(tenant.previous_balance),
            _display_amount(tenant.payments_in_month),
            _display_amount(tenant.amount_due),
        ])
    statement_table = Table(
        statement_rows,
        colWidths=[31 * mm, 31 * mm, 18 * mm, 20 * mm, 27 * mm, 18 * mm, 17 * mm, 20 * mm, 20 * mm, 23 * mm],
        repeatRows=1,
    )
    statement_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dcfce7")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (-1, 1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([statement_table, Spacer(1, 4 * mm)])

    story.extend([
        PageBreak(),
        Paragraph("Per-Person Breakdown", styles["RentSubheading"]),
        Spacer(1, 1.5 * mm),
    ])

    person_cards = [_build_person_breakdown_card(tenant, styles) for tenant in sorted_tenants]
    breakdown_grid_rows = []
    for index in range(0, len(person_cards), 2):
        left_card = person_cards[index]
        right_card = person_cards[index + 1] if index + 1 < len(person_cards) else ""
        breakdown_grid_rows.append([left_card, right_card])

    breakdown_grid = Table(
        breakdown_grid_rows or [[Paragraph("No tenant breakdown available.", styles["RentBody"]), ""]],
        colWidths=[133 * mm, 133 * mm],
        hAlign="CENTER",
    )
    breakdown_grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([breakdown_grid, Spacer(1, 3 * mm)])

    story.extend([
        Paragraph(
            f"Utility payer count: <b>{statement.utility_payer_count}</b> • Electricity allocation: <b>{'Room kWh plus equal remainder' if statement.electricity_allocation_mode == 'room_usage_remainder_split' else 'Equal fallback'}</b> • Heating allocation: <b>{'Room usage' if statement.heating_allocation_mode == 'room_usage' else 'Equal fallback'}</b>",
            styles["RentBody"],
        )
    ])

    document.build(story)
    buffer.seek(0)
    return buffer


def _format_rent_statement_filename(location_name: str, month_value: date) -> str:
    export_date = date.today().strftime("%Y-%m-%d")
    month_label = month_value.strftime("%Y-%B")
    safe_location = "".join(char for char in location_name if char not in '<>:"/\\|?*')
    safe_location = "".join(safe_location.split()) or "Unknown"
    return f"{export_date} - Rent Statement - {safe_location} - {month_label}.pdf"


@router.get("/leases", response_model=List[api_schemas.RentLeaseSummary])
def list_rent_leases(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    return db.query(database_models.RentLease).options(
        joinedload(database_models.RentLease.location)
    ).filter(
        database_models.RentLease.user_id == current_user.id
    ).order_by(database_models.RentLease.created_at.desc()).all()


@router.post("/leases", response_model=api_schemas.RentLeaseDetail)
def create_rent_lease(
    payload: api_schemas.RentLeaseCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    _validate_location(db, current_user.id, payload.location_id)
    _validate_provider(db, current_user.id, payload.electricity_provider_id)
    lease = database_models.RentLease(
        user_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(lease)
    db.commit()
    db.refresh(lease)
    lease = _get_owned_lease(db, current_user.id, lease.id)
    return _serialize_lease_detail(db, lease, current_user.id)


@router.get("/leases/{lease_id}", response_model=api_schemas.RentLeaseDetail)
def get_rent_lease(
    lease_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    return _serialize_lease_detail(db, lease, current_user.id)


@router.put("/leases/{lease_id}", response_model=api_schemas.RentLeaseDetail)
def update_rent_lease(
    lease_id: int,
    payload: api_schemas.RentLeaseUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "location_id" in update_data:
        _validate_location(db, current_user.id, update_data["location_id"])
    if "electricity_provider_id" in update_data:
        _validate_provider(db, current_user.id, update_data["electricity_provider_id"])
    for key, value in update_data.items():
        setattr(lease, key, value)
    db.commit()
    db.refresh(lease)
    lease = _get_owned_lease(db, current_user.id, lease.id)
    return _serialize_lease_detail(db, lease, current_user.id)


@router.delete("/leases/{lease_id}")
def delete_rent_lease(
    lease_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    db.delete(lease)
    db.commit()
    return {"message": "Rent lease deleted"}


@router.post("/leases/{lease_id}/rooms", response_model=api_schemas.RentRoom)
def create_rent_room(
    lease_id: int,
    payload: api_schemas.RentRoomCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    _get_owned_lease(db, current_user.id, lease_id)
    room = database_models.RentRoom(lease_id=lease_id, **payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.put("/rooms/{room_id}", response_model=api_schemas.RentRoom)
def update_rent_room(
    room_id: int,
    payload: api_schemas.RentRoomUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    room = db.query(database_models.RentRoom).join(
        database_models.RentLease, database_models.RentLease.id == database_models.RentRoom.lease_id
    ).filter(
        database_models.RentRoom.id == room_id,
        database_models.RentLease.user_id == current_user.id,
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Rent room not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}")
def delete_rent_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    room = db.query(database_models.RentRoom).join(
        database_models.RentLease, database_models.RentLease.id == database_models.RentRoom.lease_id
    ).filter(
        database_models.RentRoom.id == room_id,
        database_models.RentLease.user_id == current_user.id,
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Rent room not found")
    db.query(database_models.RentTenant).filter(
        database_models.RentTenant.default_room_id == room_id
    ).update({database_models.RentTenant.default_room_id: None}, synchronize_session=False)
    db.query(database_models.RentMonthTenant).filter(
        database_models.RentMonthTenant.room_id == room_id
    ).update({database_models.RentMonthTenant.room_id: None}, synchronize_session=False)
    db.delete(room)
    db.commit()
    return {"message": "Rent room deleted"}


@router.post("/leases/{lease_id}/tenants", response_model=api_schemas.RentTenant)
def create_rent_tenant(
    lease_id: int,
    payload: api_schemas.RentTenantCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    room_ids = {room.id for room in lease.rooms}
    if payload.default_room_id is not None and payload.default_room_id not in room_ids:
        raise HTTPException(status_code=400, detail="Room does not belong to this lease")
    tenant = database_models.RentTenant(lease_id=lease_id, **payload.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return db.query(database_models.RentTenant).options(
        joinedload(database_models.RentTenant.default_room)
    ).filter(database_models.RentTenant.id == tenant.id).first()


@router.put("/tenants/{tenant_id}", response_model=api_schemas.RentTenant)
def update_rent_tenant(
    tenant_id: int,
    payload: api_schemas.RentTenantUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    tenant = db.query(database_models.RentTenant).options(
        joinedload(database_models.RentTenant.lease).joinedload(database_models.RentLease.rooms),
        joinedload(database_models.RentTenant.default_room),
    ).join(
        database_models.RentLease, database_models.RentLease.id == database_models.RentTenant.lease_id
    ).filter(
        database_models.RentTenant.id == tenant_id,
        database_models.RentLease.user_id == current_user.id,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Rent tenant not found")
    updates = payload.model_dump(exclude_unset=True)
    if "default_room_id" in updates and updates["default_room_id"] is not None:
        room_ids = {room.id for room in tenant.lease.rooms}
        if updates["default_room_id"] not in room_ids:
            raise HTTPException(status_code=400, detail="Room does not belong to this lease")
    for key, value in updates.items():
        setattr(tenant, key, value)
    db.commit()
    db.refresh(tenant)
    return db.query(database_models.RentTenant).options(
        joinedload(database_models.RentTenant.default_room)
    ).filter(database_models.RentTenant.id == tenant.id).first()


@router.delete("/tenants/{tenant_id}")
def delete_rent_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    tenant = db.query(database_models.RentTenant).join(
        database_models.RentLease, database_models.RentLease.id == database_models.RentTenant.lease_id
    ).filter(
        database_models.RentTenant.id == tenant_id,
        database_models.RentLease.user_id == current_user.id,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Rent tenant not found")
    db.delete(tenant)
    db.commit()
    return {"message": "Rent tenant deleted"}


@router.get("/leases/{lease_id}/statement", response_model=api_schemas.RentMonthStatement)
@limiter.limit("20/minute")
def get_rent_statement(
    request: Request,
    lease_id: int,
    month: date = Query(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    return _build_statement(db, lease, month)


@router.get("/leases/{lease_id}/statement-export")
@limiter.limit("10/minute")
def export_rent_statement(
    request: Request,
    lease_id: int,
    month: date = Query(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    statement = _build_statement(db, lease, month)
    pdf_buffer = _build_rent_statement_pdf(db, lease, statement)
    filename = _format_rent_statement_filename(lease.location.name, statement.month)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.put("/leases/{lease_id}/month", response_model=api_schemas.RentMonthStatement)
def upsert_rent_month(
    lease_id: int,
    payload: api_schemas.RentMonthUpsert,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    month_value = _month_start(payload.month)
    tenant_ids = {tenant.id for tenant in lease.tenants}
    room_ids = {room.id for room in lease.rooms}

    for config in payload.tenant_configs:
        if config.tenant_id not in tenant_ids:
            raise HTTPException(status_code=400, detail="Tenant does not belong to this lease")
        if config.room_id is not None and config.room_id not in room_ids:
            raise HTTPException(status_code=400, detail="Room does not belong to this lease")

    for usage in payload.room_usages:
        if usage.room_id not in room_ids:
            raise HTTPException(status_code=400, detail="Room does not belong to this lease")
    for usage in payload.room_energy_usages:
        if usage.room_id not in room_ids:
            raise HTTPException(status_code=400, detail="Room does not belong to this lease")

    rent_month = db.query(database_models.RentMonth).options(
        joinedload(database_models.RentMonth.tenant_configs),
        joinedload(database_models.RentMonth.room_usages),
        joinedload(database_models.RentMonth.room_energy_usages),
    ).filter(
        database_models.RentMonth.lease_id == lease.id,
        database_models.RentMonth.month == month_value,
    ).first()

    if not rent_month:
        rent_month = database_models.RentMonth(lease_id=lease.id, month=month_value)
        db.add(rent_month)
        db.flush()

    rent_month.notes = payload.notes
    for row in list(rent_month.tenant_configs):
        db.delete(row)
    for row in list(rent_month.room_usages):
        db.delete(row)
    for row in list(rent_month.room_energy_usages):
        db.delete(row)
    db.flush()

    for config in payload.tenant_configs:
        db.add(database_models.RentMonthTenant(
            rent_month_id=rent_month.id,
            tenant_id=config.tenant_id,
            room_id=config.room_id,
            is_active=config.is_active,
            pays_rent=config.pays_rent,
            pays_utilities=config.pays_utilities,
            rent_amount=config.rent_amount,
            other_adjustment=config.other_adjustment,
            other_adjustment_note=config.other_adjustment_note,
        ))

    for usage in payload.room_usages:
        db.add(database_models.RentRoomUsage(
            rent_month_id=rent_month.id,
            room_id=usage.room_id,
            usage_value=usage.usage_value,
        ))

    for usage in payload.room_energy_usages:
        db.add(database_models.RentRoomEnergyUsage(
            rent_month_id=rent_month.id,
            room_id=usage.room_id,
            usage_kwh=usage.usage_kwh,
        ))

    db.commit()
    return _build_statement(db, lease, month_value)


@router.post("/leases/{lease_id}/payments", response_model=api_schemas.RentPayment)
def create_rent_payment(
    lease_id: int,
    payload: api_schemas.RentPaymentCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    tenant_ids = {tenant.id for tenant in lease.tenants}
    if payload.tenant_id not in tenant_ids:
        raise HTTPException(status_code=400, detail="Tenant does not belong to this lease")
    payment = database_models.RentPayment(
        lease_id=lease_id,
        tenant_id=payload.tenant_id,
        month=_month_start(payload.month),
        payment_date=payload.payment_date,
        amount=payload.amount,
        notes=payload.notes,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return db.query(database_models.RentPayment).options(
        joinedload(database_models.RentPayment.tenant).joinedload(database_models.RentTenant.default_room)
    ).filter(database_models.RentPayment.id == payment.id).first()


@router.delete("/payments/{payment_id}")
def delete_rent_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    payment = db.query(database_models.RentPayment).join(
        database_models.RentLease, database_models.RentLease.id == database_models.RentPayment.lease_id
    ).filter(
        database_models.RentPayment.id == payment_id,
        database_models.RentLease.user_id == current_user.id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Rent payment not found")
    db.delete(payment)
    db.commit()
    return {"message": "Rent payment deleted"}
