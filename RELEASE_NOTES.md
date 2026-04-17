# UtilityMate v1.8.2

## New Features

- No new features in this release.

## Improvements

- Improved invoice parsing for Hidroelectrica and Engie so UtilityMate now stores billing periods and old/new meter indexes alongside imported invoices.
- Improved meter-to-invoice reconciliation so Meter Readings can link invoices using billing intervals instead of relying only on issue dates.

## Bug Fixes

- Fixed Hidroelectrica sequences where a reading could be linked to the invoice issued on the same day even though that invoice billed an earlier consumption period.
- Fixed Engie gas linking so interval-based invoices continue to match the correct reading and do not attach to later readings after the billed period has ended.
