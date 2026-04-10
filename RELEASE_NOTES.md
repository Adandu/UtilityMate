# UtilityMate v1.4.15

## New Features

- Added an automatic PDF invoice repair pass on startup so existing imported invoices can be corrected after parser improvements.
- Added targeted Hidroelectrica consumption extraction for billed energy totals instead of whichever `kWh` token appears first in the PDF.
- Added safer PDF path resolution for startup data repair in container deployments.

## Improvements

- Improved invoice data integrity by reparsing stored PDF invoices for supported providers during startup.
- Improved Hidroelectrica parsing to prioritize the invoice summary and metering sections before table-row fallbacks.
- Improved repair safety so only positive, trustworthy parsed values overwrite stored invoice amounts or consumption.

## Bug Fixes

- Fixed incorrect dashboard cost-per-unit values caused by misparsed Hidroelectrica consumption on existing invoices.
- Fixed older energy invoices that stored `8 kWh`, `1 kWh`, or `0 kWh` helper values instead of the billed consumption.
- Fixed startup repair logic to avoid writing invalid negative fallback consumption values.
