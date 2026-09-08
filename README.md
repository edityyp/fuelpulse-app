# FuelPulse

Reconstructed fuel-station operations application. **Actual source lives in this repository.** This is a locally tested implementation, NOT a production deployment or security certification.

## Current verification
Fresh local verification on 2026-09-08: 24 PostgreSQL/API/security tests passed; TypeScript, ESLint and production frontend/backend builds passed. Chromium tested all three roles, a synthetic plate through real browser OCR, offline refresh/queue persistence, reconnect to one confirmed transaction, and no API service-worker caching. Historical results from the lost project are NOT used as evidence. See IMPLEMENTATION_STATUS.md.

## Architecture
React 19 + strict TypeScript + Vite 8 PWA → same-origin Fastify 5 Node 24 API → PostgreSQL 17. Supabase-hosted PostgreSQL is a deployment option. Custom staff-code authentication; no browser DB token or Supabase Auth dependency. Privileged logic stays in Node rather than duplicated Edge Functions.

## Repository structure
- src/: app shell, transaction form, admin screens, API client, input assistance, IndexedDB queue
- server/: authentication, crypto, RLS transaction wrapper, transaction engine, APIs, startup, disabled WhatsApp interface
- shared/: Zod validation and TypeScript contracts
- supabase/migrations/: additive schema with FORCE RLS
- scripts/: migration, owner bootstrap, build-time PWA/OCR assets, isolated QA setup/browser test
- tests/: fresh database/API/security/concurrency suite
- docs/: architecture, schema, API, security, testing, deployment and operations

## Requirements
Node 24+, npm, PostgreSQL 17. Docker is optional for native PostgreSQL; required for full Supabase local stack (not tested here). Chromium is required for browser QA. Python/Pillow were used to create a synthetic OCR fixture during testing, not at runtime.

## Run locally
Clone this private repository using your own secure GitHub authentication:

```sh
git clone https://github.com/edityyp/fuelpulse-app.git
cd fuelpulse-app
npm install
cp .env.example .env
```

Configure a FRESH local database. Put its private administrator URL in MIGRATION_DATABASE_URL. Inspect `supabase/migrations/202609080001_initial.sql`, then:

```sh
npm run migrate
```

If `app` schema or named roles already exist, STOP and reconcile history; never reset an unknown database. Provision a private LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS role with membership in `fuelpulse_gateway`, set its password securely through the database console/secret manager, and use it for DATABASE_URL. Never use the migration administrator as the long-running application identity.

Set BOOTSTRAP_STATION (lowercase station slug), BOOTSTRAP_NAME, BOOTSTRAP_CODE and BOOTSTRAP_PASSWORD (12+ characters) privately in the environment:

```sh
npm run bootstrap
npm run build
npm start
```

Open http://localhost:3000 and sign in with the new station/staff credentials. Configure fuel prices first, then create pumps with fuel compatibility. No default production passwords are shipped. Remove bootstrap and migration secrets from the runtime environment afterward.

`npm run dev` watches TypeScript backend files and serves the latest built frontend. After frontend changes run `npm run build`; no separate Vite HMR proxy is configured.

## Commands
```sh
npm run typecheck
npm run lint
npm run build
# Only with TEST_ADMIN_DATABASE_URL and DATABASE_URL for isolated local test DB:
npm test
# Running local QA server and QA_STATION/QA_PASSWORD required:
npm run test:browser
```
The browser test expects `/data/plate-fixture.png` containing MH12AB1234 and writes screenshots under `/data/fuelpulse-qa`. See docs/testing.md. The downloadable source checkpoint includes the locally resolved package-lock.json. GitHub currently pins direct dependencies; synchronization of the generated lockfile is a remaining reproducibility task. CI workflow creation was denied by the integration's permissions; no GitHub Actions run is claimed.

## Important business behavior
- Amounts use integer INR paise; volume uses integer millilitres.
- Organization/employee come from the session; amount/points/fraud come from the server.
- One idempotency key has one immutable logical transaction. Changed payload conflicts.
- Third AND all later same-plate/same-pump/day accepted entries are flagged, with zero points.
- Server acceptance determines station-local day and fuel price, including offline entries.
- Points ledger is append-only. Balance lookup is available; points spending is not implemented.
- Coupons are expiring plate-bound single-use entitlements, not currency discounts or automatic points redemption.
- Pending count is this device only. Sync requires the application to be open; no closed-app background sync guarantee.
- Offline refresh works in an existing tab with session UI cache. Cold offline login is not supported.
- OCR and voice require user review; neither can automatically submit. First-use OCR needs downloaded assets.

## Production boundaries
Supabase project riywnbifqpsylsdocoyi (organization ixzbspygpwezetndczvm) is NOT connected, inspected or modified. Remote schemas must be inspected read-only before any deployment approval. No production reset/drop/truncate was run.

Android/Windows installation, physical camera/microphone, real-world OCR accuracy, deployed TLS/proxy behavior, independent penetration testing, load/restore drills, and key rotation are NOT VERIFIED. Read docs/security.md and docs/deployment.md before live operation.
