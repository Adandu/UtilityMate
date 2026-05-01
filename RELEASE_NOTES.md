# UtilityMate v1.9.15

## Security

- Replaced `python-jose` with `PyJWT` for HS256 token handling, removing the unused transitive ECDSA dependency flagged by CVE scanning.
- Slimmed Docker runtime package installs by removing compiler, development library, curl, and recommended package installs from production images.

## Improvements

- Kept JWT behavior compatible with the existing `HS256` access-token flow.
