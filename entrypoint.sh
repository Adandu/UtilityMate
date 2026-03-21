#!/bin/bash

# Ensure data directory exists for SQLite and Invoices
mkdir -p /app/data/invoices

# Initialize database if needed (runs the init_db script)
echo "Initializing database..."
python -m backend.init_db

# Start Backend (FastAPI) in the background
echo "Starting FastAPI backend..."
uvicorn backend.main:app --host 127.0.0.1 --port 8000 > /app/data/backend.log 2>&1 &

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..10}; do
    if curl -s http://127.0.0.1:8000/ > /dev/null; then
        echo "Backend is up!"
        break
    fi
    echo "Still waiting... ($i/10)"
    sleep 1
done

# Start Nginx in the foreground
echo "Starting Nginx frontend..."
nginx -g "daemon off;"
