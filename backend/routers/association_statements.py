import hashlib
import os
import re
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils, parser, file_utils
from ..utils.logging_config import logger
from ..utils.rate_limiter import limiter

router = APIRouter()

UPLOAD_DIR = os.getenv("ASSOCIATION_STATEMENT_UPLOAD_DIR", "data/association-statements")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024


def get_file_hash(file_content: bytes):
    return hashlib.sha256(file_content).hexdigest()


def normalize_location_token(name: str) -> Optional[str]:
    if not name:
        return None
    match = re.search(r"(\d+)", name)
    return match.group(1) if match else None


def ensure_category(
    db: Session,
    current_user: database_models.User,
    name: str,
    unit: str,
) -> database_models.Category:
    category = db.query(database_models.Category).filter(
        database_models.Category.name == name,
        or_(
            database_models.Category.user_id == None,
            database_models.Category.user_id == current_user.id,
        ),
    ).order_by(database_models.Category.user_id.desc()).first()
    if category:
        return category

    category = database_models.Category(
        user_id=current_user.id,
        name=name,
        unit=unit,
    )
    db.add(category)
    db.flush()
    return category


@router.get("/", response_model=List[api_schemas.AssociationStatement])
def list_association_statements(
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    return db.query(database_models.AssociationStatement).options(
        joinedload(database_models.AssociationStatement.lines).joinedload(database_models.AssociationStatementLine.location),
        joinedload(database_models.AssociationStatement.lines).joinedload(database_models.AssociationStatementLine.category),
    ).filter(
        database_models.AssociationStatement.user_id == current_user.id,
    ).order_by(
        database_models.AssociationStatement.statement_month.desc(),
        database_models.AssociationStatement.id.desc(),
    ).all()


@router.get("/{statement_id}/pdf")
def download_association_statement_pdf(
    statement_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    statement = db.query(database_models.AssociationStatement).filter(
        database_models.AssociationStatement.id == statement_id,
        database_models.AssociationStatement.user_id == current_user.id,
    ).first()
    if not statement or not statement.pdf_path or not os.path.exists(statement.pdf_path):
        raise HTTPException(status_code=404, detail="Association statement PDF not found")
    return FileResponse(statement.pdf_path, media_type="application/pdf", filename=os.path.basename(statement.pdf_path))


@router.post("/upload", response_model=List[api_schemas.AssociationStatementUploadResult])
@limiter.limit("5/minute")
async def upload_association_statements(
    request: Request,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    results: List[api_schemas.AssociationStatementUploadResult] = []
    locations = db.query(database_models.Location).filter(
        database_models.Location.user_id == current_user.id,
    ).all()
    location_by_token: Dict[str, database_models.Location] = {}
    for location in locations:
        token = normalize_location_token(location.name)
        if token and token not in location_by_token:
            location_by_token[token] = location

    for file in files:
        file_path = ""
        try:
            safe_filename = file_utils.secure_filename(file.filename)
            ext = os.path.splitext(safe_filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                results.append(api_schemas.AssociationStatementUploadResult(filename=file.filename, status="error", detail="Only PDF files are supported"))
                continue

            content = await file_utils.read_upload_file_limited(file, MAX_FILE_SIZE)
            if not content.startswith(b"%PDF"):
                results.append(api_schemas.AssociationStatementUploadResult(filename=file.filename, status="error", detail="Invalid PDF file content"))
                continue

            file_hash = get_file_hash(content)
            unique_filename = f"{current_user.id}_{file_hash}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            existing = db.query(database_models.AssociationStatement).filter(
                database_models.AssociationStatement.user_id == current_user.id,
                database_models.AssociationStatement.pdf_path == file_path,
            ).first()
            if existing:
                results.append(api_schemas.AssociationStatementUploadResult(
                    filename=file.filename,
                    status="error",
                    detail="This statement is already imported",
                    statement_id=existing.id,
                    display_month=existing.display_month,
                ))
                continue

            with open(file_path, "wb") as buffer:
                buffer.write(content)

            text = parser.InvoiceParser.get_pdf_text(file_path)
            structured = parser.InvoiceParser.parse_association_statement(text)
            apartments = structured.get("apartments", [])
            if not structured.get("display_month") or not apartments:
                os.remove(file_path)
                results.append(api_schemas.AssociationStatementUploadResult(filename=file.filename, status="error", detail="Could not parse this association statement layout"))
                continue

            statement = database_models.AssociationStatement(
                user_id=current_user.id,
                statement_month=structured["statement_month"],
                display_month=structured["display_month"],
                posted_date=structured.get("posted_date"),
                due_date=structured.get("due_date"),
                source_name=file.filename,
                pdf_path=file_path,
                total_payable=sum(apartment.get("total_payable", 0.0) for apartment in apartments),
                parsing_profile=structured.get("parsing_profile"),
            )
            db.add(statement)
            db.flush()

            imported_locations: List[str] = []
            imported_lines = 0

            for apartment in apartments:
                location = location_by_token.get(apartment["apartment_number"])
                if not location:
                    continue
                imported_locations.append(location.name)
                apartment_total = apartment.get("monthly_total") or apartment.get("total_payable") or 0.0
                db.add(database_models.AssociationStatementLine(
                    statement_id=statement.id,
                    user_id=current_user.id,
                    location_id=location.id,
                    category_id=None,
                    raw_label="Total luna",
                    normalized_label="Avizier Total",
                    line_kind="statement_total",
                    amount=apartment_total,
                    consumption_value=None,
                    unit=None,
                    include_in_overall_analytics=False,
                    include_in_category_analytics=False,
                    include_in_unit_cost=False,
                ))
                imported_lines += 1
                for line_item in apartment.get("line_items", []):
                    category = None
                    if line_item.get("category_name"):
                        category_unit = line_item.get("unit") or {
                            "Water": "m3",
                            "Energy": "kWh",
                            "Gas": "unit",
                            "Heating": "unit",
                        }.get(line_item["category_name"], "unit")
                        category = ensure_category(db, current_user, line_item["category_name"], category_unit)

                    db.add(database_models.AssociationStatementLine(
                        statement_id=statement.id,
                        user_id=current_user.id,
                        location_id=location.id,
                        category_id=category.id if category else None,
                        raw_label=line_item["raw_label"],
                        normalized_label=line_item["normalized_label"],
                        line_kind=line_item["line_kind"],
                        amount=line_item["amount"],
                        consumption_value=line_item.get("consumption_value"),
                        unit=line_item.get("unit"),
                        include_in_overall_analytics=line_item["include_in_overall_analytics"],
                        include_in_category_analytics=line_item["include_in_category_analytics"],
                        include_in_unit_cost=line_item["include_in_unit_cost"],
                    ))
                    imported_lines += 1

            if imported_lines == 0:
                db.rollback()
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                results.append(api_schemas.AssociationStatementUploadResult(
                    filename=file.filename,
                    status="error",
                    detail="No matching locations were found for the apartments in this statement",
                ))
                continue

            db.commit()
            db.refresh(statement)
            results.append(api_schemas.AssociationStatementUploadResult(
                filename=file.filename,
                status="success",
                detail="Association statement imported successfully",
                statement_id=statement.id,
                display_month=statement.display_month,
                imported_locations=sorted(set(imported_locations)),
                imported_lines=imported_lines,
            ))
        except Exception as exc:
            logger.error("Association statement import failed for %s: %s", file.filename, exc)
            db.rollback()
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            error_detail = str(exc.detail) if isinstance(exc, HTTPException) else "Import failed. Please verify the PDF contents and try again."
            results.append(api_schemas.AssociationStatementUploadResult(filename=file.filename, status="error", detail=error_detail))

    return results


@router.delete("/{statement_id}")
def delete_association_statement(
    statement_id: int,
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user),
):
    statement = db.query(database_models.AssociationStatement).filter(
        database_models.AssociationStatement.id == statement_id,
        database_models.AssociationStatement.user_id == current_user.id,
    ).first()
    if not statement:
        raise HTTPException(status_code=404, detail="Association statement not found")
    if statement.pdf_path and os.path.exists(statement.pdf_path):
        os.remove(statement.pdf_path)
    db.delete(statement)
    db.commit()
    return {"message": "Association statement deleted"}
