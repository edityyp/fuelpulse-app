# FuelPulse

Locally tested fuel-station management PWA reconstructed from scratch. Actual source is permanently committed here. **Not production deployed or certified.** See IMPLEMENTATION_STATUS.md and docs/final-report.md for current boundaries.

## Current verification
2026-09-08: **31 automated tests passed**, zero failed; PostgreSQL 17 migration, TypeScript, ESLint, frontend/backend builds passed. Chromium verified three roles, synthetic plate through real browser OCR, offline refresh/queue persistence, reconnect to one confirmed record, no API service-worker caching, and no uncaught errors. Historical lost-build results are NOT used.

## Architecture and source
React 19 + TypeScript + Vite 8 PWA → same-origin Fastify 5 / Node 24 → PostgreSQL 17 (Supabase-hosted PostgreSQL is a deployment option). Custom staff-code authentication, no browser DB credentials.

src/: app/admin/transaction screens, API, OCR/QR/voice, IndexedDB sync.
server/: authentication, crypto, RLS transaction wrapper, business engine and operational APIs.
shared/: strict Zod contracts.
supabase/migrations/: additive schema with FORCE RLS.
scripts/: migration, owner bootstrap, PWA/OCR assets and local/browser QA.
tests/: security, concurrency, password and assistance regressions.
docs/: architecture, database, API, security, testing, deployment, operations and final report.

## Local setup
Requires Node 24+, npm, PostgreSQL 17. Authenticate securely to the private repository:

```sh
git clone https://github.com/edityyp/fuelpulse-app.git
cd fuelpulse-app
npm install
cp .env.example .env
```

Configure a FRESH local PostgreSQL database and its private administrator MIGRATION_DATABASE_URL in .env. Inspect the migration before applying:

```sh
npm run migrate
```

If `app` schema/named roles already exist, stop and reconcile; never reset an unknown database. Provision a private LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS role with membership in fuelpulse_gateway. Set credentials via secure database console/password prompt, and set DATABASE_URL to that runtime account. Never run the app as migration administrator.

Set BOOTSTRAP_STATION (lowercase slug), BOOTSTRAP_NAME, BOOTSTRAP_CODE, BOOTSTRAP_PASSWORD (12+ characters), APP_ORIGIN=http://localhost:3000 and PORT=3000 privately:

```sh
npm run bootstrap
npm run build
npm start
```

Open http://localhost:3000. Sign in, configure fuel prices, then compatible pumps. No default production password is shipped. Remove bootstrap/admin secrets from runtime after initialization.

```sh
npm run typecheck
npm run lint
npm run build
# Isolated LOCAL TEST_ADMIN_DATABASE_URL + restricted DATABASE_URL required:
npm test
# Running local QA server, QA_STATION/QA_PASSWORD and OCR fixture required:
npm run test:browser
```

See docs/testing.md for fixture setup. `npm run dev` watches backend TS and serves the latest built frontend; run build after frontend changes. No Vite HMR proxy configured. The source ZIP includes the resolved package-lock.json (use npm ci with that ZIP); GitHub currently contains direct dependency pins but not the generated lockfile. CI workflow creation was denied by integration permissions.

## Business rules
Integer paise and millilitres. Session supplies organization/employee; server supplies amount/points/fraud. Immutable records and durable idempotency. Third and later accepted same-plate/pump/station-day fills flagged with zero points. Price/day use server acceptance, including offline requests. Points ledger is append-only; spending is not implemented. Coupons are expiring plate-bound single-use entitlements, not monetary discounts.

Pending count is this device; foreground/manual/reconnect sync requires valid original account. Existing-tab offline refresh supported, cold offline login and closed-app sync not guaranteed. OCR/voice always require review and confirmation; first-use OCR requires downloaded assets.

## Production gates
Supabase target riywnbifqpsylsdocoyi, organization ixzbspygpwezetndczvm: NOT connected/inspected/modified. Read-only discovery then staging rehearsal and explicit production approval required. No remote reset/drop/truncate.

Physical camera/microphone, Android/Windows installation, real-world OCR, deployed TLS/proxy, Docker execution, independent penetration/load/backup-restore testing remain NOT VERIFIED. Read docs/security.md and docs/deployment.md before live operation.
