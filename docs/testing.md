# Verification and disposable PostgreSQL tests

## Fresh repository-hardening run: 2026-09-08
Node 24.14.1, PostgreSQL 17.10: **62 tests passed; 0 failed, 0 skipped**. TypeScript, ESLint, production frontend, compiled Node backend and PWA/OCR assets passed. The full unchanged baseline applied through the hardened runner and then reran idempotently. Catalog checks confirmed 14 FORCE-RLS app tables/26 policies and denied metadata access for the restricted runtime login.

31 existing tests passed again: password/encryption/session/CSRF/RBAC, input-authority rejection, tenant/no-context RLS, immutable history, 20-way idempotency, 12-way fraud counting, 10-way single-use coupons, password revocation/audit atomicity, actor queue mismatch and assist regressions.

31 migration cases added: private initialization/owner/RLS/grants; actual denied SELECT/INSERT/UPDATE/DELETE/TRUNCATE under API/runtime roles; exact hashes; repeat/timestamps; modified/missing files; unexpected text/directories/symlinks/duplicates/empty/invalid UTF-8; untouched legacy tracker; three concurrent runners; complete first/later rollback; altered RLS/schema/columns/ACLs/policies/owner/constraints; unknown namespace; ordered-prefix rejection; API exposure confirmation/observable configuration; inherited read privileges; global defaults; quoted non-BYPASSRLS owner; superuser API-role rejection.

## Safe setup and run
Use an isolated LOCAL PostgreSQL 17 cluster, never Supabase/production. No .env with real credentials is required. Supply test configuration through a private process environment:
- MIGRATION_TEST_DATABASE_URL: local administrative connection; no URL query/fragment overrides.
- MIGRATION_TEST_ALLOW_DATABASE_CREATION=true: explicitly allow disposable test databases/roles.
- TEST_ADMIN_DATABASE_URL: separate fresh local application test database.
- DATABASE_URL: restricted LOGIN with gateway membership in that application test database, not its administrator.
- APP_ORIGIN=http://localhost:3000 and NODE_ENV=development.

Apply the unchanged baseline to the fresh local application database using its administrator and FUELPULSE_PRIVATE_METADATA_CONFIRMED=true (there is no Data API on isolated PostgreSQL). Provision the restricted runtime login afterward. The migration suite creates/drops only uniquely named fuelpulse_migration_test_* databases on its validated loopback endpoint. It creates missing test roles and simulates Supabase grants; it temporarily changes roles for denial tests, so the entire cluster MUST be disposable. App suites retain randomized fixture rows for investigation.

```sh
npm run typecheck
npm run lint
npm run test:migrations
npm test
npm run build
```

Full npm test includes the migration suite and therefore requires both sets of local settings. Production URLs must NEVER be passed to these write tests. Environment URL checks are a guard, not permission to test against any tunnel/proxy to production.

## Evidence boundaries
Browser OCR/offline/three-role checks passed in the earlier reconstruction run; browser/device tests were NOT rerun for this migration-only change. Physical QR/camera/microphone, Android/Windows installation, real-world OCR, deployed TLS/proxy/pooler, Docker execution, independent penetration/load testing and backup restore remain release gates.

For existing browser QA, see scripts/local-qa.ts and scripts/browser-test.ts. These create fixtures and private random credentials outside the repo and must also run only locally. No production login/session/transaction operation is a read-only test. No GitHub Actions/hosted CI pass is claimed; workflow-write permission was previously denied.
