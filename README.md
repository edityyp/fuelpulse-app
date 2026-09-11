# FuelPulse

Fuel-station management PWA: React 19/TypeScript/Vite -> same-origin Fastify 5/Node 24 -> PostgreSQL 17. Custom staff-code authentication; no browser database credentials. **Locally verified deployment candidate; NOT deployed to production.**

## Current verification
2026-09-08 repository hardening: **62 tests passed, zero failed/skipped** (31 existing application/security tests + 31 migration cases). TypeScript, ESLint, production frontend/backend/PWA asset builds passed. Full baseline applied locally and repeated without duplicate execution. Earlier browser OCR/offline/role checks remain historical evidence; not rerun for this tracker-only change.

See SUPABASE_DEPLOYMENT_PLAN.md, IMPLEMENTATION_STATUS.md and docs/testing.md for evidence and limitations. docs/final-report.md describes the earlier reconstruction checkpoint, not this new hardening run.

## Source and business rules
src/ contains app/admin/transaction UI, OCR/QR/voice and IndexedDB sync; server/ contains auth/RLS/business/API; shared/ holds strict contracts; supabase/migrations/ holds the unchanged FORCE-RLS baseline. scripts/migration-runner.ts implements private checksummed history; scripts/migrate.ts is its CLI.

Integer paise/millilitres. Session supplies tenant/employee; server supplies amount/points/fraud. Immutable durable idempotency. Third and later same-plate/pump/station-day fills are fraud with zero points. Server acceptance determines price/day, including queued requests. Points ledger is append-only; spending is not implemented. Coupons are expiring plate-bound single-use entitlements, not monetary discounts.

Offline queue is device-local, requires original valid account for sync; no promised cold offline login/closed-app sync. OCR/voice require review/confirmation and OCR assets must first be downloaded.

## Local setup
Requires Node 24 and fresh disposable PostgreSQL 17. Authenticate securely to the private repository:
```sh
git clone https://github.com/edityyp/fuelpulse-app.git
cd fuelpulse-app
npm install
cp .env.example .env
```
Never commit private .env values. Configure MIGRATION_DATABASE_URL for the local administrative owner. Review SQL and confirm app/fuelpulse_meta are not API-exposed (or no Data API exists locally); only then set FUELPULSE_PRIVATE_METADATA_CONFIRMED=true.
```sh
npm run migrate
```
History is fuelpulse_meta.migrations with SHA-256 checksums, owner-only grants and RLS. Legacy public history, unsafe metadata, changed/missing files and non-prefix history abort. Do not erase history or modify applied SQL. Migration SQL is trusted administrative code and must not contain transaction-control commands.

Provision a separate LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS with fuelpulse_gateway membership. It must have no metadata access/owner membership. Set DATABASE_URL to that account; never run the server as migration owner. Configure APP_ORIGIN/PORT and private BOOTSTRAP_* secrets, bootstrap once, then remove admin/bootstrap secrets from runtime:
```sh
npm run bootstrap
npm run build
npm start
```
No default production password is shipped. Configure fuel prices and compatible pumps after signing in.

## Tests and deployment gates
```sh
npm run typecheck
npm run lint
# Disposable local migration/admin/runtime settings from docs/testing.md required:
npm run test:migrations
npm test
npm run build
```
Existing source ZIP includes the resolved package-lock.json and supports npm ci. GitHub dependency pins remain as before; that generated lockfile has not been newly uploaded by this tracker-only patch. No new dependencies were added. A previous GitHub workflow write was denied; no hosted CI pass is claimed.

Target is Supabase pbjftnlixuysmeotpsjc, host db.pbjftnlixuysmeotpsjc.supabase.co. Prior read-only audit found application-empty state and a matching database-host DNS address. **No Supabase writes/deployment are authorized or performed.** Reconfirm dashboard identity and hosted Data API exclusions (both app and fuelpulse_meta), staging/TLS/pooler behavior, secrets and backup readiness; obtain explicit database-write approval before deployment. Physical devices, Docker, sustained load, independent security and restore tests remain unverified. See docs/deployment.md.
