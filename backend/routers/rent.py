from collections import defaultdict
from datetime import date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _next_month(value: date) -> date:
    return date(value.year + (1 if value.month == 12 else 0), 1 if value.month == 12 else value.month + 1, 1)


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
        notes = existing_month.notes
    else:
        tenant_configs = {}
        room_usages = {}
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

    return notes, config_rows, usage_rows


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

    electricity_total = sum(float(invoice.amount or 0.0) for invoice in electricity_query.all())

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
        avizier_total=float(avizier_total),
        heating_total=float(heating_total),
        non_heating_utilities_total=float(non_heating_utilities_total),
    )


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
        ).filter(database_models.RentMonth.lease_id == lease.id).all()
    }

    notes, tenant_configs, room_usages = _get_or_build_month(lease, month_value, months_by_key.get(month_value))
    payments = db.query(database_models.RentPayment).options(
        joinedload(database_models.RentPayment.tenant)
    ).filter(
        database_models.RentPayment.lease_id == lease.id,
        database_models.RentPayment.month == month_value,
    ).order_by(database_models.RentPayment.payment_date.asc()).all()

    source_summary = _calculate_source_summary(db, lease, month_value)
    utility_payers = [config for config in tenant_configs if config.is_active and config.pays_utilities]
    utility_payer_count = len(utility_payers)
    electricity_per_payer = (source_summary.electricity_total / utility_payer_count) if utility_payer_count else 0.0
    shared_utilities_per_payer = (source_summary.non_heating_utilities_total / utility_payer_count) if utility_payer_count else 0.0

    room_usage_map = {usage.room_id: float(usage.usage_value) for usage in room_usages}
    room_tenant_map: Dict[int, List[int]] = defaultdict(list)
    for config in tenant_configs:
        if config.is_active and config.pays_utilities and config.room_id:
            room_tenant_map[config.room_id].append(config.tenant_id)

    total_usage = sum(value for value in room_usage_map.values() if value > 0)
    heating_by_tenant: Dict[int, float] = defaultdict(float)
    heating_mode = "equal"
    if source_summary.heating_total > 0 and total_usage > 0 and room_tenant_map:
        heating_mode = "room_usage"
        for room_id, usage_value in room_usage_map.items():
            if usage_value <= 0:
                continue
            tenant_ids = room_tenant_map.get(room_id, [])
            if not tenant_ids:
                continue
            room_share = source_summary.heating_total * (usage_value / total_usage)
            per_tenant_share = room_share / len(tenant_ids)
            for tenant_id in tenant_ids:
                heating_by_tenant[tenant_id] += per_tenant_share
    elif utility_payer_count:
        equal_heating = source_summary.heating_total / utility_payer_count
        for config in utility_payers:
            heating_by_tenant[config.tenant_id] = equal_heating

    payment_totals = defaultdict(float)
    for payment in payments:
        payment_totals[payment.tenant_id] += float(payment.amount or 0.0)

    ordered_months = sorted(set(months_by_key.keys()) | {month_value})
    balances: Dict[int, float] = defaultdict(float)
    statement_rows: List[api_schemas.RentTenantStatement] = []

    for current_month in ordered_months:
        _, current_configs, current_room_usages = _get_or_build_month(lease, current_month, months_by_key.get(current_month))
        current_sources = _calculate_source_summary(db, lease, current_month)
        current_utility_payers = [config for config in current_configs if config.is_active and config.pays_utilities]
        current_utility_payer_count = len(current_utility_payers)
        current_electricity_per_payer = (current_sources.electricity_total / current_utility_payer_count) if current_utility_payer_count else 0.0
        current_shared_per_payer = (current_sources.non_heating_utilities_total / current_utility_payer_count) if current_utility_payer_count else 0.0

        current_room_usage_map = {usage.room_id: float(usage.usage_value) for usage in current_room_usages}
        current_room_tenant_map: Dict[int, List[int]] = defaultdict(list)
        for config in current_configs:
            if config.is_active and config.pays_utilities and config.room_id:
                current_room_tenant_map[config.room_id].append(config.tenant_id)
        current_total_usage = sum(value for value in current_room_usage_map.values() if value > 0)
        current_heating_by_tenant: Dict[int, float] = defaultdict(float)
        if current_sources.heating_total > 0 and current_total_usage > 0 and current_room_tenant_map:
            for room_id, usage_value in current_room_usage_map.items():
                if usage_value <= 0:
                    continue
                tenant_ids = current_room_tenant_map.get(room_id, [])
                if not tenant_ids:
                    continue
                room_share = current_sources.heating_total * (usage_value / current_total_usage)
                per_tenant_share = room_share / len(tenant_ids)
                for tenant_id in tenant_ids:
                    current_heating_by_tenant[tenant_id] += per_tenant_share
        elif current_utility_payer_count:
            equal_heating = current_sources.heating_total / current_utility_payer_count
            for config in current_utility_payers:
                current_heating_by_tenant[config.tenant_id] = equal_heating

        current_payment_rows = db.query(database_models.RentPayment).filter(
            database_models.RentPayment.lease_id == lease.id,
            database_models.RentPayment.month == current_month,
        ).all()
        current_payment_totals = defaultdict(float)
        for payment in current_payment_rows:
            current_payment_totals[payment.tenant_id] += float(payment.amount or 0.0)

        current_rows: List[api_schemas.RentTenantStatement] = []
        for config in current_configs:
            electricity_amount = current_electricity_per_payer if (config.is_active and config.pays_utilities) else 0.0
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
                electricity_amount=float(electricity_amount),
                shared_utilities_amount=float(shared_utilities_amount),
                heating_amount=float(heating_amount),
                utilities_amount=float(utilities_amount),
                other_adjustment=float(config.other_adjustment),
                current_total=float(current_total),
                previous_balance=float(previous_balance),
                payments_in_month=float(payments_in_month),
                amount_due=float(amount_due),
            )
            current_rows.append(row)
            balances[config.tenant_id] = amount_due

        if current_month == month_value:
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
        heating_allocation_mode=heating_mode,
        tenant_configs=tenant_configs,
        room_usages=room_usages,
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
def get_rent_statement(
    lease_id: int,
    month: date = Query(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    lease = _get_owned_lease(db, current_user.id, lease_id)
    return _build_statement(db, lease, month)


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

    rent_month = db.query(database_models.RentMonth).options(
        joinedload(database_models.RentMonth.tenant_configs),
        joinedload(database_models.RentMonth.room_usages),
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
        ))

    for usage in payload.room_usages:
        db.add(database_models.RentRoomUsage(
            rent_month_id=rent_month.id,
            room_id=usage.room_id,
            usage_value=usage.usage_value,
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
