import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils

router = APIRouter()


@router.get("/events", response_model=List[api_schemas.AutomationEvent])
def read_automation_events(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    return db.query(database_models.AutomationEvent).filter(
        database_models.AutomationEvent.user_id == current_user.id
    ).order_by(database_models.AutomationEvent.created_at.desc()).all()


@router.post("/webhook", response_model=api_schemas.AutomationEvent)
def receive_webhook(
    event: api_schemas.AutomationEventCreate,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    db_event = database_models.AutomationEvent(
        user_id=current_user.id,
        source=event.source,
        event_type=event.event_type,
        payload_json=event.payload_json,
        status="received",
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.post("/scan-folder")
def scan_import_folder(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    inbox_dir = os.getenv("INVOICE_INBOX_DIR", "data/inbox")
    os.makedirs(inbox_dir, exist_ok=True)
    files = [name for name in os.listdir(inbox_dir) if name.lower().endswith(".pdf")]
    db_event = database_models.AutomationEvent(
        user_id=current_user.id,
        source="folder-scan",
        event_type="invoice_inbox_scan",
        payload_json=json.dumps({"files": files, "scanned_at": datetime.now(timezone.utc).isoformat()}),
        status="completed",
    )
    db.add(db_event)
    db.commit()
    return {"message": f"Scanned {len(files)} PDF files", "files": files}
