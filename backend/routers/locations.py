from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()

@router.get("/", response_model=List[api_schemas.Location])
def read_locations(db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return db.query(database_models.Location).filter(database_models.Location.user_id == current_user.id).all()

@router.post("/", response_model=api_schemas.Location)
def create_location(location: api_schemas.LocationCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_location = database_models.Location(**location.dict(), user_id=current_user.id)
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

@router.delete("/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_location = db.query(database_models.Location).filter(
        database_models.Location.id == location_id,
        database_models.Location.user_id == current_user.id
    ).first()
    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(db_location)
    db.commit()
    return {"message": "Location deleted"}
