from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()

@router.get("/", response_model=List[api_schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(database_models.Category).offset(skip).limit(limit).all()

@router.post("/", response_model=api_schemas.Category)
def create_category(category: api_schemas.CategoryCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_category = database_models.Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.post("/seed")
def seed_categories(db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    categories = [
        {"name": "Electricity", "unit": "kWh"},
        {"name": "Water", "unit": "m3"},
        {"name": "Gas", "unit": "m3"},
        {"name": "Mobile", "unit": "subscriptions"},
        {"name": "Internet", "unit": "subscriptions"},
        {"name": "Maintenance", "unit": "total"}
    ]
    for cat in categories:
        if not db.query(database_models.Category).filter(database_models.Category.name == cat["name"]).first():
            db.add(database_models.Category(**cat))
    db.commit()
    return {"message": "Categories seeded"}
