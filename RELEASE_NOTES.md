# UtilityMate v1.5.1

## New Features

- Added an avizier repair pass that reparses stored association statements and corrects imported gas and heating line amounts from their source PDFs.

## Improvements

- Avizier gas and heating dashboard sections now follow the actual statement row cost values instead of using the wrong side of the quantity/cost pair.

## Bug Fixes

- Fixed avizier heating and gas costs being underreported because the parser was storing the first value in each pair instead of the monetary cost value.
