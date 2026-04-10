# UtilityMate v1.4.9

## New Features

- Added an Operations Center with budgets, alerts, household workspaces, automation events, inbox scanning, and meter-reading management.
- Added richer invoice workflow support with review queues, parser confidence, due dates, payment-status tracking metadata, and CSV export.
- Added analytics/report endpoints and a rebuilt dashboard for forecasts, budget pressure, review signals, and operational visibility.

## Improvements

- Expanded the data model and migrations to support budgets, alerts, households, automation events, enhanced invoice metadata, and richer consumption records.
- Improved bind-mount compatibility by honoring runtime `PUID`/`PGID` settings instead of requiring ownership changes on mounted storage.
- Improved parser extraction to capture due dates and surface clearer review guidance for low-confidence imports.

## Bug Fixes

- Fixed cross-user invoice update risks by validating provider and location ownership before reassignment.
- Fixed the bulk invoice patch route so `/api/invoices/bulk` no longer conflicts with the dynamic invoice-id route.
- Fixed orphaned upload files left behind after failed PDF text extraction and hardened container startup against bind-mount permission failures.
