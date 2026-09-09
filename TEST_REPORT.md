# FuelPulse Test Report

## Source verification

Verified before the production deployment:

- TypeScript typecheck: passed.
- ESLint: passed.
- Production frontend/backend/PWA build: passed.
- Automated test suite: 63 passed, 0 failed, 0 skipped.
- Railway Docker build uses reproducible `npm ci`.
- Repository/deployment diff secret scan: passed.
- Supabase root certificate fingerprint check: passed.

## Live API and security QA

Thirteen production checks passed:

1. OWNER login and secure cookie.
2. OWNER-created staff, fuel, and pump.
3. MANAGER login and secure cookie.
4. MANAGER dashboard access and OWNER-only API denial.
5. EMPLOYEE login and secure cookie.
6. EMPLOYEE administration denial.
7. Server-authoritative amount and points, third-fill fraud, and durable idempotency.
8. Atomic single-use coupon redemption under ten concurrent attempts: one success, nine conflicts.
9. Append-only points balance equals accepted awards.
10. Manager dashboard reflects live records.
11. OWNER audit trail records fraud and coupon redemption.
12. Cross-origin state change rejected.
13. Logout revokes the session.

## Live PWA/browser QA

Nine production browser checks passed in mobile viewport:

1. EMPLOYEE browser login and transaction UI.
2. Valid manifest and install icons.
3. Service worker installation and control.
4. API data excluded from service-worker caches.
5. Offline reload and IndexedDB queue persistence.
6. Reconnect synchronization creates exactly one transaction.
7. Synthetic plate OCR with manual confirmation required.
8. No horizontal mobile overflow.
9. No uncaught browser errors.

## Final production data integrity

- Organizations: 1
- Users: 3
- Immutable QA transactions: 5
- Points-ledger rows: 5
- Fraud transactions: 2
- Redeemed coupons: 1
- Ledger mismatches: 0
- Duplicate idempotency keys: 0

## Manual/unverified items

- Real camera and physical plate conditions.
- Real microphone and environmental voice accuracy.
- Native install UX on each intended device/OS.
- Supabase backup restoration/PITR drill.
- Latest GitHub Actions UI status was not independently retrieved; the same source was independently typechecked, linted, built, tested, deployed by Railway, and exercised live.
