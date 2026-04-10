# UtilityMate v1.4.12

## New Features

- Added invoice deletion actions to the invoice review desk.
- Added bulk invoice deletion for multi-select workflows.
- Added confirmation prompts for destructive invoice removal actions.

## Improvements

- Kept invoice cleanup aligned with existing backend deletion logic so the stored PDF is removed alongside the database record.
- Improved invoice table actions by grouping review, PDF viewing, and deletion into one place.
- Preserved bulk-selection workflow after adding destructive actions.

## Bug Fixes

- Fixed the missing delete capability in the current invoice UI after the workflow redesign.
- Fixed the inability to remove multiple invoices at once from the review desk.
- Fixed the UX gap where invoice cleanup existed in the backend but was not reachable from the frontend.
