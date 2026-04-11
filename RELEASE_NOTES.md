# UtilityMate v1.4.26

## New Features

- Tightened ENGIE invoice date extraction so dashboard gas trends use the actual invoice month even when PDFs include extra notification pages ahead of the bill.

## Improvements

- Existing PDF repair logic can now correct affected ENGIE invoice dates on startup by reparsing the stored files with the more precise date matcher.

## Bug Fixes

- Fixed ENGIE invoices such as `2023-12-18 - ENGIE.pdf` being bucketed into the wrong month, which distorted dashboard gas history and baseline calculations.
