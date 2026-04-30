# UtilityMate v1.9.14

## New Features

- Added CI verification gates for frontend lint/build and backend tests before publishing Docker images.
- Added Alembic scaffolding so future schema changes can be managed through migrations.

## Improvements

- Hardened PDF upload handling with shared size-limited reads for invoice and association statement imports.
- Reduced bearer token persistence by moving frontend auth storage to session-only storage and shortening the default token lifetime to 8 hours.
- Removed internal PDF filesystem paths from API response schemas.
- Pinned backend Python dependencies and switched frontend Docker installs to `npm ci`.
- Aligned backend CI and Docker runtime on Python 3.12.
- Added Docker build context exclusions for local caches, invoices, data, and generated artifacts.
- Removed tracked Python bytecode artifacts and ignored future bytecode caches.

## Bug Fixes

- Resolved frontend lint failures so the new CI lint gate can run cleanly.
- Refreshed frontend dependencies to clear `npm audit` security advisories.
