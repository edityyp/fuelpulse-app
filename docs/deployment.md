# Deployment — repository candidate, not deployed

Target: Supabase `pbjftnlixuysmeotpsjc`, database hostname `db.pbjftnlixuysmeotpsjc.supabase.co`. This supersedes the old riywnbifqpsylsdocoyi target. Prior read-only audit found platform-only/application-empty state; SQL server address matched the target hostname DNS. MCP project display name remains unavailable. No Supabase writes occurred.

See ../SUPABASE_DEPLOYMENT_PLAN.md for the audit, implemented tracker fix, test evidence and approval gates.

## Safe order
1. Reconfirm dashboard ref/name, endpoint, current schemas/roles/history and protected backup. Stop on any unexpected state; never reset/drop/truncate to make a baseline fit.
2. Keep `app` AND `fuelpulse_meta` OUT of Supabase Data API exposed schemas. supabase/config.toml exposes only public for local CLI use; it does not establish hosted dashboard settings.
3. Use a separate migration administrator (normally approved postgres). It owns fuelpulse_meta and must have CREATE/schema and baseline role-creation permissions. Do not use API roles, a fuelpulse_ runtime role, or the read-only inspection connection.
4. After exposure verification only, set FUELPULSE_PRIVATE_METADATA_CONFIRMED=true in the migration job's private environment. False/absent blocks the runner. Observable PostgREST exposure also blocks it. This is not a substitute for dashboard verification.
5. Rehearse on authorized staging, check TLS certificates, direct/session-pooler compatibility and pool capacity. Runtime pool is 20 per process; observed Supabase maximum is 60 connections. Account for platform services/other workers.
6. Obtain explicit Supabase-write approval identifying project and reviewed commit. Only then run npm run migrate using the reviewed runner and separate MIGRATION_DATABASE_URL. Choose Node private history or an independently reviewed CLI workflow, never both.
7. Provision runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS with fuelpulse_gateway membership only. No metadata grants or owner/pg_read_all_data membership. Set passwords via secure console/password prompt and secrets manager, not committed SQL/.env files.
8. Verify private history and all app FORCE-RLS policies, restricted runtime and API denial. Configure APP_ORIGIN=https://your-domain, NODE_ENV=production, PORT, DATABASE_URL and optional CREDENTIAL_KEY as host secrets. Never expose these with VITE_.
9. Deploy Node 24 backend and static frontend together using npm run build then npm start (or reviewed Docker deployment). Frontend-only hosting is insufficient. GET /api/health is read-only; login/bootstrap/sales are not.
10. Owner bootstrap and smoke tests require approved write scope. Remove migration/bootstrap credentials from runtime afterward. Complete manual release checklist before live data.

## Rollback and CI
Failed runner transactions roll back schema/data/history together. For ambiguous commit errors, inspect before retry. After commit, use compatible app rollback or reviewed forward fixes; never delete metadata/business history automatically. Restore backups into a separate environment first.

A previous attempt to install a GitHub workflow received 403. No new workflow or hosted CI run is claimed here. Local tests are the evidence. Migration SQL must be trusted, reviewed and transaction-compatible; no BEGIN/COMMIT/ROLLBACK in files. Legacy public history is a hard stop needing separately approved reconciliation.
