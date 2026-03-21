from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas

router = APIRouter()

@router.get("/", response_model=List[api_schemas.Provider])
def read_providers(db: Session = Depends(get_db)):
    return db.query(database_models.Provider).all()

@router.post("/", response_model=api_schemas.Provider)
def create_provider(provider: api_schemas.ProviderCreate, db: Session = Depends(get_db)):
    db_provider = database_models.Provider(**provider.dict())
    db.add(db_provider)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.post("/seed")
def seed_providers(db: Session = Depends(get_db)):
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
