# UtilityMate v1.4.17

## New Features

- Added Engie gas-volume parsing from the detailed meter table so gas consumption is stored in `mc/m3`.
- Added support for Engie invoices that use thousands separators in the detailed consumption rows.
- Added parser coverage for both recent and older Engie invoice layouts using the meter-series section.

## Improvements

- Improved unit consistency so the Gas dashboard now uses the same volume unit that appears on the invoice detail table.
- Improved Engie extraction by preferring the detailed `DGSR` meter row over the summary `kWh` headline.
- Improved historical repair accuracy for existing Engie invoices through the startup PDF reparse worker.

## Bug Fixes

- Fixed incorrect gas cost-per-unit values caused by storing Engie `kWh` instead of `mc/m3`.
- Fixed March 16, 2026 and similar Engie invoices where `48 mc` was previously stored as `519`.
- Fixed older Engie invoices with values like `1.198,689` and `1.077,700` being truncated to `1`.
