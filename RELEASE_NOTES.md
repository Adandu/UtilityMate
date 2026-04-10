# UtilityMate v1.4.10

## New Features

- Added bulk invoice status updates from the invoice review desk.
- Added direct PDF viewing from invoice rows so imported bills can be reviewed in place.
- Added household deletion controls in the Operations Center.

## Improvements

- Improved the Operations Center to load each data section independently instead of failing all dropdowns and lists when one endpoint errors.
- Improved Configuration by surfacing households there as well, so shared workspaces are visible outside Operations.
- Improved invoice workflow ergonomics with checkbox selection and a dedicated bulk action bar.

## Bug Fixes

- Fixed the Operations Center alert-loading failure so alert generation/query issues no longer break the whole page.
- Fixed empty Operations dropdowns and missing household displays caused by all-or-nothing page loading.
- Fixed household cleanup so deleting a household detaches linked locations and budgets safely.
