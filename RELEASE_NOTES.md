# UtilityMate v1.10.1

## Fixes

- Association statement (avizier) imports no longer guess a column layout by borrowing a different month's profile when the export template changes. Each statement's own header row is now read directly to detect its actual columns, including when a reading-fee column is duplicated instead of replaced (a real drift we found affecting recent imports, where amounts landed under the wrong charge category from one month to the next).
- Association statements now carry a `needs_review` flag and an explanatory note whenever the parser can't confidently match a statement's header to its own row data, instead of silently trusting a fallback guess.
- Existing imported statements are automatically re-parsed and corrected on the next app restart using this improved detection, with no manual data fix needed.
- Fixed a due-date extraction bug on Hidroelectrica and Engie invoices where an unrelated line of text between the "due date" label and its value could prevent the date from being found at all.

# UtilityMate v1.10.0

## Security

- Fixed a cross-tenant data leak: creating or updating a budget no longer accepts a `location_id`/`household_id` that doesn't belong to the current user.
- Rate limiting now sees the real client IP instead of the internal nginx address, so login/register/upload throttling applies per client again instead of sharing one global bucket.
- Added rate limiting to the change-password endpoint.
- Adding a household member now validates the referenced user exists before creating the membership.
- Bumped `pyjwt`, `python-multipart`, and `starlette` to versions with known CVEs patched.

## Improvements

- Invoice and association-statement number parsing now correctly detects US vs. European decimal/thousands separators instead of assuming European formatting whenever both `,` and `.` appear.
- Meter-index parsing no longer strips the decimal point, fixing a 100x error on non-integer readings.
- Generic-provider invoice parsing requires a plausible amount label/currency anchor instead of matching the first number near the word "total".
- Parsed invoices with an implausible amount or date are now flagged for review with an explanation instead of being silently accepted.
- PDF parsing for invoices and association statements now runs off the request thread so large uploads no longer block the API.
- PDF text extraction failures (encrypted, corrupted, or genuinely scanned files) are now logged with the actual cause instead of failing silently.
- Association statement imports now show a review screen listing every parsed line item after import.
- The invoice edit screen can now correct amount, invoice date, consumption value, provider, and location — not just status and notes.
- Invoice and association statement uploads now time out and can be cancelled instead of leaving the modal stuck on a hung request; error messages now show the actual backend reason.
- Fixed a memory leak where exported file downloads on the raw data and operations pages never released their object URLs.

## Verification

- Backend test suite (18 tests, including new locale/decimal-parsing regression tests) passed inside the production container image against the updated source.
- Frontend TypeScript and production build checks passed.
