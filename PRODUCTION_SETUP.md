# Production Setup

## Approved infrastructure

- GitHub: `edityyp/fuelpulse-app`, branch `main`
- Railway project: `beneficial-hope`
- Railway environment: `production`
- Railway service: `fuelpulse-app`
- Public URL: https://fuelpulse-app-production.up.railway.app
- Supabase project: `pbjftnlixuysmeotpsjc`

The retired Supabase project `riywnbifqpsylsdocoyi` is forbidden and must never be used.

## Railway runtime

Required service variables are configured:

- `DATABASE_URL`
- `CREDENTIAL_KEY`
- `APP_ORIGIN`
- `NODE_ENV`
- `PORT`

Do not print, export, copy into tickets, or commit secret values. Railway's platform health check is configured as `/api/health` with a 10-second timeout. Restart policy is `ON_FAILURE` with five retries.

## Database runtime identity

The application connects through the Supabase session pooler as `fuelpulse_runtime`. Verified role properties:

- LOGIN enabled;
- NOSUPERUSER;
- NOCREATEDB;
- NOCREATEROLE;
- NOINHERIT;
- NOBYPASSRLS;
- member of `fuelpulse_gateway`;
- no access to `fuelpulse_meta` migration metadata.

Application requests switch into the gateway/app roles and set tenant context inside transactions. All 14 application tables have ENABLE RLS and FORCE RLS; 26 policies are installed.

## TLS

The runtime uses certificate-verified TLS. `certs/supabase-root-2021-ca.crt` is copied into the production image and loaded through `NODE_EXTRA_CA_CERTS`.

Verified root:

- Subject: `Supabase Root 2021 CA`
- SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Expiry: 2031-04-26

Replace the certificate before expiry or if Supabase announces a CA rotation.

## Deploy procedure

1. Merge reviewed changes to `main`.
2. Confirm typecheck, lint, tests, and production build.
3. Let Railway build with the repository Dockerfile (`npm ci`).
4. Confirm Railway reports `SUCCESS` on the intended commit.
5. Confirm `/api/health`, `/`, `/manifest.webmanifest`, and `/sw.js` return expected responses.
6. Run a role-aware smoke test without printing credentials.

Never run the migration command against an unapproved project. Hosted migration verification must identify `pbjftnlixuysmeotpsjc` before applying anything.
