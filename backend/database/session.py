from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from ..models.database_models import Base
from ..utils.logging_config import logger

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
    
    logger.info("Database schema verification and migration complete.")
