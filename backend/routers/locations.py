from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()

@router.get("/", response_model=List[api_schemas.Location])
def read_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return db.query(database_models.Location).filter(database_models.Location.user_id == current_user.id).offset(skip).limit(limit).all()

@router.post("/", response_model=api_schemas.Location)
def create_location(location: api_schemas.LocationCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    if location.household_id is not None:
        household = db.query(database_models.Household).filter(
            database_models.Household.id == location.household_id,
            database_models.Household.owner_user_id == current_user.id
        ).first()
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
    db_location = database_models.Location(**location.model_dump(), user_id=current_user.id)
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

@router.put("/{location_id}", response_model=api_schemas.Location)
def update_location(location_id: int, location: api_schemas.LocationCreate, db: Session = Depends(get_db), current_user: database_models.User = Depends(auth_utils.get_current_user)):
    db_location = db.query(database_models.Location).filter(
        database_models.Location.id == location_id,
        database_models.Location.user_id == current_user.id
    ).first()
    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")
    if location.household_id is not None:
        household = db.query(database_models.Household).filter(
            database_models.Household.id == location.household_id,
            database_models.Household.owner_user_id == current_user.id
        ).first()
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")
    for key, value in location.model_dump().items():
        setattr(db_location, key, value)
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
    
    # Guardrail: Check for associated invoices
    invoices_count = db.query(database_models.Invoice).filter(database_models.Invoice.location_id == location_id).count()
    if invoices_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete location: it has associated invoices. Please delete the invoices first.")

    rent_leases_count = db.query(database_models.RentLease).filter(database_models.RentLease.location_id == location_id).count()
    if rent_leases_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete location: it is used by a rent workspace. Please delete the rent workspace first.")
        
    db.delete(db_location)
    db.commit()
    return {"message": "Location deleted"}
