# UtilityMate v1.7.0

## New Features

- Added a dedicated `Meter Readings` section with stream-based history, device labels, inline editing, and invoice-aware reading context.
- Added separate meter stream summaries so apartments can track multiple devices in the same category, such as kitchen water, bathroom water, and room-level heat meters.

## Improvements

- Meter history now calculates the difference against the previous reading for each individual stream instead of flattening everything into one category-level list.
- Operations now links out to the dedicated Meter Readings workspace instead of mixing raw measurement management into the broader operations view.

## Bug Fixes

- Fixed the old one-reading-per-category-per-day limitation by migrating meter uniqueness to `location + category + meter label + date`.
- Fixed meter workflows so existing invoices remain the single billing source while readings can still be linked back for reconciliation.
