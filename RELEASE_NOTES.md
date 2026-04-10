# UtilityMate v1.4.11

## New Features

- Added bulk invoice status updates from the invoice review desk.
- Added direct PDF viewing from invoice rows so imported bills can be reviewed in place.
- Added household deletion controls in the Operations Center.

## Improvements

- Backfilled review confidence for legacy invoices so older imports no longer stay stuck at `0%`.
- Improved Operations behavior so alerts degrade quietly and the rest of the page remains usable.
- Improved invoice workflow ergonomics with checkbox selection and a dedicated bulk action bar.

## Bug Fixes

- Fixed the Operations Center alert-loading failure so alert generation/query issues no longer break the whole page.
- Fixed empty Operations dropdowns and missing household displays caused by all-or-nothing page loading.
- Fixed household cleanup so deleting a household detaches linked locations and budgets safely.
