# UtilityMate v1.9.8

## New Features

- No new features in this release.

## Improvements

- No new improvements in this release.

## Bug Fixes

- Stopped invoice list and review queue responses from mutating invoice ORM rows while backfilling derived review state for API output.
- Fixed rent statement source-summary preloading so association statements remain included when `posted_date` shifts the effective month across a statement-month boundary.
