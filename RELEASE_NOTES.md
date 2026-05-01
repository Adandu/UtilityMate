# UtilityMate v1.9.15

## Security

- Replaced `python-jose` with `PyJWT` for HS256 token handling, removing the unused transitive ECDSA dependency flagged by CVE scanning.
- Slimmed Docker runtime package installs by removing compiler, development library, curl, and recommended package installs from production images.
- Removed unused transitive crypto packages from the backend lockfile, including `ecdsa`, `rsa`, and `pyasn1`.
- Reduced the main Docker image OS package footprint from 167 scanned packages to 104 scanned packages.

## Improvements

- Kept JWT behavior compatible with the existing `HS256` access-token flow.
- Replaced the container startup health probe with Python standard library HTTP checks so `curl` is no longer required at runtime.
- Added a writable Matplotlib cache directory for the container runtime to avoid startup cache warnings.

## Verification

- CVE MCP backend dependency scan: no known vulnerabilities found across 59 scanned Python packages.
- CVE MCP main image package scan: reduced findings from 14 vulnerable package groups to 10 vulnerable package groups.
- Backend tests passed: 7 tests.
- Frontend TypeScript and production build checks passed.
- Main and backend Docker images built successfully.
