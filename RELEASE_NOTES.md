# UtilityMate v1.7.6

## New Features

- Added automatic GitHub release publishing from `VERSION` and `RELEASE_NOTES.md` updates on `main`.

## Improvements

- Docker images published from `main` now also receive the current app version tag without requiring a separate Git tag push.

## Bug Fixes

- Fixed release automation getting stuck at `v1.7.2` when newer versions updated local release files but never received a matching Git tag.
