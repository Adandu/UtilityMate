# UtilityMate

UtilityMate is a modern, dockerized web application designed to manage and monitor utility invoices (Water, Gas, Electricity, etc.) with a specific focus on Romanian providers.

## Features
- **Dashboard**: Interactive consumption trends and spending analysis.
- **Invoice Management**: Secure PDF upload with automatic field recognition (Hidroelectrica, ENGIE, etc.).
- **Consumption Tracking**: Manual index entry and monitoring over time.
- **Multi-Location Support**: Manage multiple properties/apartments (e.g., AP12, AP15).
- **Secure Accounts**: JWT-based authentication with rate limiting.
- **Theme Support**: Toggle between Light and Dark modes.

## Tech Stack
- **Frontend**: React (TypeScript), Recharts, Lucide Icons, Vite.
- **Backend**: FastAPI (Python), SQLAlchemy, PDFPlumber.
- **Database**: PostgreSQL.
- **Deployment**: Docker Compose.

## Quick Start (Docker)

1. **Configure Environment**:
   Copy `.env.example` to `.env` and set your `SECRET_KEY` and `DB_PASSWORD`.
   ```bash
   cp .env.example .env
   ```

2. **Launch Application**:
   ```bash
   docker-compose up -d --build
   ```

3. **Access**:
   - Web UI: http://localhost
   - API Docs: http://localhost:8000/docs (if exposed)

### Persistent Storage
The default Compose example mounts `./data` to `/app/data`. UtilityMate writes both the SQLite database and uploaded PDFs under that path.

For bind mounts, either:
- make the host path writable by the container runtime user, or
- set `PUID` and `PGID` so the container runs the app with a UID/GID that matches the host directory owner.

If `PUID=0` and `PGID=0`, UtilityMate runs as root inside the container, which is often the simplest option for homelab bind mounts.

## Development

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## Security Note
This application uses hash-based deduplication for invoices and enforces strict PDF magic-byte validation. JWT tokens are used for session management. For production deployment, ensure `ALLOWED_ORIGINS` and `SECRET_KEY` are properly configured.
