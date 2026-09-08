# FuelPulse — Supabase deployment candidate

Status: repository hardening implemented and locally tested on 2026-09-08. **Supabase changes and deployment are NOT approved or performed.**
Base: main commit `15f6e0e0bf90c9e5cd9d4c21d555200ef49e7132` in https://github.com/edityyp/fuelpulse-app . This document supersedes the proposal-only runner design, not the database safety boundary.

## 1. Project identity
Intended ref: `pbjftnlixuysmeotpsjc`. Prior read-only SQL returned database address `2406:da12:5ca:b700:f375:a98c:b36d:e132`, matching live DNS for `db.pbjftnlixuysmeotpsjc.supabase.co`. The old project's hostname resolved elsewhere. MCP does not directly expose project ref/name/API URL; display name remains unverified. The conventional API URL is derived, not observed: `https://pbjftnlixuysmeotpsjc.supabase.co`. Confirm dashboard identity and actual migration endpoint immediately before any future approved deployment.

## 2. Database cleanliness
Prior SELECT-only audit: platform schemas only; no app/fuelpulse_meta schema, FuelPulse roles or migration tracker. Public contains no tables. 35 managed tables: 32 empty; only auth.schema_migrations (77), realtime.schema_migrations (82), storage.migrations (68) have rows. Supabase migration list empty. This is application-empty, not literally empty PostgreSQL. No FuelPulse baseline currently applied. These are audit-time findings, not a guarantee against subsequent drift. No Supabase connection was used for repository-side write tests.

## 3. Original migration-history risk
The old scripts/migrate.ts created:
```sql
create table if not exists public.fuelpulse_migrations(name text primary key,applied_at timestamptz default now())
```
Observed postgres-created public-table defaults granted anon/authenticated/service_role SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN; schema USAGE was also available. The tracker had no RLS. If public were API-exposed, clients could read filenames/timestamps and tamper with applied-history markers. API exposure settings were not directly verified. The old tracker was absent, so this was a deployment defect, not an observed breach.

## 4. Implemented fix
Private `fuelpulse_meta.migrations(name, sha256, applied_at)` is now bootstrapped by the runner in the same transaction as migrations. Schema/table access is revoked from PUBLIC and existing anon/authenticated/service_role/authenticator roles. Metadata has RLS enabled and no policies; its verified owner uses the normal owner exemption. Platform superusers remain administrators, not a claimed isolation boundary. Runtime/API roles get no access, including service_role despite BYPASSRLS.

Validation rejects unexpected ownership, columns/defaults, constraints/indexes, relations/types/routines, policies/triggers/rules/inheritance, schema/table/column ACLs and effective API/runtime access, including inherited read privileges or ability to assume the migration owner. Existing unsafe metadata is rejected, not automatically repaired. Legacy public.fuelpulse_migrations always aborts without adoption/deletion/relocation.

Files must be regular non-symlink UTF-8 SQL files named with a unique 12- or 14-digit version plus underscore/name.sql. Empty/oversized files, other entries and duplicate versions fail before database writes. Exact file bytes are SHA-256 hashed. Every prior file must exist unchanged, and applied history must be an ordered prefix. All checksums are checked before new migration SQL runs. The original fuelpulse.migrate advisory transaction lock is preserved. A failure rolls back new metadata, DDL, data and history together; success is logged only after commit.

The CLI requires `FUELPULSE_PRIVATE_METADATA_CONFIRMED=true`, set only after verifying that fuelpulse_meta is NOT exposed in the Data API (or no Data API exists for local testing). Observable pgrst.db_schemas settings are checked before and after SQL execution. This attestation does not discover hidden hosted configuration; explicit dashboard verification remains mandatory. Keep both app and fuelpulse_meta unexposed.

## 5. Files and ownership requirements
Changed/added: scripts/migrate.ts; scripts/migration-runner.ts; tests/migration-runner.test.ts; .env.example; package.json; this plan; README.md; IMPLEMENTATION_STATUS.md; docs/deployment.md; docs/database.md; docs/testing.md.

Migration owner: separate administrative account, normally approved postgres on Supabase, with database CREATE and baseline role-creation permissions. It must own both metadata objects on repeat runs. API role names and the fuelpulse_ runtime namespace are rejected as migration owners. A non-BYPASSRLS administrative owner can maintain metadata (tested). Runtime must never use owner credentials or inherit owner/pg_read_all_data privileges. Runtime LOGIN stays NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS with gateway membership only.

The application baseline is byte-for-byte unchanged: Git blob `24898a751e2979c9147d11ef84c52106e2da0746`. No server, shared contract or frontend business code changed. All 14 app tables retain ENABLE/FORCE RLS and 26 policies. No new application policy/grant, transaction, ledger, fraud, coupon or authentication design is introduced.

## 6. Future deployment order
1. Review the candidate and read-only target identity/history/exposure settings again; stop on drift.
2. Confirm backup/restore readiness and rehearse hosted-specific role/TLS/pooler behavior in authorized staging. Local PostgreSQL success is not hosted production verification.
3. Verify direct/session-pooler endpoint, TLS CA checking, runtime/migration credential separation and connection budget (observed hosted limit 60; runtime pool 20 per instance). Never disable TLS verification.
4. Obtain explicit approval for Supabase writes naming project and reviewed commit. No earlier audit or repository approval authorizes this step.
5. After approval only, configure private exposure attestation and run the hardened Node migration workflow once. Do not mix with Supabase CLI history or mark files applied manually.
6. Provision restricted runtime credentials under approved scope, verify metadata denial again, then separately approved owner bootstrap and app rollout. Remove admin/bootstrap secrets from runtime.

## 7. Rollback
Before commit, rollback preserves prior history and removes changes from that transaction. After an ambiguous network/commit error, inspect state/checksums before retrying. After a successful commit, roll the application back only if schema-compatible; prefer reviewed forward correction. Never automatically DROP/reset/delete history or business data. Any restoration or history reconciliation needs separate approval and a rehearsal into an isolated environment first.

## 8. Verification and remaining gates
Fresh local evidence: Node 24.14.1/PostgreSQL 17.10; **62 tests passed, 0 failed, 0 skipped** (31 existing + 31 new migration cases). TypeScript, ESLint, frontend production build, compiled backend and PWA/OCR asset build passed. Unchanged full baseline applied once and second invocation skipped exactly one tracked file. Local catalogs confirmed 14 FORCE-RLS tables, 26 app policies and no metadata access for restricted runtime.

New tests cover initialization/ACLs/RLS/checksums, actual role-denied reads/writes/truncation, idempotency, missing/changed/unexpected files, legacy tracker preservation, three simultaneous runners, initial/later rollback, metadata tampering, reordered history, exposure gates, privileged API membership, global default grants, quoted non-BYPASSRLS owner and elevated API role rejection. Existing tenant/idempotency/fraud/coupon/authentication tests all passed again.

After approved deployment, verify tracker ownership/ACLs/RLS/history/hash; no public tracker; no private API exposure; all app objects/FORCE RLS/policies; restricted runtime membership/privileges. Login/seed/sale/coupon tests are writes and need separate staging/smoke-test authorization. Never describe them as read-only checks.

Remaining gates: explicit Supabase authorization; dashboard identity/exposed-schema verification; hosted role/TLS/pooler rehearsal; deployment credentials/backup/provisioning; broader manual/device/load/security release checklist. Existing CI workflow permission limitation is unchanged. Browser/device testing was not rerun for this tracker-only change. Repository is a locally verified deployment candidate, not a deployed or independently certified product.

**NO SUPABASE DATABASE, AUTH, STORAGE, ROLE, RLS, SETTINGS OR DATA CHANGES WERE MADE.** Only repository files and disposable loopback PostgreSQL were changed. No real .env credentials or secrets are committed. Migration SQL is trusted reviewed administrative code, not a sandbox for untrusted SQL: do not put transaction-control commands in migration files.
