# Database

Additive reconstructed baseline: supabase/migrations/202609080001_initial.sql. Not claimed byte-identical to the missing original.

Tables: organizations (timezone/points policy); users (org/role/code/activation); credentials (scrypt hash, optional AES-GCM copy); sessions (token digest/expiry); login_limits (atomic windows); login_events (hashed account/IP outcomes); pumps; fuels (paise price); pump_fuels (compatibility); daily_counts (atomic fraud ordinal); transactions (immutable authoritative sale/idempotency); points_ledger (append-only one per transaction); coupons (random code/plate/expiry/redemption); audit_logs (append-only operational actions).

All app tables ENABLE and FORCE RLS. fuelpulse_app and fuelpulse_gateway are NOLOGIN/NOSUPERUSER/NOBYPASSRLS. Runtime LOGIN role is a member of gateway. Gateway has narrowly scoped cross-tenant authentication lookup access; app role has tenant policies and role restrictions. Composite tenant/id foreign keys prevent foreign pump/fuel/staff associations. Runtime has no UPDATE/DELETE grants on transactions, ledger or audits.

Indexes: tenant recent history, employee history, plate ledger balance, session expiry, recent audit. Unique constraints: tenant staff code, pump/fuel names, tenant idempotency UUID, transaction ledger entry, coupon code and daily bucket.

Node runner tracks public.fuelpulse_migrations. Supabase CLI tracks supabase_migrations.schema_migrations. Choose ONE workflow per target, never blindly mix tracking. Baseline intentionally fails if schema/roles already exist. Inspect conflicts; never repair with DROP/RESET.

Coupon redemption uses one conditional UPDATE ... WHERE code/plate/tenant match AND redeemed_at IS NULL AND expiry>now() RETURNING. Concurrent requests allow exactly one winner. Status derives from redeemed_at/expiry. Points balance is SUM ledger points; no spending or negative adjustments currently supported.
