from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.domain_logic import compute_budget_statuses, generate_invoice_alerts

router = APIRouter()


@router.get("/", response_model=List[api_schemas.Alert])
def read_alerts(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    compute_budget_statuses(db, current_user)
    generate_invoice_alerts(db, current_user)
    db.commit()
    query = db.query(database_models.Alert).filter(database_models.Alert.user_id == current_user.id)
    if unread_only:
        query = query.filter(database_models.Alert.is_read == False)
    return query.order_by(database_models.Alert.created_at.desc()).all()


@router.post("/", response_model=api_schemas.Alert)
def create_alert(
    alert: api_schemas.AlertCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    db_alert = database_models.Alert(**alert.model_dump(), user_id=current_user.id)
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.patch("/{alert_id}/read")
def mark_alert_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    alert = db.query(database_models.Alert).filter(
        database_models.Alert.id == alert_id,
        database_models.Alert.user_id == current_user.id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"message": "Alert marked as read"}
