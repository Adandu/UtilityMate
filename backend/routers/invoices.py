from datetime import datetime, timezone
import asyncio
import csv
import io
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils, parser, file_utils
from ..utils.domain_logic import create_alert
from ..utils.logging_config import logger
from ..utils.rate_limiter import limiter

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "data/invoices")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024


# Sane bounds used purely to flag parsed data for review, not to reject an upload.
# Household utility bills in this app are RON-denominated; 100,000 RON is generously
# above the scale of any real invoice while still catching obvious parse errors
# (e.g. a meter serial number or misplaced digit group being read as the amount).
MAX_PLAUSIBLE_AMOUNT = 100_000
MAX_INVOICE_AGE_DAYS = 365 * 2


def check_parsed_data_plausibility(parsed_data: dict) -> List[str]:
    """Return human-readable notes for parsed fields that are out of a sane range.

    This never raises/blocks the upload - it only signals that the field should be
    reviewed manually before being trusted.
    """
    notes: List[str] = []

    amount = parsed_data.get("amount")
    if amount is not None and (amount < 0 or amount > MAX_PLAUSIBLE_AMOUNT):
        notes.append("parsed amount out of expected range — please verify")

    invoice_date = parsed_data.get("invoice_date")
    if invoice_date is not None:
        today = datetime.now(timezone.utc).date()
        if invoice_date > today or (today - invoice_date).days > MAX_INVOICE_AGE_DAYS:
            notes.append("parsed invoice date out of expected range — please verify")

    return notes


def detect_review_state(parsed_data: dict):
    confidence = 0.25
    if parsed_data.get("invoice_date"):
        confidence += 0.35
    if parsed_data.get("amount", 0) > 0:
        confidence += 0.3
    if parsed_data.get("consumption_value") not in (None, 0):
        confidence += 0.1
    confidence = min(confidence, 0.99)
    needs_review = confidence < 0.75 or parsed_data.get("amount", 0) <= 0

    # A missing invoice_date always defaults to "today" downstream; that default
    # must never be silently trusted, so force review explicitly rather than
    # relying only on the confidence formula above.
    if not parsed_data.get("invoice_date"):
        needs_review = True

    plausibility_notes = check_parsed_data_plausibility(parsed_data)
    if plausibility_notes:
        needs_review = True
        confidence = min(confidence, 0.4)

    return confidence, needs_review, plausibility_notes


def infer_review_state(invoice: database_models.Invoice):
    parsed_data = {
        "invoice_date": invoice.invoice_date,
        "amount": invoice.amount,
        "consumption_value": invoice.consumption_value,
    }
    confidence, needs_review, _plausibility_notes = detect_review_state(parsed_data)
    if invoice.status in {"reviewed", "paid"}:
        needs_review = False
        confidence = max(confidence, 0.9)
    return confidence, needs_review


def invoice_response(invoice: database_models.Invoice) -> api_schemas.Invoice:
    serialized = api_schemas.Invoice.model_validate(invoice, from_attributes=True)
    if invoice.parse_confidence not in (None, 0, 0.0):
        return serialized

    confidence, needs_review = infer_review_state(invoice)
    if invoice.review_notes and invoice.review_notes.strip():
        needs_review = False
    elif invoice.status in {"reviewed", "paid"}:
        needs_review = False
    return serialized.model_copy(
        update={
            "parse_confidence": confidence,
            "needs_review": needs_review,
        }
    )


def validate_invoice_relationships(
    db: Session,
    current_user: database_models.User,
    location_id: Optional[int] = None,
    provider_id: Optional[int] = None,
):
    if location_id is not None:
        location = db.query(database_models.Location).filter(
            database_models.Location.id == location_id,
            database_models.Location.user_id == current_user.id,
        ).first()
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    if provider_id is not None:
        provider = db.query(database_models.Provider).filter(
            database_models.Provider.id == provider_id,
            or_(
                database_models.Provider.user_id == None,
                database_models.Provider.user_id == current_user.id,
            ),
        ).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")


def invoice_query(db: Session, current_user: database_models.User):
    return db.query(database_models.Invoice).options(
        joinedload(database_models.Invoice.provider).joinedload(database_models.Provider.category),
        joinedload(database_models.Invoice.location),
    ).filter(database_models.Invoice.user_id == current_user.id)


@router.get("/", response_model=api_schemas.InvoiceListResponse)
def read_invoices(
    skip: int = 0,
    limit: int = 100,
    needs_review: Optional[bool] = None,
    status: Optional[str] = None,
    location_id: Optional[int] = None,
    provider_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    query = invoice_query(db, current_user)
    if needs_review is not None:
        query = query.filter(database_models.Invoice.needs_review == needs_review)
    if status:
        query = query.filter(database_models.Invoice.status == status)
    if location_id is not None:
        query = query.filter(database_models.Invoice.location_id == location_id)
    if provider_id is not None:
        query = query.filter(database_models.Invoice.provider_id == provider_id)
    total = query.count()
    invoices = query.order_by(database_models.Invoice.invoice_date.desc(), database_models.Invoice.id.desc()).offset(skip).limit(limit).all()
    response_items = [invoice_response(invoice) for invoice in invoices]
    return api_schemas.InvoiceListResponse(
        items=response_items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/review-queue", response_model=List[api_schemas.Invoice])
def review_queue(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    invoices = invoice_query(db, current_user).filter(
        database_models.Invoice.needs_review == True
    ).order_by(database_models.Invoice.created_at.desc()).all()
    return [invoice_response(invoice) for invoice in invoices]


@router.get("/export")
@limiter.limit("10/minute")
def export_invoices(
    request: Request,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    rows = invoice_query(db, current_user).order_by(database_models.Invoice.invoice_date.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "invoice_id",
        "invoice_date",
        "due_date",
        "location",
        "category",
        "provider",
        "amount",
        "currency",
        "consumption_value",
        "status",
        "paid_at",
        "payment_reference",
        "parse_confidence",
        "needs_review",
    ])
    for inv in rows:
        writer.writerow([
            inv.id,
            inv.invoice_date,
            inv.due_date or "",
            inv.location.name if inv.location else "",
            inv.provider.category.name if inv.provider and inv.provider.category else "",
            inv.provider.name if inv.provider else "",
            inv.amount,
            inv.currency,
            inv.consumption_value or "",
            inv.status,
            inv.paid_at.isoformat() if inv.paid_at else "",
            inv.payment_reference or "",
            inv.parse_confidence,
            inv.needs_review,
        ])
    output.seek(0)
    filename = f"utilitymate_invoices_{datetime.now(timezone.utc).date()}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{invoice_id}/pdf")
def download_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.id == invoice_id,
        database_models.Invoice.user_id == current_user.id,
    ).first()
    if not invoice or not invoice.pdf_path or not os.path.exists(invoice.pdf_path):
        raise HTTPException(status_code=404, detail="Invoice PDF not found")
    return FileResponse(invoice.pdf_path, media_type="application/pdf", filename=os.path.basename(invoice.pdf_path))


@router.post("/upload")
@limiter.limit("5/minute")
async def upload_invoices(
    request: Request,
    location_id: int = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    logger.info("Bulk upload request: %s files from %s", len(files), current_user.email)
    results = []
    available_providers = db.query(database_models.Provider).filter(
        or_(database_models.Provider.user_id == None, database_models.Provider.user_id == current_user.id)
    ).all()

    location = db.query(database_models.Location).filter(
        database_models.Location.id == location_id,
        database_models.Location.user_id == current_user.id,
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Selected location not found")

    for file in files:
        file_path = ""
        try:
            saved_path, _content, _file_hash = await file_utils.save_and_validate_upload(
                file,
                UPLOAD_DIR,
                ALLOWED_EXTENSIONS,
                MAX_FILE_SIZE,
                filename_builder=lambda h, e: f"{current_user.id}_{location_id}_{h}{e}",
                invalid_extension_detail="Only PDF files are allowed",
                invalid_content_detail="Invalid PDF file content",
            )
            file_path = str(saved_path)

            existing_invoice = db.query(database_models.Invoice).filter(
                database_models.Invoice.pdf_path == file_path
            ).first()
            if existing_invoice:
                os.remove(file_path)
                file_path = ""
                results.append({"filename": file.filename, "status": "error", "detail": "Invoice already exists in database"})
                continue

            pdf_text = await asyncio.to_thread(parser.InvoiceParser.get_pdf_text, file_path)
            if not pdf_text:
                os.remove(file_path)
                results.append({"filename": file.filename, "status": "error", "detail": "Could not extract text from this PDF. Please upload a machine-readable PDF."})
                continue

            provider = parser.InvoiceParser.detect_provider(pdf_text, available_providers)
            if not provider:
                os.remove(file_path)
                results.append({"filename": file.filename, "status": "error", "detail": "Could not identify utility provider. Please add the provider to your config first."})
                continue

            parsed_data = await asyncio.to_thread(parser.InvoiceParser.parse_pdf, pdf_text, provider.name, location.name)
            confidence, needs_review, plausibility_notes = detect_review_state(parsed_data)
            review_notes = "; ".join(plausibility_notes) if plausibility_notes else None

            new_invoice = database_models.Invoice(
                user_id=current_user.id,
                location_id=location_id,
                provider_id=provider.id,
                invoice_date=parsed_data["invoice_date"] or datetime.now(timezone.utc).date(),
                billing_period_start=parsed_data.get("billing_period_start"),
                billing_period_end=parsed_data.get("billing_period_end"),
                amount=parsed_data["amount"],
                consumption_value=parsed_data["consumption_value"],
                meter_index_old=parsed_data.get("meter_index_old"),
                meter_index_new=parsed_data.get("meter_index_new"),
                pdf_path=file_path,
                currency=parsed_data.get("currency", "RON"),
                due_date=parsed_data.get("due_date"),
                parse_confidence=confidence,
                needs_review=needs_review,
                review_notes=review_notes,
                source_type="pdf",
                source_name=file.filename,
                processing_notes="Review recommended" if needs_review else "Parsed automatically",
            )
            db.add(new_invoice)
            db.commit()
            db.refresh(new_invoice)
            if needs_review:
                create_alert(
                    db,
                    current_user.id,
                    "review",
                    "medium",
                    "Invoice needs review",
                    f"{file.filename} was imported with {confidence * 100:.0f}% confidence.",
                )
                db.commit()
            results.append({
                "filename": file.filename,
                "status": "success",
                "id": new_invoice.id,
                "provider_name": provider.name,
                "invoice_date": str(new_invoice.invoice_date),
                "amount": new_invoice.amount,
                "currency": new_invoice.currency,
                "parse_confidence": confidence,
                "needs_review": needs_review,
                "detail": "; ".join(plausibility_notes) if plausibility_notes else (
                    "Imported successfully" if not needs_review else "Imported and queued for review"
                ),
            })
        except Exception as e:
            logger.error("Error processing %s: %s", file.filename, str(e))
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            error_detail = "Processing error. Please verify the PDF contents and try again."
            if isinstance(e, HTTPException):
                error_detail = str(e.detail)
            elif isinstance(e, RateLimitExceeded):
                error_detail = "Upload rate limit exceeded. Please wait before trying again."
            results.append({"filename": file.filename, "status": "error", "detail": error_detail})

    return results


@router.patch("/bulk")
def bulk_update_invoices(
    bulk_update: api_schemas.InvoiceBulkUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.id.in_(bulk_update.invoice_ids),
        database_models.Invoice.user_id == current_user.id,
    ).all()

    update_data = bulk_update.update_data.model_dump(exclude_unset=True)
    if not update_data:
        return {"message": "No updates provided"}

    validate_invoice_relationships(
        db,
        current_user,
        location_id=update_data.get("location_id"),
        provider_id=update_data.get("provider_id"),
    )

    for invoice in invoices:
        for key, value in update_data.items():
            setattr(invoice, key, value)
    db.commit()
    return {"message": f"Successfully updated {len(invoices)} invoices"}


@router.patch("/{invoice_id}", response_model=api_schemas.Invoice)
def update_invoice(
    invoice_id: int,
    invoice_update: api_schemas.InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.id == invoice_id,
        database_models.Invoice.user_id == current_user.id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = invoice_update.model_dump(exclude_unset=True)
    validate_invoice_relationships(
        db,
        current_user,
        location_id=update_data.get("location_id"),
        provider_id=update_data.get("provider_id"),
    )
    if update_data.get("status") == "paid" and not update_data.get("paid_at"):
        update_data["paid_at"] = datetime.now(timezone.utc)
    if update_data.get("needs_review") is False and not update_data.get("review_notes"):
        update_data["review_notes"] = "Reviewed manually"

    for key, value in update_data.items():
        setattr(invoice, key, value)

    db.commit()
    db.refresh(invoice)
    return invoice_query(db, current_user).filter(database_models.Invoice.id == invoice_id).first()


@router.delete("/bulk")
def bulk_delete_invoices(
    invoice_ids: List[int],
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.id.in_(invoice_ids),
        database_models.Invoice.user_id == current_user.id,
    ).all()
    deleted_count = 0
    for invoice in invoices:
        if invoice.pdf_path and os.path.exists(invoice.pdf_path):
            os.remove(invoice.pdf_path)
        db.delete(invoice)
        deleted_count += 1
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} invoices"}


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.id == invoice_id,
        database_models.Invoice.user_id == current_user.id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        os.remove(invoice.pdf_path)
    db.delete(invoice)
    db.commit()
    return {"message": "Invoice deleted"}
