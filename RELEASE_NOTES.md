# UtilityMate v1.4.24

## New Features

- Added a backend-generated dashboard PDF export endpoint that produces a real downloadable report for the active location and period filters.

## Improvements

- Reused the same dashboard analytics payload for both the web view and PDF export so the downloaded report matches the current dashboard filters and summaries.

## Bug Fixes

- Fixed the recurring dashboard export failure caused by browser-side chart capture timing and DOM rendering issues.
