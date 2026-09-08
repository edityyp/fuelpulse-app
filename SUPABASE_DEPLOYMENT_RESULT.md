# FuelPulse — controlled deployment result

## DEPLOYMENT BLOCKED

Date: 2026-09-08. Target preflight observations: 11:44:29–11:45:07 UTC (17:14:29–17:15:07 Asia/Kolkata).

**Deployment authorization was received for the verified new project. This supersedes earlier documentation saying approval was pending. The stop is technical, not a request for repeated approval. No hosted migration was started.**

## 1. Repository verification
GitHub main was confirmed at `5062e3c342a1d2513256100ac61a2817cbec5653`. The clean local source snapshot's required file blobs match the previously read-back remote commit:

| File | Git blob |
|---|---|
| scripts/migrate.ts | 313140be051429d1314396d4cc2182c34e31d612 |
| scripts/migration-runner.ts | 0790b28ffee6eebd1ad31563c90b6ee9ae3f998f |
| tests/migration-runner.test.ts | 4cf3017215780e74e30708e2dae56ca13e36375e |
| supabase/migrations/202609080001_initial.sql | 24898a751e2979c9147d11ef84c52106e2da0746 |

The application migration was not rewritten or regenerated. Local snapshot commits are not represented as native clones of remote history; equivalence was verified using content hashes.

## 2. Target identity and old-project exclusion
Intended project: `pbjftnlixuysmeotpsjc`.

The connected database reported PostgreSQL 17.6, database postgres, port 5432, server address `2406:da12:5ca:b700:f375:a98c:b36d:e132`. Fresh DNS for `db.pbjftnlixuysmeotpsjc.supabase.co` returned that exact address. DNS for the excluded old project's hostname returned a different address, `2406:da18:1691:a201::200b`.

This corroborates the new project at database-host level rather than from a display name. Direct project-ref/name/API-URL settings remain unavailable through MCP. No database connection was made to the old project's hostname; its comparison was a public DNS lookup only. **Old project riywnbifqpsylsdocoyi was not modified or queried as a database.**

## 3. Exact stop conditions (session 1)
- The only Supabase connection uses `supabase_read_only_user`.
- Both transaction_read_only and default_transaction_read_only are on.
- That inspection role has no CREATEROLE permission.
- MCP exposes only documentation/catalog reads and read-only SQL; it does not supply a native Node/PostgreSQL migration connection.
- `MIGRATION_DATABASE_URL` is unavailable in the intended process environment and project .env. No project .env exists.
- Runtime `DATABASE_URL` is also unavailable there, so an application connection cannot be checked.
- Hosted Data API exclusions cannot be independently read: pgrst.db_schemas is NULL and relevant visible database/role settings are empty. This does not establish that the Data API is disabled or private schemas are excluded.
- `FUELPULSE_PRIVATE_METADATA_CONFIRMED` is not true. It was not set merely to bypass the runner's gate.

The runner was NOT invoked against Supabase. No raw SQL deployment, permission escalation, read-only-setting override, alternate migration path or destructive recovery was attempted. There is no hosted transaction whose rollback must be determined.

## 4. Pre-deploy inventory / schema verification
Fresh SELECT-only catalogs returned only auth, extensions, graphql, graphql_public, public, realtime, storage and vault schemas. Public has no relations. No app or fuelpulse_meta schema, FuelPulse roles/routines/policies, legacy public tracker, private tracker or Supabase CLI tracker were found.

| Expected application table | Hosted result |
|---|---|
| app.organizations | Absent |
| app.users | Absent |
| app.credentials | Absent |
| app.sessions | Absent |
| app.login_limits | Absent |
| app.login_events | Absent |
| app.pumps | Absent |
| app.fuels | Absent |
| app.pump_fuels | Absent |
| app.daily_counts | Absent |
| app.transactions | Absent |
| app.points_ledger | Absent |
| app.coupons | Absent |
| app.audit_logs | Absent |

Therefore no FuelPulse application data/deployment was found that could be overwritten. Existing Supabase platform objects were left untouched. Same unqualified names in platform schemas are not FuelPulse application tables.

## 5. Migration and checksum
Prepared file: `supabase/migrations/202609080001_initial.sql`.

SHA-256 of the unchanged repository file:

`92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44`

**This is the source-file checksum, NOT a deployed history checksum.** No migration was deployed; no applied filename/hash/timestamp/order exists on the target to verify.

## 6. Hosted RLS, policies, metadata, grants and exposure
- 14-table deployment verification: not applicable; all 14 remain absent.
- Application ENABLE/FORCE RLS: not deployed, not a hosted pass.
- Expected 26 application policies: 0 deployed; no policy logic changed.
- fuelpulse_meta.migrations: absent; no hosted owner/ACL/RLS verification can be claimed.
- public.fuelpulse_migrations: absent; no public history table was created.
- Private metadata/application grant safety: no new objects or grants were introduced. The prior public-default-grant risk remains a reason to use the hardened runner, not to deploy raw SQL.
- Hosted Data API exclusion: unverified, remains a gate.
- Hosted tenant/IDOR/runtime behavior: not tested against nonexistent app objects. Local regression evidence is separate.

No unrelated hosted objects, functions, extensions, auth/storage configuration, data or policies were changed. Post-deployment phases were not represented as completed.

## 7. Local tests and builds
Fresh final local rerun: **62 passed, 0 failed, 0 skipped** (31 existing application/security cases and 31 migration cases). TypeScript, ESLint, production frontend, compiled backend and PWA/OCR asset build passed.

The first rerun encountered `ECONNREFUSED` on loopback because the sandbox had lost PostgreSQL tooling/running processes. That attempt had 4 passing assist tests and 58 hook/connection failures; the chained build did not run. Restored PostgreSQL 17 tooling and restarted the existing disposable local cluster without resetting its data. The complete suite and build then passed. No application or migration-code change was needed.

All writes/concurrency/rollback tests used disposable local PostgreSQL only, never Supabase. These results do not demonstrate a hosted deployment or full production/device/operational readiness.

## 8. Documentation / repository outcome
Only this deployment-result document is added for the blocked attempt. Application source, migration, policies and runner are unchanged. Diff/status and secret-pattern checks precede the documentation commit; the resulting GitHub commit is reported in the handoff. No secrets, .env files, credentials or generated sensitive files are included.

## 9. Required setup to resume
Authorization is already recorded. What is missing is a secure target-specific migration-owner connection available to the Node runner, verified hosted exclusion of app/fuelpulse_meta from the Data API, and intended server/runtime connection provisioning. Store credentials only in the approved private process/deployment environment; never in chat, reports, source or screenshots. A write-enabled SQL MCP alone would not satisfy the requirement to use the tested Node runner.

After that setup, repeat identity/conflict checks immediately before the first write, execute the unchanged migration through the hardened runner, and complete the requested hosted catalog/privilege/checksum verification. Do not treat this blocked report as evidence of deployment.

**FINAL STATUS: DEPLOYMENT BLOCKED. No Supabase writes were made.**

---

## 10. Session 2 status (2026-09-08, 17:41 Asia/Kolkata)

**Connection credentials were provided in this session (in chat). Credential rotation is urgently required — see DEPLOYMENT_RUNBOOK.md.**

### Pre-flight checks completed by Notion AI (via GitHub MCP)

| Check | Result |
|-------|--------|
| JWT `ref` claim decoded | `pbjftnlixuysmeotpsjc` ✓ |
| JWT `role` claim | `service_role` ✓ |
| Migration file Git blob (GitHub MCP) | `24898a751e2979c9147d11ef84c52106e2da0746` ✓ |
| Migration file SHA-256 (local ZIP) | `92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44` ✓ |
| Repository HEAD | `5d407c80` (docs-only commit) ✓ |
| Old project accessed | No ✓ |

### Session 2 stop condition: Notion AI sandbox has zero outbound network connectivity

- `curl https://pbjftnlixuysmeotpsjc.supabase.co/rest/v1/` → HTTP 000 (connection failed)
- GitHub DNS resolution → failed (no internet)
- npm registry → failed (no internet)
- TCP port 5432 to Supabase → unreachable
- `pg` npm module in ZIP's `node_modules` → empty directory (0 files)
- `psql`, `psycopg2` → not installed in sandbox

The Notion AI sandbox is a fully isolated environment with no outbound network access. It cannot connect to Supabase by any means. The migration must be run from the user's local machine or a CI environment with internet access.

### What to do next

1. **Rotate** the DB password and service role key (credentials were exposed in chat)
2. **Clone** the repository locally: `git clone https://github.com/edityyp/fuelpulse-app.git`
3. **Follow** `DEPLOYMENT_RUNBOOK.md` step by step from Phase 1
4. **Run** the hardened migration runner with the new rotated credentials
5. **Report** the output back so the Notion AI can continue with verification and documentation

No Supabase writes were made in this session. The database remains clean.

**FINAL STATUS: DEPLOYMENT BLOCKED (sandbox has no network). Migration ready to run locally per DEPLOYMENT_RUNBOOK.md.**
