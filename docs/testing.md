# Fresh verification and test guide

## Current run, not historical
On 2026-09-08, reconstructed schema applied to isolated PostgreSQL 17.10. `npm run typecheck`, `npm run lint`, and `npm run build` passed. Build compiles Node backend to build/ and React frontend to dist/, then generates icons/service worker and installs self-hosted OCR assets. Production dependency audit reported zero known vulnerabilities.

24 tests passed, 0 failed in tests/security.test.ts: password hashing, authenticated credential encryption, strict authority-field rejection, idempotency/changed-payload conflict, twenty concurrent identical requests, sequential and twelve-way concurrent fraud, foreign pump/invalid IDs, RLS roles, foreign update/delete, no-context denial, append-only ledger/history/audit, employee read scope, privilege escalation denial, CSRF/anonymous denial, invalid QR, ten-way coupon redemption, expired/foreign coupon, session attributes/logout, expired session, database lockout/generic failures, audit/ledger integrity, queue actor mismatch.

The test named expired sessions and inactive staff directly asserts session expiry; inactive-user behavior is implemented in the shared authentication predicate but is not separately asserted by that test. Do not interpret the name as extra coverage.

Browser checks passed: owner administration screens, manager/employee navigation restrictions, desktop/390px widths without horizontal overflow, actual browser Tesseract recognizing a synthetic MH12AB1234 image with no auto-submit, service-worker activation, offline refresh, queue creation, another refresh preserving pending entry, reconnect resulting in one confirmed transaction, no API cache entries, no uncaught runtime errors.

## Run
```sh
npm install
npm run typecheck
npm run lint
npm run build
# Set TEST_ADMIN_DATABASE_URL and DATABASE_URL for an isolated local test DB
npm test
```
Tests create randomized fixture organizations and retain them for investigation. Never point tests at production. The admin test URL is deliberately restricted to localhost/127.0.0.1. Runtime URL should be a LOGIN role with membership in fuelpulse_gateway, not a superuser.

For browser QA run scripts/local-qa.ts once against a fresh isolated database. It creates local-only random credentials in /data/fuelpulse-qa.env outside the project. Start the server using that environment, create /data/plate-fixture.png with black MH12AB1234 on a white background, then run scripts/browser-test.ts with that environment. CHROMIUM_PATH overrides /usr/local/bin/chromium. The supplied browser script writes PNG/HTML snapshots to /data/fuelpulse-qa.

## Manual release checklist — NOT VERIFIED
For every role: correct/wrong login, lockout, logout, expiry, revoked access, navigation and direct forbidden API requests; allowed staff/pump/coupon actions and owner-only settings/audit; credential reveal/reset and audit.

Transactions: real multi-device fills, cross-tenant access, key conflict recovery, midnight/timezone behavior, price changes while offline, rejected pump and permanent queue failures; physical plate OCR with angle/glare/dust/low light; manual correction; real QR camera, invalid/wrong-plate/expired coupon; actual microphone voice and unsupported/denied permissions.

PWA: Android Chrome and Windows Chrome/Edge installation/cold launch, rotation, new worker update with queued requests, multiple tabs, shared-device logout/login, browser-storage eviction, keyboard/screen-reader/outdoor usability.

Operations: production TLS and DB certificates, proxy/WAF limits, sustained load and memory sizing, backup restoration, secret rotation, incident alerts. Automated tests are not independent penetration testing.

Visual status: dashboard screenshot inspected. All major screens were rendered and structurally checked by the browser test, but full human-style visual inspection was interrupted by a sandbox restart. Remaining visual inspection is NOT VERIFIED.
