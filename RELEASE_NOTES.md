# UtilityMate v1.4.23

## New Features

- Added explicit dashboard export status feedback so PDF export success or failure is visible in the UI.

## Improvements

- Improved dashboard PDF generation reliability by switching to the stable named `jsPDF` export and lowering capture scale to reduce browser-side failures.

## Bug Fixes

- Fixed the `Export Dashboard PDF` button appearing to do nothing when the browser-side PDF generation path failed silently.
