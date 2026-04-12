# UtilityMate v1.7.2

## New Features

- Added the dedicated Meter Readings workspace as the new home for stream-based device history, editing, and invoice-aware reconciliation.

## Improvements

- Completed the one-time live migration of historical meter readings for `Ap 12` and `Ap 15` directly into the MasterChief UtilityMate database.
- Kept invoice records as the only billing source while meter history now lives separately in the app where it belongs.

## Bug Fixes

- Removed the temporary Excel import module so UtilityMate does not keep a permanent workbook-import surface for a one-off migration task.
- Fixed the final product state to match the intended scope: dedicated meter management without a persistent spreadsheet import feature.
