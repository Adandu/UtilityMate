# UtilityMate v1.5.2

## New Features

- Extended the avizier repair pass so it can also correct gas/heating category assignments when a winter statement layout uses the opposite column order.

## Improvements

- Winter avizier gas and heating charts now follow the utility names implied by the statement rows, not just the previous static column ordering.

## Bug Fixes

- Fixed winter avizier statements such as January 2026 `Ap 12` where heating and gas were still swapped even after the cost-pair repair.
