# UtilityMate v1.4.18

## New Features

- Added an About page with the running version, latest changelog, safe environment details, and instance statistics.
- Added invoice pagination with configurable page sizes so the invoice list can browse beyond the latest 100 records.
- Added invoice filters for location, provider, and status, plus a new per-invoice consumption column in the main list.

## Improvements

- Replaced the hardcoded sidebar version text with a cleaner product label and moved version visibility into the new About page.
- Improved dashboard tooltips so cost, consumption, and unit-cost charts always show the correct units in the hover overlay.
- Standardized dashboard chart labels to consistent names such as `Cost`, `Consumption`, `Unit Cost`, and `Historical Baseline`.

## Bug Fixes

- Fixed manual meter readings being undeletable from the Operations Center by exposing the existing delete flow in the UI.
- Fixed invoice browsing being capped to the most recent 100 entries with no way to move through older data.
- Fixed inconsistent dashboard tooltip naming such as `unit_cost`, `cost`, and `Cost / Unit` appearing side by side.
