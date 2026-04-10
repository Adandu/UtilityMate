import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .routers import auth, categories, providers, locations, invoices, consumption, budgets, alerts, households, automation, analytics
from .database.session import engine, verify_and_migrate_db
from .utils.logging_config import logger
from .utils.rate_limiter import limiter

# Load version
VERSION = os.getenv("APP_VERSION", "1.1.7")
try:
    if os.path.exists("../VERSION"):
        with open("../VERSION", "r") as f:
            VERSION = f.read().strip()
    elif os.path.exists("VERSION"):
        with open("VERSION", "r") as f:
            VERSION = f.read().strip()
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
