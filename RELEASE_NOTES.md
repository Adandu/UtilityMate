# UtilityMate v1.4.36

## New Features

- Added avizier apartment total repair support so dashboard totals can be rebuilt from each statement row's printed monthly total.

## Improvements

- Dashboard avizier monthly totals and top-level spend summaries now prefer the statement row total instead of rebuilding that figure from parsed detail lines.

## Bug Fixes

- Fixed the `Avizier Cost per Month` graph undercounting statements like `Ap 15` February 2026 when detail-line parsing did not fully match the document layout.
