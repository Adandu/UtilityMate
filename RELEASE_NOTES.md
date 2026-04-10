# UtilityMate v1.4.21

## New Features

- Added dedicated BlocManagerNET `avizier` imports with sparse month-by-month parsing for association statements.
- Added association statement storage with normalized per-apartment line items instead of forcing avizier PDFs into the normal invoice model.
- Added Operations Center support to upload, review, open, and delete imported association statements.

## Improvements

- Improved avizier handling by mapping only the columns present in each month while preserving raw labels for later refinement.
- Improved dashboard analytics so imported association statement utility costs contribute to location trends and utility comparisons.
- Improved Water analytics from avizier statements by carrying metered monthly consumption for apartments such as `Ap 12` and `Ap 15`.

## Bug Fixes

- Fixed association statements being parseable only as rough apartment totals with no structured month-by-month utility breakdown.
- Fixed dashboard blind spots where avizier-driven apartment costs were missing entirely from utility trend analysis.
- Fixed month-layout fragility by supporting the observed September 2025 through February 2026 BlocManagerNET statement variants.
