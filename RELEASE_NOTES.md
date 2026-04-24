# UtilityMate v1.9.12

## New Features

- No new features in this release.

## Improvements

- Made Avizier profile detection header-aware so unknown future months can reuse the correct known BlocManager column layout without requiring another month-specific parser update.

## Bug Fixes

- Preserved compatibility with older Avizier PDFs that end rows with trailing apartment-and-balance tokens such as `1 280,00` while keeping support for split values like `1 640,49` and `- 106,90`.
