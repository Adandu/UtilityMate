# UtilityMate v1.4.13

## New Features

- Added a live progress bar for bulk invoice uploads so large PDF batches show clear in-flight activity.
- Added post-upload parsing feedback that lists each imported file with provider, date, amount, and review confidence.
- Added per-file success and failure summaries in the upload modal so bulk imports can be verified immediately.

## Improvements

- Kept the upload modal open after bulk import completion so parsing results remain visible instead of disappearing instantly.
- Expanded the upload API response to include parser confidence and review-state details for each successful invoice.
- Improved the bulk import call-to-action so the same modal can be reused for follow-up batches after reviewing results.

## Bug Fixes

- Fixed the lack of visual feedback during multi-file invoice uploads.
- Fixed the missing confirmation path for whether each uploaded invoice parsed correctly.
- Fixed the workflow gap where upload success or failure details were hidden unless the user manually refreshed the invoice list.
