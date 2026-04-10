# UtilityMate v1.4.22

## New Features

- Added dashboard PDF export that captures the currently selected location and period view.
- Added separate avizier-driven dashboard categories for `Cold Water`, `Hot Water`, `Shared Water`, and `Storm Water`.

## Improvements

- Improved avizier insight by splitting water streams into distinct categories instead of merging them into one generic water bucket.
- Improved dashboard exports by automatically expanding category sections before capture so the PDF contains the active chart set.
- Improved client-side dashboard export reliability by bundling dedicated PDF and canvas capture libraries with the frontend.

## Bug Fixes

- Fixed avizier water analytics being flattened into a single category, which hid month-to-month movement between cold and hot water.
- Fixed the lack of a filter-aware PDF export path for dashboard graphs and summary cards.
