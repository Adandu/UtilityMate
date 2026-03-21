from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, categories, providers, locations, invoices, consumption

app = FastAPI(title="UtilityMate API")

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to UtilityMate API - Antigravity Edition"}

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["invoices"])
app.include_router(consumption.router, prefix="/api/consumption", tags=["consumption"])
