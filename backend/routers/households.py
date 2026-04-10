from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()


@router.get("/", response_model=List[api_schemas.Household])
def read_households(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    return db.query(database_models.Household).options(
        joinedload(database_models.Household.members)
    ).filter(database_models.Household.owner_user_id == current_user.id).all()


@router.post("/", response_model=api_schemas.Household)
def create_household(
    household: api_schemas.HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    db_household = database_models.Household(**household.model_dump(), owner_user_id=current_user.id)
    db.add(db_household)
    db.commit()
    db.refresh(db_household)
    owner_membership = database_models.HouseholdMember(
        household_id=db_household.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(owner_membership)
    db.commit()
    db.refresh(db_household)
    return db.query(database_models.Household).options(
        joinedload(database_models.Household.members)
    ).filter(database_models.Household.id == db_household.id).first()


@router.post("/{household_id}/members", response_model=api_schemas.HouseholdMember)
def add_household_member(
    household_id: int,
    member: api_schemas.HouseholdMemberCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    household = db.query(database_models.Household).filter(
        database_models.Household.id == household_id,
        database_models.Household.owner_user_id == current_user.id,
    ).first()
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    existing = db.query(database_models.HouseholdMember).filter(
        database_models.HouseholdMember.household_id == household_id,
        database_models.HouseholdMember.user_id == member.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Member already exists")
    db_member = database_models.HouseholdMember(
        household_id=household_id,
        user_id=member.user_id,
        role=member.role,
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member
