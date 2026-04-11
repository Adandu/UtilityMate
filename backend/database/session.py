from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import joinedload, sessionmaker
import os
import re
from dotenv import load_dotenv
from ..models.database_models import Base
from ..utils.logging_config import logger
from ..models import database_models
from ..utils.parser import InvoiceParser

load_dotenv()

# We'll use SQLite for single-container deployment
# This path matches the internal Docker volume
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/data/utilitymate.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def resolve_invoice_pdf_path(pdf_path: str) -> str:
    candidate_paths = [
        pdf_path,
        os.path.join("/app", pdf_path),
    ]
    for candidate in candidate_paths:
        if candidate and os.path.exists(candidate):
            return candidate
    return pdf_path


def repair_pdf_invoice_data():
    repaired_count = 0
    db = SessionLocal()
    try:
        invoices = db.query(database_models.Invoice).options(
            joinedload(database_models.Invoice.provider),
            joinedload(database_models.Invoice.location),
        ).filter(
            database_models.Invoice.source_type == "pdf",
            database_models.Invoice.pdf_path != None,
        ).all()

        for invoice in invoices:
            if not invoice.provider or not invoice.location:
                continue

            provider_name = invoice.provider.name or ""
            if not any(name in provider_name.lower() for name in ("hidroelectrica", "engie")):
                continue

            pdf_path = resolve_invoice_pdf_path(invoice.pdf_path)
            if not os.path.exists(pdf_path):
                continue

            pdf_text = InvoiceParser.get_pdf_text(pdf_path)
            if not pdf_text:
                continue

            parsed_data = InvoiceParser.parse_pdf(pdf_text, provider_name, invoice.location.name or "")
            changed = False

            parsed_invoice_date = parsed_data.get("invoice_date")
            if parsed_invoice_date and parsed_invoice_date != invoice.invoice_date:
                invoice.invoice_date = parsed_invoice_date
                changed = True

            parsed_due_date = parsed_data.get("due_date")
            if parsed_due_date and parsed_due_date != invoice.due_date:
                invoice.due_date = parsed_due_date
                changed = True

            parsed_amount = parsed_data.get("amount")
            if parsed_amount is not None and parsed_amount > 0 and abs(parsed_amount - (invoice.amount or 0.0)) > 0.01:
                invoice.amount = parsed_amount
                changed = True

            parsed_consumption = parsed_data.get("consumption_value")
            if parsed_consumption is not None and parsed_consumption > 0 and abs(parsed_consumption - (invoice.consumption_value or 0.0)) > 0.01:
                invoice.consumption_value = parsed_consumption
                changed = True

            if changed:
                repaired_count += 1

        if repaired_count:
            db.commit()
            logger.info("Repaired parsed invoice data for %s PDF-backed invoices.", repaired_count)
        else:
            db.rollback()
    except Exception as exc:
        db.rollback()
        logger.warning("PDF invoice repair pass failed: %s", exc)
    finally:
        db.close()


def _get_or_create_category(db, user_id: int, name: str, unit: str):
    category = db.query(database_models.Category).filter(
        database_models.Category.name == name,
        database_models.Category.unit == unit,
        database_models.Category.user_id == user_id,
    ).first()
    if category:
        return category

    system_category = db.query(database_models.Category).filter(
        database_models.Category.name == name,
        database_models.Category.unit == unit,
        database_models.Category.user_id == None,
    ).first()
    if system_category:
        return system_category

    category = database_models.Category(
        user_id=user_id,
        name=name,
        unit=unit,
    )
    db.add(category)
    db.flush()
    return category


def _normalize_location_token(name: str):
    if not name:
        return None
    match = re.search(r"(\d+)", name)
    return match.group(1) if match else None


def repair_association_statement_water_categories():
    repaired_count = 0
    db = SessionLocal()
    try:
        lines = db.query(database_models.AssociationStatementLine).options(
            joinedload(database_models.AssociationStatementLine.category),
        ).filter(
            database_models.AssociationStatementLine.line_kind == "utility",
            database_models.AssociationStatementLine.unit == "m3",
        ).all()

        water_mapping = {
            "apa rece": "Cold Water",
            "apa calda": "Hot Water",
            "apa parti comune": "Shared Water",
            "apa meteorica": "Storm Water",
        }

        for line in lines:
            raw_label = (line.raw_label or "").strip().lower()
            target_name = water_mapping.get(raw_label)
            if not target_name:
                continue

            changed = False
            if line.normalized_label != target_name:
                line.normalized_label = target_name
                changed = True

            if not line.include_in_category_analytics:
                line.include_in_category_analytics = True
                changed = True

            if not line.include_in_unit_cost:
                line.include_in_unit_cost = True
                changed = True

            current_category_name = line.category.name if line.category else None
            if current_category_name != target_name:
                target_category = _get_or_create_category(db, line.user_id, target_name, "m3")
                line.category_id = target_category.id
                changed = True

            if changed:
                repaired_count += 1

        if repaired_count:
            db.commit()
            logger.info("Repaired water categories for %s association statement lines.", repaired_count)
        else:
            db.rollback()
    except Exception as exc:
        db.rollback()
        logger.warning("Association statement water repair pass failed: %s", exc)
    finally:
        db.close()


def repair_association_statement_totals():
    repaired_count = 0
    db = SessionLocal()
    try:
        statements = db.query(database_models.AssociationStatement).options(
            joinedload(database_models.AssociationStatement.lines),
        ).all()
        location_cache = {}

        for statement in statements:
            if statement.user_id not in location_cache:
                locations = db.query(database_models.Location).filter(
                    database_models.Location.user_id == statement.user_id,
                ).all()
                location_cache[statement.user_id] = {
                    token: location
                    for location in locations
                    for token in [_normalize_location_token(location.name)]
                    if token
                }

            pdf_path = resolve_invoice_pdf_path(statement.pdf_path)
            if not pdf_path or not os.path.exists(pdf_path):
                continue

            pdf_text = InvoiceParser.get_pdf_text(pdf_path)
            if not pdf_text:
                continue

            structured = InvoiceParser.parse_association_statement(pdf_text)
            apartments = structured.get("apartments", [])
            if not apartments:
                continue

            expected_totals = {}
            location_by_token = location_cache[statement.user_id]
            for apartment in apartments:
                location = location_by_token.get(apartment.get("apartment_number"))
                if not location:
                    continue
                expected_totals[location.id] = apartment.get("monthly_total") or apartment.get("total_payable") or 0.0

            existing_summary_lines = {}
            for line in statement.lines:
                if line.line_kind == "statement_total" and line.normalized_label == "Avizier Total":
                    existing_summary_lines.setdefault(line.location_id, []).append(line)

            for location_id, total in expected_totals.items():
                existing_lines = existing_summary_lines.get(location_id, [])
                primary_line = existing_lines[0] if existing_lines else None

                if primary_line is None:
                    db.add(database_models.AssociationStatementLine(
                        statement_id=statement.id,
                        user_id=statement.user_id,
                        location_id=location_id,
                        category_id=None,
                        raw_label="Total luna",
                        normalized_label="Avizier Total",
                        line_kind="statement_total",
                        amount=total,
                        consumption_value=None,
                        unit=None,
                        include_in_overall_analytics=False,
                        include_in_category_analytics=False,
                        include_in_unit_cost=False,
                    ))
                    repaired_count += 1
                    continue

                changed = False
                if abs((primary_line.amount or 0.0) - total) > 0.01:
                    primary_line.amount = total
                    changed = True
                if primary_line.raw_label != "Total luna":
                    primary_line.raw_label = "Total luna"
                    changed = True
                if primary_line.normalized_label != "Avizier Total":
                    primary_line.normalized_label = "Avizier Total"
                    changed = True
                if primary_line.line_kind != "statement_total":
                    primary_line.line_kind = "statement_total"
                    changed = True
                if primary_line.include_in_overall_analytics:
                    primary_line.include_in_overall_analytics = False
                    changed = True
                if primary_line.include_in_category_analytics:
                    primary_line.include_in_category_analytics = False
                    changed = True
                if primary_line.include_in_unit_cost:
                    primary_line.include_in_unit_cost = False
                    changed = True
                if changed:
                    repaired_count += 1

                for duplicate_line in existing_lines[1:]:
                    db.delete(duplicate_line)
                    repaired_count += 1

        if repaired_count:
            db.commit()
            logger.info("Repaired avizier statement totals for %s apartment statement entries.", repaired_count)
        else:
            db.rollback()
    except Exception as exc:
        db.rollback()
        logger.warning("Association statement total repair pass failed: %s", exc)
    finally:
        db.close()


def repair_association_statement_utility_cost_pairs():
    repaired_count = 0
    db = SessionLocal()
    try:
        statements = db.query(database_models.AssociationStatement).options(
            joinedload(database_models.AssociationStatement.lines),
        ).all()
        location_cache = {}
        target_labels = {"gaze naturale", "caldura"}

        for statement in statements:
            if statement.user_id not in location_cache:
                locations = db.query(database_models.Location).filter(
                    database_models.Location.user_id == statement.user_id,
                ).all()
                location_cache[statement.user_id] = {
                    token: location
                    for location in locations
                    for token in [_normalize_location_token(location.name)]
                    if token
                }

            pdf_path = resolve_invoice_pdf_path(statement.pdf_path)
            if not pdf_path or not os.path.exists(pdf_path):
                continue

            pdf_text = InvoiceParser.get_pdf_text(pdf_path)
            if not pdf_text:
                continue

            structured = InvoiceParser.parse_association_statement(pdf_text)
            apartments = structured.get("apartments", [])
            if not apartments:
                continue

            location_by_token = location_cache[statement.user_id]
            expected_amounts = {}
            for apartment in apartments:
                location = location_by_token.get(apartment.get("apartment_number"))
                if not location:
                    continue
                for item in apartment.get("line_items", []):
                    raw_label = (item.get("raw_label") or "").strip().lower()
                    if raw_label in target_labels:
                        expected_amounts[(location.id, raw_label)] = {
                            "amount": item.get("amount", 0.0),
                            "normalized_label": item.get("normalized_label"),
                            "category_name": item.get("category_name"),
                        }

            for line in statement.lines:
                raw_label = (line.raw_label or "").strip().lower()
                if raw_label not in target_labels:
                    continue
                expected = expected_amounts.get((line.location_id, raw_label))
                if expected is None:
                    continue
                changed = False
                expected_amount = expected["amount"]
                if abs((line.amount or 0.0) - expected_amount) > 0.01:
                    line.amount = expected_amount
                    changed = True
                expected_label = expected["normalized_label"] or line.normalized_label
                if line.normalized_label != expected_label:
                    line.normalized_label = expected_label
                    changed = True
                expected_category_name = expected["category_name"]
                if expected_category_name:
                    expected_unit = line.unit or "unit"
                    target_category = _get_or_create_category(db, line.user_id, expected_category_name, expected_unit)
                    if line.category_id != target_category.id:
                        line.category_id = target_category.id
                        changed = True
                if changed:
                    repaired_count += 1

        if repaired_count:
            db.commit()
            logger.info("Repaired gas/heating avizier amounts for %s association statement lines.", repaired_count)
        else:
            db.rollback()
    except Exception as exc:
        db.rollback()
        logger.warning("Association statement gas/heating repair pass failed: %s", exc)
    finally:
        db.close()


def rebuild_association_statement_lines():
    rebuilt_count = 0
    db = SessionLocal()
    try:
        statements = db.query(database_models.AssociationStatement).options(
            joinedload(database_models.AssociationStatement.lines),
        ).all()
        location_cache = {}

        for statement in statements:
            if statement.user_id not in location_cache:
                locations = db.query(database_models.Location).filter(
                    database_models.Location.user_id == statement.user_id,
                ).all()
                location_cache[statement.user_id] = {
                    token: location
                    for location in locations
                    for token in [_normalize_location_token(location.name)]
                    if token
                }

            pdf_path = resolve_invoice_pdf_path(statement.pdf_path)
            if not pdf_path or not os.path.exists(pdf_path):
                continue

            pdf_text = InvoiceParser.get_pdf_text(pdf_path)
            if not pdf_text:
                continue

            structured = InvoiceParser.parse_association_statement(pdf_text)
            apartments = structured.get("apartments", [])
            if not apartments:
                continue

            for line in list(statement.lines):
                db.delete(line)

            imported_lines = 0
            location_by_token = location_cache[statement.user_id]
            for apartment in apartments:
                location = location_by_token.get(apartment.get("apartment_number"))
                if not location:
                    continue

                apartment_total = apartment.get("monthly_total") or apartment.get("total_payable") or 0.0
                db.add(database_models.AssociationStatementLine(
                    statement_id=statement.id,
                    user_id=statement.user_id,
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

                for item in apartment.get("line_items", []):
                    category = None
                    if item.get("category_name"):
                        category_unit = item.get("unit") or {
                            "Water": "m3",
                            "Energy": "kWh",
                            "Gas": "unit",
                            "Heating": "unit",
                            "Cold Water": "m3",
                            "Hot Water": "m3",
                            "Shared Water": "m3",
                            "Storm Water": "m3",
                        }.get(item["category_name"], "unit")
                        category = _get_or_create_category(db, statement.user_id, item["category_name"], category_unit)

                    db.add(database_models.AssociationStatementLine(
                        statement_id=statement.id,
                        user_id=statement.user_id,
                        location_id=location.id,
                        category_id=category.id if category else None,
                        raw_label=item["raw_label"],
                        normalized_label=item["normalized_label"],
                        line_kind=item["line_kind"],
                        amount=item["amount"],
                        consumption_value=item.get("consumption_value"),
                        unit=item.get("unit"),
                        include_in_overall_analytics=item["include_in_overall_analytics"],
                        include_in_category_analytics=item["include_in_category_analytics"],
                        include_in_unit_cost=item["include_in_unit_cost"],
                    ))
                    imported_lines += 1

            if imported_lines:
                rebuilt_count += 1

        if rebuilt_count:
            db.commit()
            logger.info("Rebuilt parsed lines for %s association statements.", rebuilt_count)
        else:
            db.rollback()
    except Exception as exc:
        db.rollback()
        logger.warning("Association statement line rebuild failed: %s", exc)
    finally:
        db.close()

def verify_and_migrate_db():
    """
    Verifies the database schema and applies simple migrations if necessary.
    This handles common schema changes without requiring Alembic for simple SQLite deployments.
    """
    inspector = inspect(engine)
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    with engine.begin() as conn:
        tables = inspector.get_table_names()
        # 1. Migration: Add user_id to categories and providers
        for table in ["categories", "providers"]:
            columns = [c["name"] for c in inspector.get_columns(table)]
            if "user_id" not in columns:
                logger.info(f"Migration: Adding user_id column to {table}")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"))
        
        # 1.1 Migration: Add dashboard_config to users
        columns = [c["name"] for c in inspector.get_columns("users")]
        if "dashboard_config" not in columns:
            logger.info("Migration: Adding dashboard_config column to users")
            conn.execute(text("ALTER TABLE users ADD COLUMN dashboard_config VARCHAR"))
        
        # 2. Migration: Rename billing_date to invoice_date in invoices
        if "invoices" in tables:
            columns = [c["name"] for c in inspector.get_columns("invoices")]
            if "billing_date" in columns and "invoice_date" not in columns:
                logger.info("Migration: Renaming billing_date to invoice_date in invoices")
                # SQLite doesn't support direct RENAME COLUMN in older versions (< 3.25.0)
                # To be safe, we'll try the simple RENAME and catch errors
                try:
                    conn.execute(text("ALTER TABLE invoices RENAME COLUMN billing_date TO invoice_date"))
                except Exception:
                    # Fallback for very old SQLite: this is more complex, but usually not needed in our Docker env
                    logger.warning("Simple column rename failed, schema might need manual intervention or a fresh install")
            
            # 3. Migration: Remove status column (optional, but clean)
            if "status" in columns:
                logger.info("Migration: Cleaning up status column in invoices")
                # We won't drop it here as it requires table recreation in SQLite < 3.35.0
                # But we've removed it from our models, so it will just be ignored
                pass

        invoice_columns = {
            "status": "ALTER TABLE invoices ADD COLUMN status VARCHAR DEFAULT 'received'",
            "paid_at": "ALTER TABLE invoices ADD COLUMN paid_at DATETIME",
            "payment_reference": "ALTER TABLE invoices ADD COLUMN payment_reference VARCHAR",
            "parse_confidence": "ALTER TABLE invoices ADD COLUMN parse_confidence FLOAT DEFAULT 0.0",
            "needs_review": "ALTER TABLE invoices ADD COLUMN needs_review BOOLEAN DEFAULT 0",
            "review_notes": "ALTER TABLE invoices ADD COLUMN review_notes VARCHAR",
            "source_type": "ALTER TABLE invoices ADD COLUMN source_type VARCHAR DEFAULT 'pdf'",
            "source_name": "ALTER TABLE invoices ADD COLUMN source_name VARCHAR",
            "processing_notes": "ALTER TABLE invoices ADD COLUMN processing_notes VARCHAR",
        }
        for column_name, statement in invoice_columns.items():
            columns = [c["name"] for c in inspector.get_columns("invoices")]
            if column_name not in columns:
                logger.info("Migration: Adding %s to invoices", column_name)
                conn.execute(text(statement))

        consumption_columns = {
            "source_type": "ALTER TABLE consumption_indexes ADD COLUMN source_type VARCHAR DEFAULT 'manual'",
            "photo_path": "ALTER TABLE consumption_indexes ADD COLUMN photo_path VARCHAR",
            "notes": "ALTER TABLE consumption_indexes ADD COLUMN notes VARCHAR",
        }
        if "consumption_indexes" in tables:
            for column_name, statement in consumption_columns.items():
                columns = [c["name"] for c in inspector.get_columns("consumption_indexes")]
                if column_name not in columns:
                    logger.info("Migration: Adding %s to consumption_indexes", column_name)
                    conn.execute(text(statement))

        if "locations" in tables:
            columns = [c["name"] for c in inspector.get_columns("locations")]
            if "household_id" not in columns:
                logger.info("Migration: Adding household_id to locations")
                conn.execute(text("ALTER TABLE locations ADD COLUMN household_id INTEGER REFERENCES households(id) ON DELETE SET NULL"))

        if "association_statements" not in tables:
            logger.info("Migration: Creating association_statements table")
            conn.execute(text("""
                CREATE TABLE association_statements (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    statement_month DATE NOT NULL,
                    display_month VARCHAR NOT NULL,
                    posted_date DATE,
                    due_date DATE,
                    source_name VARCHAR,
                    pdf_path VARCHAR,
                    total_payable FLOAT,
                    parsing_profile VARCHAR,
                    created_at DATETIME
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statements_id ON association_statements (id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statements_user_id ON association_statements (user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statements_statement_month ON association_statements (statement_month)"))

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "association_statement_lines" not in tables:
            logger.info("Migration: Creating association_statement_lines table")
            conn.execute(text("""
                CREATE TABLE association_statement_lines (
                    id INTEGER PRIMARY KEY,
                    statement_id INTEGER NOT NULL REFERENCES association_statements(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
                    category_id INTEGER REFERENCES categories(id),
                    raw_label VARCHAR NOT NULL,
                    normalized_label VARCHAR NOT NULL,
                    line_kind VARCHAR NOT NULL DEFAULT 'utility',
                    amount FLOAT NOT NULL DEFAULT 0.0,
                    consumption_value FLOAT,
                    unit VARCHAR,
                    include_in_overall_analytics BOOLEAN DEFAULT 1,
                    include_in_category_analytics BOOLEAN DEFAULT 0,
                    include_in_unit_cost BOOLEAN DEFAULT 0,
                    created_at DATETIME
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statement_lines_id ON association_statement_lines (id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statement_lines_statement_id ON association_statement_lines (statement_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statement_lines_user_id ON association_statement_lines (user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statement_lines_location_id ON association_statement_lines (location_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_association_statement_lines_category_id ON association_statement_lines (category_id)"))
    
    logger.info("Database schema verification and migration complete.")
