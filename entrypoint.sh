#!/bin/bash

# Ensure data directory exists for SQLite and Invoices
mkdir -p /app/data/invoices

# Initialize database if needed (runs the init_db script)
echo "Initializing database..."
python -m backend.init_db

# Start Backend (FastAPI) in the background
echo "Starting FastAPI backend..."
uvicorn backend.main:app --host 127.0.0.1 --port 8000 &

# Start Nginx in the foreground
echo "Starting Nginx frontend..."
nginx -g "daemon off;"
