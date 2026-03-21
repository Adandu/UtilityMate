# Stage 1: Build React Frontend
FROM node:20-slim AS build-stage
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Final Multi-Service Image
FROM python:3.11-slim

# Install Nginx and system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend code
COPY backend/ ./backend/

# Copy built Frontend assets to Nginx web root
COPY --from=build-stage /app/frontend/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY frontend/nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Prepare entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Create appuser and set permissions
RUN useradd -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /var/lib/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    touch /run/nginx.pid && \
    chown appuser:appuser /run/nginx.pid

# Switch to non-root user
USER appuser

# Expose port 80 (Nginx)
EXPOSE 80

# Environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH=/app

CMD ["./entrypoint.sh"]
