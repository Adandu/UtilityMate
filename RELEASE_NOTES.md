# UtilityMate v1.9.7

## New Features

- No new features in this release.

## Improvements

- Added explicit rate limits to invoice upload/export, rent statement, statement export, association statement upload, and analytics PDF export routes to reduce abuse risk on expensive endpoints.
- Reduced repeated database work when building rent statements by preloading monthly source summaries and payment totals across the requested lease history.

## Bug Fixes

- Stopped invoice list and review queue `GET` endpoints from committing backfill changes during read requests.
- Sanitized invoice upload processing errors so raw backend exception details are no longer returned to clients.
