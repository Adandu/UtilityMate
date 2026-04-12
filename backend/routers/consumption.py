from collections import defaultdict
from datetime import date
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.domain_logic import generate_consumption_alert
from ..utils.meter_import import normalize_location_name, parse_meter_workbook

router = APIRouter()


def _stream_key(index: database_models.ConsumptionIndex) -> Tuple[int, int, str]:
    return (index.location_id, index.category_id, index.meter_label or "")


def _resolve_category(
    db: Session,
    category_id: int,
    current_user: database_models.User,
) -> database_models.Category:
    category = db.query(database_models.Category).filter(
        database_models.Category.id == category_id,
        (database_models.Category.user_id == current_user.id) | (database_models.Category.user_id.is_(None)),
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _resolve_category_by_name(
    db: Session,
    category_name: str,
    current_user: database_models.User,
) -> database_models.Category:
    normalized = category_name.strip().lower()
    candidates = db.query(database_models.Category).filter(
        (database_models.Category.user_id == current_user.id) | (database_models.Category.user_id.is_(None))
    ).all()

    for category in candidates:
        if (category.name or "").strip().lower() == normalized and category.user_id == current_user.id:
            return category
    for category in candidates:
        if (category.name or "").strip().lower() == normalized:
            return category

    synonyms = {
        "energy": ("electricity",),
        "heating": ("heat",),
    }
    for alias in synonyms.get(normalized, ()):
        for category in candidates:
            if (category.name or "").strip().lower() == alias and category.user_id == current_user.id:
                return category
        for category in candidates:
            if (category.name or "").strip().lower() == alias:
                return category

    raise HTTPException(status_code=404, detail=f"Category '{category_name}' is missing from Configuration")


def _resolve_location_by_key(
    db: Session,
    location_key: str,
    current_user: database_models.User,
) -> database_models.Location:
    locations = db.query(database_models.Location).filter(
        database_models.Location.user_id == current_user.id
    ).all()
    for location in locations:
        if normalize_location_name(location.name) == location_key:
            return location
    raise HTTPException(status_code=404, detail=f"Location mapping failed for workbook key '{location_key}'")


def _load_candidate_invoices(
    db: Session,
    current_user: database_models.User,
    readings: List[database_models.ConsumptionIndex],
) -> Dict[Tuple[int, int], List[database_models.Invoice]]:
    location_ids = sorted({reading.location_id for reading in readings})
    category_ids = sorted({reading.category_id for reading in readings})
    if not location_ids or not category_ids:
        return {}

    invoices = db.query(database_models.Invoice).options(
        joinedload(database_models.Invoice.provider).joinedload(database_models.Provider.category),
        joinedload(database_models.Invoice.location),
    ).filter(
        database_models.Invoice.user_id == current_user.id,
        database_models.Invoice.location_id.in_(location_ids),
    ).all()

    lookup: Dict[Tuple[int, int], List[database_models.Invoice]] = {}
    for invoice in invoices:
        provider_category_id = invoice.provider.category_id if invoice.provider else None
        if provider_category_id not in category_ids:
            continue
        lookup.setdefault((invoice.location_id, provider_category_id), []).append(invoice)

    for candidates in lookup.values():
        candidates.sort(key=lambda invoice: invoice.invoice_date)
    return lookup


def _find_linked_invoice(
    reading: database_models.ConsumptionIndex,
    invoice_lookup: Dict[Tuple[int, int], List[database_models.Invoice]],
) -> Optional[database_models.Invoice]:
    candidates = invoice_lookup.get((reading.location_id, reading.category_id), [])
    if not candidates:
        return None

    same_month = [
        invoice for invoice in candidates
        if invoice.invoice_date.year == reading.reading_date.year and invoice.invoice_date.month == reading.reading_date.month
    ]
    if same_month:
        return min(same_month, key=lambda invoice: abs((invoice.invoice_date - reading.reading_date).days))

    nearby = [
        invoice for invoice in candidates
        if abs((invoice.invoice_date - reading.reading_date).days) <= 45
    ]
    if nearby:
        return min(nearby, key=lambda invoice: abs((invoice.invoice_date - reading.reading_date).days))

    return None


def _serialize_readings(
    readings: List[database_models.ConsumptionIndex],
    invoice_lookup: Dict[Tuple[int, int], List[database_models.Invoice]],
) -> List[api_schemas.ConsumptionReading]:
    previous_by_stream: Dict[Tuple[int, int, str], Optional[float]] = {}
    serialized: Dict[int, api_schemas.ConsumptionReading] = {}

    for reading in sorted(readings, key=lambda item: (item.location_id, item.category_id, item.meter_label or "", item.reading_date, item.created_at, item.id)):
        stream = _stream_key(reading)
        previous_value = previous_by_stream.get(stream)
        delta_value = None if previous_value is None else round(reading.value - previous_value, 3)
        previous_by_stream[stream] = reading.value
        linked_invoice = _find_linked_invoice(reading, invoice_lookup)

        serialized[reading.id] = api_schemas.ConsumptionReading.model_validate(reading, from_attributes=True).model_copy(
            update={
                "previous_value": previous_value,
                "delta_value": delta_value,
                "linked_invoice": api_schemas.ConsumptionLinkedInvoice.model_validate(linked_invoice, from_attributes=True) if linked_invoice else None,
            }
        )

    ordered_ids = [reading.id for reading in readings]
    return [serialized[index_id] for index_id in ordered_ids]


@router.get("/", response_model=api_schemas.ConsumptionReadingListResponse)
def read_consumption_indexes(
    skip: int = 0,
    limit: int = 250,
    location_id: Optional[int] = None,
    category_id: Optional[int] = None,
    meter_label: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    query = db.query(database_models.ConsumptionIndex).options(
        joinedload(database_models.ConsumptionIndex.location),
        joinedload(database_models.ConsumptionIndex.category),
    ).filter(
        database_models.ConsumptionIndex.user_id == current_user.id
    )

    if location_id is not None:
        query = query.filter(database_models.ConsumptionIndex.location_id == location_id)
    if category_id is not None:
        query = query.filter(database_models.ConsumptionIndex.category_id == category_id)
    if meter_label:
        query = query.filter(database_models.ConsumptionIndex.meter_label == meter_label.strip())

    total = query.count()
    readings = query.order_by(
        database_models.ConsumptionIndex.reading_date.desc(),
        database_models.ConsumptionIndex.created_at.desc(),
        database_models.ConsumptionIndex.id.desc(),
    ).offset(skip).limit(limit).all()

    invoice_lookup = _load_candidate_invoices(db, current_user, readings)
    items = _serialize_readings(readings, invoice_lookup)
    return api_schemas.ConsumptionReadingListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/streams", response_model=api_schemas.ConsumptionStreamListResponse)
def read_consumption_streams(
    location_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    query = db.query(database_models.ConsumptionIndex).options(
        joinedload(database_models.ConsumptionIndex.location),
        joinedload(database_models.ConsumptionIndex.category),
    ).filter(
        database_models.ConsumptionIndex.user_id == current_user.id
    )

    if location_id is not None:
        query = query.filter(database_models.ConsumptionIndex.location_id == location_id)
    if category_id is not None:
        query = query.filter(database_models.ConsumptionIndex.category_id == category_id)

    readings = query.order_by(
        database_models.ConsumptionIndex.location_id.asc(),
        database_models.ConsumptionIndex.category_id.asc(),
        database_models.ConsumptionIndex.meter_label.asc(),
        database_models.ConsumptionIndex.reading_date.asc(),
        database_models.ConsumptionIndex.created_at.asc(),
        database_models.ConsumptionIndex.id.asc(),
    ).all()

    invoice_lookup = _load_candidate_invoices(db, current_user, readings)
    previous_by_stream: Dict[Tuple[int, int, str], Optional[float]] = {}
    streams: Dict[Tuple[int, int, str], api_schemas.ConsumptionStreamSummary] = {}

    for reading in readings:
        stream = _stream_key(reading)
        previous_value = previous_by_stream.get(stream)
        delta_value = None if previous_value is None else round(reading.value - previous_value, 3)
        previous_by_stream[stream] = reading.value

        if stream not in streams:
            streams[stream] = api_schemas.ConsumptionStreamSummary(
                location_id=reading.location_id,
                category_id=reading.category_id,
                meter_label=reading.meter_label or "",
                location=api_schemas.LocationSimple.model_validate(reading.location, from_attributes=True) if reading.location else None,
                category=api_schemas.Category.model_validate(reading.category, from_attributes=True) if reading.category else None,
                reading_count=0,
                latest_reading_date=None,
                latest_value=None,
                latest_delta=None,
                linked_invoice=None,
            )

        summary = streams[stream]
        summary.reading_count += 1
        summary.latest_reading_date = reading.reading_date
        summary.latest_value = reading.value
        summary.latest_delta = delta_value
        linked_invoice = _find_linked_invoice(reading, invoice_lookup)
        summary.linked_invoice = api_schemas.ConsumptionLinkedInvoice.model_validate(linked_invoice, from_attributes=True) if linked_invoice else None

    ordered_streams = sorted(
        streams.values(),
        key=lambda item: (
            item.location.name if item.location else "",
            item.category.name if item.category else "",
            item.meter_label,
        ),
    )
    return api_schemas.ConsumptionStreamListResponse(items=ordered_streams)


@router.post("/", response_model=api_schemas.ConsumptionIndex)
def create_consumption_index(
    index: api_schemas.ConsumptionIndexCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    location = db.query(database_models.Location).filter(
        database_models.Location.id == index.location_id,
        database_models.Location.user_id == current_user.id,
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    _resolve_category(db, index.category_id, current_user)

    db_index = database_models.ConsumptionIndex(**index.model_dump(), user_id=current_user.id)
    db.add(db_index)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A reading already exists for this meter stream on that date")
    db.refresh(db_index)
    generate_consumption_alert(db, current_user, db_index)
    db.commit()
    return db_index


@router.patch("/{index_id}", response_model=api_schemas.ConsumptionIndex)
def update_consumption_index(
    index_id: int,
    index_update: api_schemas.ConsumptionIndexUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    index = db.query(database_models.ConsumptionIndex).filter(
        database_models.ConsumptionIndex.id == index_id,
        database_models.ConsumptionIndex.user_id == current_user.id,
    ).first()
    if not index:
        raise HTTPException(status_code=404, detail="Consumption index not found")

    update_data = index_update.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"] is not None:
        _resolve_category(db, update_data["category_id"], current_user)

    for key, value in update_data.items():
        setattr(index, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A reading already exists for this meter stream on that date")
    db.refresh(index)
    return index


@router.delete("/{index_id}")
def delete_consumption_index(
    index_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    index = db.query(database_models.ConsumptionIndex).filter(
        database_models.ConsumptionIndex.id == index_id,
        database_models.ConsumptionIndex.user_id == current_user.id,
    ).first()
    if not index:
        raise HTTPException(status_code=404, detail="Consumption index not found")
    db.delete(index)
    db.commit()
    return {"message": "Consumption index deleted"}


@router.post("/import/excel", response_model=api_schemas.ConsumptionImportResponse)
async def import_consumption_indexes_from_excel(
    file: UploadFile = File(...),
    replace_existing_excel: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    filename = file.filename or "meter-readings.xlsx"
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx workbook")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded workbook is empty")

    try:
        parsed_readings = parse_meter_workbook(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Workbook could not be parsed: {exc}")

    if not parsed_readings:
        raise HTTPException(status_code=400, detail="No supported meter readings were found in AP 12 / AP 15")

    grouped_results: Dict[Tuple[str, str, str, str], Dict[str, int]] = defaultdict(lambda: {"imported": 0, "updated": 0, "skipped": 0})
    imported_total = 0
    updated_total = 0
    skipped_total = 0

    for parsed in parsed_readings:
        location = _resolve_location_by_key(db, parsed.location_key, current_user)
        category = _resolve_category_by_name(db, parsed.category_name, current_user)
        result_key = (parsed.worksheet_name, location.name, category.name, parsed.meter_label)

        existing = db.query(database_models.ConsumptionIndex).filter(
            database_models.ConsumptionIndex.user_id == current_user.id,
            database_models.ConsumptionIndex.location_id == location.id,
            database_models.ConsumptionIndex.category_id == category.id,
            database_models.ConsumptionIndex.meter_label == parsed.meter_label,
            database_models.ConsumptionIndex.reading_date == parsed.reading_date,
        ).first()

        if existing:
            if existing.source_type == "manual":
                grouped_results[result_key]["skipped"] += 1
                skipped_total += 1
                continue
            if existing.source_type == "excel_import" and not replace_existing_excel:
                grouped_results[result_key]["skipped"] += 1
                skipped_total += 1
                continue

            existing.value = parsed.value
            existing.notes = parsed.notes
            existing.source_type = "excel_import"
            grouped_results[result_key]["updated"] += 1
            updated_total += 1
            continue

        db.add(database_models.ConsumptionIndex(
            user_id=current_user.id,
            location_id=location.id,
            category_id=category.id,
            meter_label=parsed.meter_label,
            value=parsed.value,
            reading_date=parsed.reading_date,
            source_type="excel_import",
            notes=parsed.notes,
        ))
        grouped_results[result_key]["imported"] += 1
        imported_total += 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Workbook import created duplicate readings for the same stream/date")

    results = [
        api_schemas.ConsumptionImportResult(
            worksheet_name=worksheet_name,
            location_name=location_name,
            category_name=category_name,
            meter_label=meter_label,
            imported=stats["imported"],
            updated=stats["updated"],
            skipped=stats["skipped"],
        )
        for (worksheet_name, location_name, category_name, meter_label), stats in sorted(grouped_results.items())
    ]

    return api_schemas.ConsumptionImportResponse(
        filename=filename,
        imported_total=imported_total,
        updated_total=updated_total,
        skipped_total=skipped_total,
        results=results,
    )
