from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.domain_logic import build_forecast, compute_budget_statuses, generate_invoice_alerts

router = APIRouter()


def build_summary(db: Session, current_user: database_models.User):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.user_id == current_user.id
    ).all()
    alerts = db.query(database_models.Alert).filter(
        database_models.Alert.user_id == current_user.id,
        database_models.Alert.is_read == False,
    ).count()
    today = datetime.now(timezone.utc).date()
    overdue = [inv for inv in invoices if inv.status != "paid" and inv.due_date and inv.due_date < today]
    total = sum(inv.amount for inv in invoices)
    unpaid_total = sum(inv.amount for inv in invoices if inv.status != "paid")
    months = max(1, len({inv.invoice_date.strftime("%Y-%m") for inv in invoices}) if invoices else 1)
    return api_schemas.AnalyticsSummary(
        total_spend=round(total, 2),
        invoice_count=len(invoices),
        overdue_invoices=len(overdue),
        needs_review_count=len([inv for inv in invoices if inv.needs_review]),
        active_alerts=alerts,
        unpaid_total=round(unpaid_total, 2),
        avg_monthly_spend=round(total / months, 2),
    )


@router.get("/summary", response_model=api_schemas.AnalyticsSummary)
def analytics_summary(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    compute_budget_statuses(db, current_user)
    generate_invoice_alerts(db, current_user)
    db.commit()
    return build_summary(db, current_user)


@router.get("/report", response_model=api_schemas.ReportBundle)
def analytics_report(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    budget_statuses = compute_budget_statuses(db, current_user)
    generate_invoice_alerts(db, current_user)
    db.commit()
    alerts = db.query(database_models.Alert).filter(
        database_models.Alert.user_id == current_user.id
    ).order_by(database_models.Alert.created_at.desc()).limit(10).all()
    return api_schemas.ReportBundle(
        summary=build_summary(db, current_user),
        budget_statuses=budget_statuses,
        alerts=alerts,
        forecast=build_forecast(db, current_user),
    )
