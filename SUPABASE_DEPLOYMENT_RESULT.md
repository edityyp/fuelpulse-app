# Supabase Deployment Result

## Target

- Approved project: `pbjftnlixuysmeotpsjc`
- API URL: https://pbjftnlixuysmeotpsjc.supabase.co
- Forbidden retired project: `riywnbifqpsylsdocoyi`

## Migration result

The canonical baseline is installed and tracked in private metadata:

- Migration: `202609080001_initial.sql`
- Tracker: `fuelpulse_meta.migrations`
- Applied: `2026-09-08T12:31:50.07068Z`
- Stored CRLF checksum: `bf10c079e337445fc6a3de7c2501430234320a39a9466d04ed1939b9c5f406a5`
- Repository LF checksum: `92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44`

The checksum difference is newline normalization only and was independently reconciled.

## Verified schema

Fourteen canonical `app` tables:

- `organizations`
- `users`
- `credentials`
- `sessions`
- `login_limits`
- `login_events`
- `pumps`
- `fuels`
- `pump_fuels`
- `daily_counts`
- `transactions`
- `points_ledger`
- `coupons`
- `audit_logs`

All 14 have ENABLE RLS and FORCE RLS. Exactly 26 policies are installed. The private migration metadata is not exposed through the Data API.

## Runtime role

`fuelpulse_runtime` was created for Railway with LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, and NOBYPASSRLS. It is a member of `fuelpulse_gateway` and has no access to `fuelpulse_meta`.

Its password was generated in PostgreSQL, returned only as OpenPGP ciphertext, decrypted locally by an ephemeral helper, and sent to Railway over standard input. Temporary plaintext and private-key material were not committed.

## Final integrity evidence

- Organizations: 1
- Users: 3
- Transactions: 5
- Points-ledger rows: 5
- Fraud transactions: 2
- Redeemed coupons: 1
- Ledger mismatches: 0
- Duplicate idempotency keys: 0

## Advisory status

A Supabase advisor warning remains for mutable `search_path` on `app.org()`, `app.actor()`, and `app.role()`. The functions are schema-qualified in current use; a future reviewed migration should explicitly pin their search paths. This warning is documented and is not being misreported as resolved.
