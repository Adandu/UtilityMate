from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()

@router.get("/", response_model=List[api_schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return db.query(database_models.Category).filter(
        or_(database_models.Category.user_id == None, database_models.Category.user_id == current_user.id)
    ).offset(skip).limit(limit).all()

@router.post("/", response_model=api_schemas.Category)
def create_category(category: api_schemas.CategoryCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_category = database_models.Category(**category.dict(), user_id=current_user.id)
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
        if not db.query(database_models.Category).filter(database_models.Category.name == cat["name"], database_models.Category.user_id == None).first():
            db.add(database_models.Category(**cat, user_id=None))
    db.commit()
    return {"message": "Categories seeded"}

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_category = db.query(database_models.Category).filter(
        database_models.Category.id == category_id,
        database_models.Category.user_id == current_user.id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found or not authorized to delete")
        
    # Guardrail: Check for associated providers
    providers_count = db.query(database_models.Provider).filter(database_models.Provider.category_id == category_id).count()
    if providers_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete category: it has associated utility providers. Please delete the providers first.")
        
    db.delete(db_category)
    db.commit()
    return {"message": "Category deleted"}
