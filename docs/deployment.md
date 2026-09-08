# Deployment — not performed

Target supplied by user: Supabase project riywnbifqpsylsdocoyi, organization ixzbspygpwezetndczvm. No Supabase connection/MCP was available. Schema, migration history and data are NOT inspected. No remote schema/data mutation or deployment was performed.

## Safe path
1. Connect project-scoped read-only access. Inventory existing tables, roles, functions, policies, migration tracker and data. Compare to local baseline; never assume an empty database. Export a protected backup.
2. Rehearse the reconstructed additive migration on a fresh staging instance and rerun role/concurrency tests. If any app schema/role/history exists, STOP and reconcile differences; do not reset/drop/truncate.
3. Choose Supabase CLI migration history OR included Node runner per target. Do not apply the same schema twice through different trackers. Explicit approval is required before remote production changes.
4. Provision a private least-privileged LOGIN role with membership in fuelpulse_gateway. No SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS. Set its password via a secure DB console or psql password prompt. Store runtime URL in host secrets, never frontend. Use separate migration administrator credentials only for approved operations.
5. Keep `app` out of Supabase exposed API schemas. No anon/authenticated browser grants are needed. Application uses same-origin Node backend exclusively.
6. Set APP_ORIGIN=https://your-domain, NODE_ENV=production, PORT, DATABASE_URL and optional CREDENTIAL_KEY through hosting secrets. Verify TLS/certificate chain for database connections. Do not disable verification.
7. Deploy Node 24 with `npm install && npm run build && npm start`, or build the supplied Dockerfile. Deploy backend and static dist together; frontend-only hosting is insufficient. Database health endpoint: GET /api/health.
8. Bootstrap owner once with BOOTSTRAP_* secrets and a separate migration connection. Remove bootstrap/admin credentials afterward. Set fuel prices then compatible pumps in the owner interface.
9. Run manual role/device/security/backup QA before accepting live data.

## Rollback
Keep prior application image/source commit and schema migration record. Roll back application release only when compatible with additive schema. Never use destructive schema rollback as default. For bad business data, preserve immutable records and use a reviewed corrective workflow; do not hand-edit financial/reward history. Restore backups to a separate environment first and obtain explicit approval for production replacement.

## CI
Attempt to add .github/workflows/verify.yml was denied with 403 by GitHub integration permissions. No workflow was installed and no CI pass is claimed. Local tests are the current evidence. A repository administrator can grant workflow-write permission later; build checks can then be automated against an ephemeral PostgreSQL service, not production.

Official migration guidance consulted: https://supabase.com/docs/guides/deployment/database-migrations . Diagnostic history repair must only follow verified schema/history comparison, never guesswork.
