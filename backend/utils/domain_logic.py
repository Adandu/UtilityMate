from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models import database_models


def create_alert(
    db: Session,
    user_id: int,
    category: str,
    severity: str,
    title: str,
    message: str,
    context_json: str | None = None,
):
    existing = db.query(database_models.Alert).filter(
        database_models.Alert.user_id == user_id,
        database_models.Alert.category == category,
        database_models.Alert.title == title,
        database_models.Alert.message == message,
        database_models.Alert.is_read == False,
    ).first()
    if existing:
        return existing

    alert = database_models.Alert(
        user_id=user_id,
        category=category,
        severity=severity,
        title=title,
        message=message,
        context_json=context_json,
    )
    db.add(alert)
    db.flush()
    return alert


def compute_budget_statuses(db: Session, current_user: database_models.User):
    budgets = db.query(database_models.Budget).filter(
        database_models.Budget.user_id == current_user.id,
        database_models.Budget.is_active == True,
    ).all()
    now = datetime.now(timezone.utc)
    month_start = now.date().replace(day=1)
    statuses = []

    for budget in budgets:
        query = db.query(database_models.Invoice).join(
            database_models.Provider, database_models.Invoice.provider_id == database_models.Provider.id
        ).filter(
            database_models.Invoice.user_id == current_user.id,
            database_models.Invoice.invoice_date >= month_start,
        )
        if budget.location_id:
            query = query.filter(database_models.Invoice.location_id == budget.location_id)
        query = query.filter(database_models.Provider.category_id == budget.category_id)
        spent = sum(inv.amount for inv in query.all())
        ratio = spent / budget.monthly_limit if budget.monthly_limit else 0
        remaining = budget.monthly_limit - spent
        status = "ok"
        if ratio >= 1:
            status = "exceeded"
        elif ratio >= budget.warning_threshold:
            status = "warning"
        statuses.append({
            "budget": budget,
            "spent": round(spent, 2),
            "remaining": round(remaining, 2),
            "usage_ratio": round(ratio, 3),
            "status": status,
        })
        if status == "exceeded":
            create_alert(
                db,
                current_user.id,
                "budget",
                "high",
                "Budget exceeded",
                f"Monthly budget '{budget.category.name if budget.category else budget.id}' exceeded by {abs(remaining):.2f} RON.",
            )
        elif status == "warning":
            create_alert(
                db,
                current_user.id,
                "budget",
                "medium",
                "Budget nearing limit",
                f"Monthly budget '{budget.category.name if budget.category else budget.id}' is at {ratio * 100:.0f}% of its limit.",
            )
    db.commit()
    return statuses


def generate_invoice_alerts(db: Session, current_user: database_models.User):
    today = datetime.now(timezone.utc).date()
    overdue_invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.user_id == current_user.id,
        database_models.Invoice.status != "paid",
        database_models.Invoice.due_date != None,
        database_models.Invoice.due_date < today,
    ).all()
    for invoice in overdue_invoices:
        create_alert(
            db,
            current_user.id,
            "invoice",
            "high",
            "Invoice overdue",
            f"Invoice #{invoice.id} for {invoice.amount:.2f} {invoice.currency} is overdue.",
        )


def generate_consumption_alert(db: Session, current_user: database_models.User, index: database_models.ConsumptionIndex):
    previous = db.query(database_models.ConsumptionIndex).filter(
        database_models.ConsumptionIndex.user_id == current_user.id,
        database_models.ConsumptionIndex.location_id == index.location_id,
        database_models.ConsumptionIndex.category_id == index.category_id,
        database_models.ConsumptionIndex.id != index.id,
    ).order_by(database_models.ConsumptionIndex.reading_date.desc()).first()
    if previous and previous.value > 0:
        ratio = index.value / previous.value
        if ratio >= 1.35:
            create_alert(
                db,
                current_user.id,
                "consumption",
                "medium",
                "Meter spike detected",
                f"Reading jumped from {previous.value:.2f} to {index.value:.2f}. Please review for anomalies.",
            )


def build_forecast(db: Session, current_user: database_models.User):
    invoices = db.query(database_models.Invoice).filter(
        database_models.Invoice.user_id == current_user.id
    ).order_by(database_models.Invoice.invoice_date.desc()).limit(6).all()
    if not invoices:
        return []
    average = sum(inv.amount for inv in invoices) / len(invoices)
    labels = ["Next bill", "Month end", "Quarter"]
    multipliers = [1, 1.8, 3]
    return [{"label": label, "amount": round(average * factor, 2)} for label, factor in zip(labels, multipliers)]
