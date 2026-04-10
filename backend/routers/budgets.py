from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

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


@router.post("/", response_model=api_schemas.Budget)
def create_budget(
    budget: api_schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    db_budget = database_models.Budget(**budget.model_dump(), user_id=current_user.id)
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
    for key, value in budget_update.model_dump(exclude_unset=True).items():
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
