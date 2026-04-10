# UtilityMate v1.4.16

## New Features

- Added background scheduling for invoice PDF repair so startup fixes can run without blocking container readiness.
- Added a non-blocking startup repair flow for existing imported invoices.
- Added backend boot-time separation between schema migration and invoice data repair.

## Improvements

- Improved container startup reliability when a bind-mounted instance contains many PDFs to reparse.
- Improved backend readiness by letting FastAPI start before the invoice repair worker processes historical files.
- Improved deploy safety for MasterChief by avoiding false startup failures during long repair runs.

## Bug Fixes

- Fixed the boot loop where the container reported `Backend failed to start after 15 seconds` while invoice repair was still running.
- Fixed startup timing so backend health checks no longer fail just because historical PDF repair takes longer than the entrypoint wait window.
- Fixed the regression introduced by running invoice repair directly in the synchronous startup path.
