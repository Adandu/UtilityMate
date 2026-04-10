# UtilityMate v1.4.20

## New Features

- Added release metadata to the production container image so deployed instances can expose the correct version and changelog details.

## Improvements

- Improved Docker packaging by copying `VERSION` and `RELEASE_NOTES.md` into `/app`, matching the runtime paths used by the API and About page.

## Bug Fixes

- Fixed the About page still showing `unknown` and missing release notes in deployed containers even after the backend lookup logic was corrected.
