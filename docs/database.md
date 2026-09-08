# Database and private migration history

Application baseline: supabase/migrations/202609080001_initial.sql, unchanged by tracker hardening (Git blob 24898a751e2979c9147d11ef84c52106e2da0746).

Tables in app: organizations, users, credentials, sessions, login_limits, login_events, pumps, fuels, pump_fuels, daily_counts, transactions, points_ledger, coupons, audit_logs. All 14 retain ENABLE and FORCE RLS; 26 policies and three context helpers retain the original design. Composite tenant/id foreign keys prevent foreign pump/fuel/staff associations. Runtime has no UPDATE/DELETE on transaction, ledger or audit history.

fuelpulse_app and fuelpulse_gateway are NOLOGIN/NOSUPERUSER/NOBYPASSRLS. Runtime LOGIN is a restricted gateway member. Gateway permits narrow cross-tenant authentication operations; app uses transaction-local tenant/actor/role context. Custom app authentication remains separate from Supabase auth.users/sessions.

## Administrative metadata
The Node runner uses fuelpulse_meta.migrations:
- name text PRIMARY KEY: exact migration filename.
- sha256 text NOT NULL: SHA-256 of original bytes, constrained to 64 lowercase hex characters.
- applied_at timestamptz NOT NULL DEFAULT now().

Schema/table belong to the separate migration owner. PUBLIC, anon, authenticated, service_role and authenticator are explicitly denied grants on creation. Runtime roles get none. RLS is enabled with no policies; owner exemption deliberately permits administrative tracking even for non-BYPASSRLS owners. This is not tenant business data, and does not change FORCE RLS on app tables. Superusers/privileged platform administrators are not constrained by this design.

Both private schemas must stay outside the Data API. CLI requires explicit FUELPULSE_PRIVATE_METADATA_CONFIRMED=true and checks observable pgrst.db_schemas. Metadata ownership, structure, ACLs, effective role access and absence of unexpected objects are validated before/after migrations. API-role BYPASSRLS alone cannot supply missing object privileges.

Files are regular non-symlink UTF-8, unique version-prefixed .sql entries; unexpected/empty/oversized entries abort. Stored hashes must match and all recorded files must remain present. History must be an ordered prefix, preventing backfilled older migrations. Original advisory transaction lock and rollback behavior are retained.

A legacy public.fuelpulse_migrations or unknown metadata layout is never silently adopted/repaired/deleted. Supabase CLI has separate supabase_migrations.schema_migrations history; do not mix workflows. The app baseline intentionally fails on pre-existing schema/roles; reconcile rather than reset.

Business logic unchanged: immutable tenant idempotency; atomic daily ordinal for third-and-later fraud; one ledger entry per transaction; conditional coupon redemption permitting one concurrent winner. Points are summed from append-only ledger; spending/negative adjustments remain outside current scope.
