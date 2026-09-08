# Architecture

Browser React/TypeScript PWA → same-origin Fastify Node 24 backend → PostgreSQL 17, deployable to Supabase PostgreSQL. Database schema `app` remains private; no browser DB credentials or direct Data API access. All privileged logic is server-side; no Edge Functions are needed. WhatsApp is an explicit disabled interface, never a fake success.

## Trust boundaries
`shared/contracts.ts` rejects unknown transaction authority fields. `server/auth.ts` resolves actor from hashed opaque session token. `server/db.ts` begins a transaction, SET LOCAL ROLE, then transaction-local organization/actor/role context. `server/transactions.ts` owns atomic sale effects. `server/routes.ts` handles validated operations. RLS complements server checks; database credentials are a trusted boundary, not issued to browsers.

## Roles
OWNER: manage managers/employees, pumps/prices, transactions, points/coupons, reward settings and audit log. MANAGER: manage employees only, operational pumps/prices/reports/points/coupons; cannot change owner settings or view audit log. EMPLOYEE: create fuel records, read own history, redeem coupons. All roles may change their own password, invalidating sessions. No runtime user edits historical transactions, points ledger or audits.

## Atomic transaction algorithm
1. Validate and normalize input; hash canonical parsed payload.
2. Advisory transaction lock on organization + idempotency UUID.
3. Return existing result when actor/payload matches; conflict otherwise. A unique database constraint is the final duplicate guarantee.
4. Shared catalog advisory lock prevents concurrent price/pump edits while calculating. Managers acquire the matching exclusive lock.
5. Atomically UPSERT daily bucket (organization,pump,plate,station-local date) and return incremented ordinal.
6. First two accepted records normal; third and later flagged. Never SELECT count then INSERT.
7. Round quantity_ml × current price_paise / 1000; points=floor(quantity_ml × policy / 1000), zero if flagged.
8. Insert transaction, points ledger and audit in ONE transaction. Rollback all effects on failure.

This is exactly-once business effect, not exactly-once network delivery. Retry never increments the fraud counter twice. Station-local day and price use server acceptance time, not offline capture time.

## Offline and PWA
IndexedDB stores request, key, user/org scope, time and failure. Local UI catalog/identity cached only in sessionStorage for same-tab offline refresh, never as server authority. Drain verifies /me and includes an expected-actor header to reject cross-account races. Web Locks serialize same-browser drains; database uniqueness protects all devices. Reconnect, manual retry and 30-second foreground timer drive sync. HttpOnly cookies are not stored in JS storage. Successful entries are removed only after server response.

Service worker precaches hashed shell assets, not API responses. OCR worker/WASM/model are self-hosted in built dist/ocr; images stay in-browser. First-use offline OCR is not supported. Voice availability depends on browser/provider. OCR/QR/voice cannot bypass confirmation or server validation.
