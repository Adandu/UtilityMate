#!/bin/bash
set -e

TARGET_UID="${PUID:-1000}"
TARGET_GID="${PGID:-1000}"

if [ "$TARGET_GID" != "0" ]; then
  groupmod -o -g "$TARGET_GID" appuser
fi

if [ "$TARGET_UID" != "0" ]; then
  usermod -o -u "$TARGET_UID" -g "$TARGET_GID" appuser
fi

run_app() {
  if [ "$TARGET_UID" = "0" ]; then
    "$@"
  else
    gosu appuser "$@"
  fi
}

echo "Using runtime UID:GID ${TARGET_UID}:${TARGET_GID}"

# Ensure data directory exists for SQLite and invoice uploads.
# Bind-mounted filesystems may reject chown, so we only verify writability here.
mkdir -p /app/data/invoices || {
  echo "Failed to create /app/data/invoices. Check bind mount permissions on the host."
  ls -ld /app /app/data || true
  exit 1
}

touch /app/data/.writable || {
  echo "Bind mount /app/data is not writable by UID ${TARGET_UID}. Check host ACLs/ownership."
  ls -ld /app /app/data /app/data/invoices || true
  exit 1
}
rm -f /app/data/.writable

# Initialize database if needed (runs the init_db script)
echo "Initializing database..."
run_app python -m backend.init_db || { echo "Database initialization failed"; exit 1; }

# Start Backend (FastAPI) in the background
echo "Starting FastAPI backend..."
run_app uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
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
