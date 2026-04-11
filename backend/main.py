import os
import threading
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .routers import auth, categories, providers, locations, invoices, consumption, budgets, alerts, households, automation, analytics, association_statements
from .database.session import engine, repair_association_statement_totals, repair_association_statement_utility_cost_pairs, repair_association_statement_water_categories, repair_pdf_invoice_data, verify_and_migrate_db
from .utils.logging_config import logger
from .utils.rate_limiter import limiter


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_project_file(filename: str) -> str | None:
    candidate = os.path.join(BASE_DIR, filename)
    if os.path.exists(candidate):
        with open(candidate, "r", encoding="utf-8") as project_file:
            return project_file.read().strip()
    return None


# Load version
VERSION = os.getenv("APP_VERSION", "1.1.7")
try:
    file_version = read_project_file("VERSION")
    if file_version:
        VERSION = file_version
except Exception:
    logger.warning("Could not read VERSION file, using fallback")

# Verify and migrate database on startup
try:
    verify_and_migrate_db()
except Exception as e:
    logger.error(f"Database migration failed: {e}")
    # We continue as the app might still work or Base.metadata.create_all might have succeeded

app = FastAPI(title="UtilityMate API", version=VERSION)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS - Externalize origins
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost,http://127.0.0.1,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self'"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception occurred: %s", str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."}
    )


@app.on_event("startup")
async def schedule_invoice_repair():
    # Run repair jobs after the API is booting so container health checks do not time out.
    threading.Thread(target=repair_pdf_invoice_data, daemon=True).start()
    threading.Thread(target=repair_association_statement_water_categories, daemon=True).start()
    threading.Thread(target=repair_association_statement_utility_cost_pairs, daemon=True).start()
    threading.Thread(target=repair_association_statement_totals, daemon=True).start()

@app.get("/")
async def root():
    return {
        "message": "Welcome to UtilityMate API",
        "version": VERSION
    }

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["invoices"])
app.include_router(consumption.router, prefix="/api/consumption", tags=["consumption"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(households.router, prefix="/api/households", tags=["households"])
app.include_router(automation.router, prefix="/api/automation", tags=["automation"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(association_statements.router, prefix="/api/association-statements", tags=["association-statements"])
