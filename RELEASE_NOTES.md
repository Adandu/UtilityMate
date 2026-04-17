# UtilityMate v1.7.13

## New Features

- Added a mobile navigation drawer so authenticated users can move through UtilityMate on phones without relying on the desktop sidebar.

## Improvements

- Page layouts now use mobile-first spacing and only apply the desktop sidebar offset on medium screens and above.
- Invoice Review Desk now shows stacked mobile cards with touch-friendly actions instead of forcing the full desktop table on small screens.
- Meter Readings now uses mobile cards for reading history and tighter filter/form layouts to reduce horizontal overflow.

## Bug Fixes

- Fixed a mobile layout bug where hidden desktop navigation still reserved `ml-64`, wasting a large portion of the viewport on phones.
