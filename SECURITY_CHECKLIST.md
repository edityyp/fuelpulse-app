# Security Checklist

Verified on production on 2026-09-09.

## Identity and access

- [x] OWNER, MANAGER, and EMPLOYEE authorization tested live.
- [x] Unknown/anonymous user is denied.
- [x] Passwords use salted scrypt hashes.
- [x] Sessions are revocable and expire server-side.
- [x] Cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`.
- [x] Logout revokes the session.
- [x] Persistent login lockout tables exist.
- [x] Exactly one Railway proxy hop is trusted for client-IP controls.

## Tenant and database security

- [x] Correct Supabase project: `pbjftnlixuysmeotpsjc`.
- [x] 14 canonical `app` tables.
- [x] ENABLE RLS and FORCE RLS on all 14 tables.
- [x] 26 RLS policies.
- [x] Runtime role is non-superuser, NOINHERIT, NOBYPASSRLS, and cannot access migration metadata.
- [x] API roles cannot use the private application schema directly.
- [x] Tenant context is server-controlled.
- [x] Transactions and points ledger are immutable through application privileges.

## Business integrity

- [x] Price, amount, points, and fraud decisions are server-authoritative.
- [x] Third and later same station + pump + plate + business-day fills produce fraud=true and zero points.
- [x] Durable idempotency returns the original result and rejects payload conflicts.
- [x] Concurrent single-use coupon redemption allows exactly one success.
- [x] Points ledger is append-only.
- [x] Final production verification found zero ledger mismatches and zero duplicate idempotency keys.

## Web and PWA security

- [x] HTTPS and HSTS.
- [x] CSP, `nosniff`, frame protection, and no-referrer policy.
- [x] Cross-origin state-changing request rejected.
- [x] Service-worker cache excludes API data.
- [x] Offline queue persists in IndexedDB and synchronizes exactly once.
- [x] OCR result requires manual confirmation before submission.

## Operational follow-ups

- [ ] Complete a physical-device camera, microphone, and install test.
- [ ] Confirm current Supabase backup/PITR entitlement and complete a restore drill.
- [ ] Review the remaining Supabase advisor note about mutable function `search_path`; functions are schema-qualified, but a dedicated reviewed migration can pin their search paths.
- [ ] Rotate/deactivate acceptance-test staff credentials after client acceptance.
