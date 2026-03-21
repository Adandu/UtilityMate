from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()

@router.get("/", response_model=List[api_schemas.ConsumptionIndex])
def read_consumption_indexes(db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return db.query(database_models.ConsumptionIndex).filter(database_models.ConsumptionIndex.user_id == current_user.id).all()

@router.post("/", response_model=api_schemas.ConsumptionIndex)
def create_consumption_index(index: api_schemas.ConsumptionIndexCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    # Check if location exists and belongs to user
    location = db.query(database_models.Location).filter(
        database_models.Location.id == index.location_id,
        database_models.Location.user_id == current_user.id
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
        
    db_index = database_models.ConsumptionIndex(**index.dict(), user_id=current_user.id)
    db.add(db_index)
    db.commit()
    db.refresh(db_index)
    return db_index

@router.delete("/{index_id}")
def delete_consumption_index(index_id: int, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    index = db.query(database_models.ConsumptionIndex).filter(
        database_models.ConsumptionIndex.id == index_id,
        database_models.ConsumptionIndex.user_id == current_user.id
    ).first()
    if not index:
        raise HTTPException(status_code=404, detail="Consumption index not found")
    db.delete(index)
    db.commit()
    return {"message": "Consumption index deleted"}
