from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import os
import shutil
import hashlib
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils, parser

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "data/invoices")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024 # 5MB

def get_file_hash(file_content: bytes):
    return hashlib.sha256(file_content).hexdigest()

@router.get("/", response_model=List[api_schemas.Invoice])
def read_invoices(db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return db.query(database_models.Invoice).filter(database_models.Invoice.user_id == current_user.id).all()

@router.post("/upload")
async def upload_invoice(
    location_id: int = Form(...),
    provider_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user)
):
    # 1. Validation: File extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # 2. Validation: File size and magic bytes
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        
    if not content.startswith(b'%PDF'):
        raise HTTPException(status_code=400, detail="Invalid PDF file content")
    
    # 3. Validation: Provider/Location
    location = db.query(database_models.Location).filter(
        database_models.Location.id == location_id,
        database_models.Location.user_id == current_user.id
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
        
    provider = db.query(database_models.Provider).filter(database_models.Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # 4. Save file securely (using a unique hash-based name to prevent collisions/traversal)
    file_hash = get_file_hash(content)
    unique_filename = f"{current_user.id}_{file_hash}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Check for duplicate file (hash-based)
    existing_invoice = db.query(database_models.Invoice).filter(
        database_models.Invoice.user_id == current_user.id,
        database_models.Invoice.pdf_path == file_path
    ).first()
    if existing_invoice:
        raise HTTPException(status_code=400, detail="This invoice has already been uploaded")

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # 5. Parse file
    try:
        parsed_data = parser.InvoiceParser.parse_pdf(file_path, provider.name)
    except Exception as e:
        # Cleanup on failure
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to parse invoice: {str(e)}")
    
    # 6. Create invoice record
    new_invoice = database_models.Invoice(
        user_id=current_user.id,
        location_id=location_id,
        provider_id=provider_id,
        billing_date=parsed_data["billing_date"] or datetime.now(timezone.utc).date(),
        amount=parsed_data["amount"],
        consumption_value=parsed_data["consumption_value"],
        pdf_path=file_path,
        currency="RON"
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    
    return new_invoice

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
