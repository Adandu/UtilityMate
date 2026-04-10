#!/bin/bash
set -e

# Ensure data directory exists for SQLite and invoice uploads,
# then fix ownership in case a host bind/named volume overrides image permissions.
mkdir -p /app/data/invoices
chown -R appuser:appuser /app/data

# Initialize database if needed (runs the init_db script)
echo "Initializing database..."
gosu appuser python -m backend.init_db || { echo "Database initialization failed"; exit 1; }

# Start Backend (FastAPI) in the background
echo "Starting FastAPI backend..."
gosu appuser uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
MAX_RETRIES=15
for ((i=1; i<=MAX_RETRIES; i++)); do
    # Check if backend process is still running
    if ! kill -0 $BACKEND_PID > /dev/null 2>&1; then
        echo "Backend process died! Check container logs for details."
        exit 1
    fi

    if curl -s http://127.0.0.1:8000/ > /dev/null; then
        echo "Backend is up!"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "Backend failed to start after $MAX_RETRIES seconds"
        exit 1
    fi
    
    echo "Still waiting... ($i/$MAX_RETRIES)"
    sleep 1
done

# Start Nginx in the foreground
echo "Starting Nginx frontend..."
nginx -g "daemon off;"
