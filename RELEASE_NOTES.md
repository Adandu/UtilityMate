# UtilityMate v1.5.3

## New Features

- Rebuilt the winter avizier gas/heating parser model so those columns are interpreted as adjacent charge fields instead of pseudo-meter pairs.

## Improvements

- Winter avizier monthly profiles now preserve row-length matching while correctly extracting gas and heating costs from the statement layout.

## Bug Fixes

- Fixed January 2026 and similar aviziers where gas and heating were still wrong because the parser model itself did not match the layout structure.
