# UtilityMate v1.7.1

## New Features

- Added Excel meter-reading import for the `AP 12` and `AP 15` workbook sheets directly from the dedicated Meter Readings page.
- Added import summaries so each workbook upload reports what was imported, updated, or skipped for every detected meter stream.

## Improvements

- Meter imports now ignore workbook invoice sections entirely and only bring in the raw meter histories that belong in UtilityMate.
- Existing invoices remain the billing source of truth while imported readings still link back to nearby invoices for reconciliation inside the Meter Readings page.

## Bug Fixes

- Fixed duplicate handling for repeated workbook uploads by preserving manual readings and allowing optional replacement of earlier Excel-imported rows only.
- Fixed workbook parsing by using explicit AP 12 / AP 15 stream mappings for electricity, gas, water, and radiator histories.
