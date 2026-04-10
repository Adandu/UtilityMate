# UtilityMate v1.4.19

## New Features

- Added a more reliable About experience that now surfaces live version and release information from the deployed app files.

## Improvements

- Improved backend project-file discovery so Docker deployments resolve `VERSION` and `RELEASE_NOTES.md` from the application root instead of the process working directory.
- Improved the Raw Data view to work with the new paginated invoice API while still loading a wider export-friendly dataset.

## Bug Fixes

- Fixed the About page showing `unknown` for Current Version and API Version in container deployments.
- Fixed the About page showing `Latest Release Notes are not available` even when release notes existed in the app directory.
- Fixed the Raw Data page crash `e.filter is not a function` caused by treating the paginated invoice response as a plain array.
