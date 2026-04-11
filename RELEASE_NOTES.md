# UtilityMate v1.6.0

## New Features

- Added a separate Rent workspace with its own backend tables, API routes, and frontend page for tenant-by-tenant monthly charge allocation.

## Improvements

- Rent workspaces can combine manual rent amounts with live UtilityMate electricity invoices and avizier totals, while supporting room-based heating allocation and per-tenant payment tracking.

## Bug Fixes

- Added guardrails so locations and providers cannot be removed while an active rent workspace still depends on them.
