from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.domain_logic import compute_budget_statuses

router = APIRouter()


@router.get("/", response_model=List[api_schemas.Budget])
def read_budgets(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    return db.query(database_models.Budget).options(
        joinedload(database_models.Budget.category),
        joinedload(database_models.Budget.location),
    ).filter(database_models.Budget.user_id == current_user.id).all()


@router.get("/status", response_model=List[api_schemas.BudgetStatus])
def read_budget_status(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    return compute_budget_statuses(db, current_user)


def validate_budget_relationships(
    db: Session,
    current_user: database_models.User,
    location_id: Optional[int] = None,
    household_id: Optional[int] = None,
):
    if location_id is not None:
        location = db.query(database_models.Location).filter(
            database_models.Location.id == location_id,
            database_models.Location.user_id == current_user.id,
        ).first()
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    if household_id is not None:
        household = db.query(database_models.Household).filter(
            database_models.Household.id == household_id,
            database_models.Household.owner_user_id == current_user.id,
        ).first()
        if not household:
            raise HTTPException(status_code=404, detail="Household not found")


@router.post("/", response_model=api_schemas.Budget)
def create_budget(
    budget: api_schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    budget_data = budget.model_dump()
    validate_budget_relationships(
        db,
        current_user,
        location_id=budget_data.get("location_id"),
        household_id=budget_data.get("household_id"),
    )
    db_budget = database_models.Budget(**budget_data, user_id=current_user.id)
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


@router.patch("/{budget_id}", response_model=api_schemas.Budget)
def update_budget(
    budget_id: int,
    budget_update: api_schemas.BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    budget = db.query(database_models.Budget).filter(
        database_models.Budget.id == budget_id,
        database_models.Budget.user_id == current_user.id,
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    update_data = budget_update.model_dump(exclude_unset=True)
    validate_budget_relationships(
        db,
        current_user,
        location_id=update_data.get("location_id"),
        household_id=update_data.get("household_id"),
    )
    for key, value in update_data.items():
        setattr(budget, key, value)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    budget = db.query(database_models.Budget).filter(
        database_models.Budget.id == budget_id,
        database_models.Budget.user_id == current_user.id,
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted"}
