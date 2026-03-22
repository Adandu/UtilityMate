from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas

from ..utils import auth_utils

router = APIRouter()

@router.get("/", response_model=List[api_schemas.Provider])
def read_providers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(database_models.Provider).offset(skip).limit(limit).all()

@router.post("/", response_model=api_schemas.Provider)
def create_provider(provider: api_schemas.ProviderCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_provider = database_models.Provider(**provider.dict())
    db.add(db_provider)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.put("/{provider_id}", response_model=api_schemas.Provider)
def update_provider(provider_id: int, provider: api_schemas.ProviderCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_provider = db.query(database_models.Provider).filter(database_models.Provider.id == provider_id).first()
    if not db_provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    for key, value in provider.dict().items():
        setattr(db_provider, key, value)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.post("/seed")
def seed_providers(db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    providers_data = [
        {"category": "Electricity", "names": ["Hidroelectrica", "Enel", "Electrica Furnizare", "E.ON"]},
        {"category": "Gas", "names": ["ENGIE", "E.ON"]},
        {"category": "Water", "names": ["Apa Nova", "Compania de Apa"]},
        {"category": "Mobile", "names": ["Digi", "Orange", "Vodafone", "Telekom"]},
        {"category": "Internet", "names": ["Digi", "Orange", "Vodafone"]},
        {"category": "Maintenance", "names": ["Administratie Bloc"]}
    ]
    
    for entry in providers_data:
        category = db.query(database_models.Category).filter(database_models.Category.name == entry["category"]).first()
        if not category:
            continue
            
        for name in entry["names"]:
            if not db.query(database_models.Provider).filter(
                database_models.Provider.name == name,
                database_models.Provider.category_id == category.id
            ).first():
                db.add(database_models.Provider(name=name, category_id=category.id))
    
    db.commit()
    return {"message": "Providers seeded"}

@router.delete("/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_provider = db.query(database_models.Provider).filter(database_models.Provider.id == provider_id).first()
    if not db_provider:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    # Guardrail: Check for associated invoices
    invoices_count = db.query(database_models.Invoice).filter(database_models.Invoice.provider_id == provider_id).count()
    if invoices_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete provider: it has associated invoices. Please delete the invoices first.")
        
    db.delete(db_provider)
    db.commit()
    return {"message": "Provider deleted"}
