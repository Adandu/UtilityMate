# UtilityMate v1.4.39

## New Features

- Refactored the dashboard into three main utility groups: `Energy` (Hidroelectrica invoices), `Gas` (Engie invoices), and `Avizier`, with nested avizier utility subsections such as `Energy`, `Gas`, `Cold Water`, and `Hot Water`.

## Improvements

- Cost breakdowns, supplier charts, avizier charts, and summary widgets now keep supplier invoice data separate from avizier costs so unit pricing remains faithful to the original invoices.

## Bug Fixes

- Fixed mixed `Energy` and `Gas` dashboard calculations where avizier costs could inflate supplier unit-cost metrics by adding cost without corresponding invoice consumption.
