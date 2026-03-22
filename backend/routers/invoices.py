from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timezone
import os
import shutil
import hashlib
import traceback
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils, parser
from ..utils.logging_config import logger

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "data/invoices")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB

def get_file_hash(file_content: bytes):
    return hashlib.sha256(file_content).hexdigest()

@router.get("/", response_model=List[api_schemas.Invoice])
def read_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return db.query(database_models.Invoice).options(
        joinedload(database_models.Invoice.provider).joinedload(database_models.Provider.category),
        joinedload(database_models.Invoice.location)
    ).filter(database_models.Invoice.user_id == current_user.id).order_by(database_models.Invoice.invoice_date.desc()).offset(skip).limit(limit).all()

from fastapi.responses import FileResponse

@router.get("/{invoice_id}/pdf")
def download_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.id == invoice_id,
        database_models.Invoice.user_id == current_user.id
    ).first()
    if not invoice or not invoice.pdf_path or not os.path.exists(invoice.pdf_path):
        raise HTTPException(status_code=404, detail="Invoice PDF not found")
    return FileResponse(invoice.pdf_path, media_type='application/pdf', filename=os.path.basename(invoice.pdf_path))

@router.post("/upload")
async def upload_invoices(
    location_id: int = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user)
):
    logger.info("Bulk upload request: %s files from %s", len(files), current_user.email)
    results = []
    available_providers = db.query(database_models.Provider).filter(
        or_(database_models.Provider.user_id == None, database_models.Provider.user_id == current_user.id)
    ).all()

    location = db.query(database_models.Location).filter(
        database_models.Location.id == location_id,
        database_models.Location.user_id == current_user.id
    ).first()
    
    if not location:
        logger.error("Upload failed: Location %s not found for user %s", location_id, current_user.email)
        raise HTTPException(status_code=404, detail="Selected location not found")

    for file in files:
        file_path = ""
        try:
            # 1. Validation: File extension
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                results.append({"filename": file.filename, "status": "error", "detail": "Only PDF files are allowed"})
                continue
            
            # 2. Validation: File size
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                results.append({"filename": file.filename, "status": "error", "detail": f"File too large ({len(content) // 1024}KB). Max 10MB."})
                continue
                
            if not content.startswith(b'%PDF'):
                results.append({"filename": file.filename, "status": "error", "detail": "Invalid PDF file content"})
                continue

            # 3. Duplicate check
            file_hash = get_file_hash(content)
            unique_filename = f"{current_user.id}_{file_hash}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            existing_invoice = db.query(database_models.Invoice).filter(database_models.Invoice.pdf_path == file_path).first()
            if existing_invoice:
                results.append({"filename": file.filename, "status": "error", "detail": "Invoice already exists in database"})
                continue

            # 4. Save for parsing
            with open(file_path, "wb") as buffer:
                buffer.write(content)

            # 5. Detect provider
            pdf_text = parser.InvoiceParser.get_pdf_text(file_path)
            if not pdf_text:
                results.append({"filename": file.filename, "status": "error", "detail": "Could not extract text from this PDF. Is it a scanned image?"})
                continue

            provider = parser.InvoiceParser.detect_provider(pdf_text, available_providers)
            if not provider:
                os.remove(file_path)
                results.append({"filename": file.filename, "status": "error", "detail": "Could not identify utility provider. Please add the provider to your config first."})
                continue

            # 6. Full parsing
            parsed_data = parser.InvoiceParser.parse_pdf(pdf_text, provider.name, location.name)
            
            # 7. Create record
            new_invoice = database_models.Invoice(
                user_id=current_user.id,
                location_id=location_id,
                provider_id=provider.id,
                invoice_date=parsed_data["invoice_date"] or datetime.now(timezone.utc).date(),
                amount=parsed_data["amount"],
                consumption_value=parsed_data["consumption_value"],
                pdf_path=file_path,
                currency="RON"
            )
            db.add(new_invoice)
            db.commit()
            db.refresh(new_invoice)
            
            results.append({"filename": file.filename, "status": "success", "id": new_invoice.id})
            logger.info("Invoice processed successfully: %s", file.filename)

        except Exception as e:
            logger.error("Error processing %s: %s", file.filename, str(e))
            if file_path and os.path.exists(file_path): 
                try: os.remove(file_path)
                except: pass
            results.append({"filename": file.filename, "status": "error", "detail": f"Processing error: {str(e)}"})

    return results

@router.patch("/{invoice_id}", response_model=api_schemas.Invoice)
def update_invoice(invoice_id: int, invoice_update: api_schemas.InvoiceUpdate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.id == invoice_id,
        database_models.Invoice.user_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    update_data = invoice_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(invoice, key, value)
        
    db.commit()
    db.refresh(invoice)
    
    return db.query(database_models.Invoice).options(
        joinedload(database_models.Invoice.provider).joinedload(database_models.Provider.category),
        joinedload(database_models.Invoice.location)
    ).filter(database_models.Invoice.id == invoice_id).first()

@router.patch("/bulk")
def bulk_update_invoices(
    invoice_ids: List[int], 
    invoice_update: api_schemas.InvoiceUpdate, 
    db: Session = Depends(get_db), 
    current_user: database_models.User = Depends(auth_utils.get_current_user)
):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.id.in_(invoice_ids),
        database_models.Invoice.user_id == current_user.id
    ).all()
    
    update_data = invoice_update.model_dump(exclude_unset=True)
    if not update_data:
        return {"message": "No updates provided"}
        
    for invoice in invoices:
        for key, value in update_data.items():
            setattr(invoice, key, value)
            
    db.commit()
    return {"message": f"Successfully updated {len(invoices)} invoices"}

@router.delete("/bulk")
def bulk_delete_invoices(
    invoice_ids: List[int], 
    db: Session = Depends(get_db), 
    current_user: database_models.User = Depends(auth_utils.get_current_user)
):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.id.in_(invoice_ids),
        database_models.Invoice.user_id == current_user.id
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
def delete_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.id == invoice_id,
        database_models.Invoice.user_id == current_user.id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        os.remove(invoice.pdf_path)
        
    db.delete(invoice)
    db.commit()
    return {"message": "Invoice deleted"}
