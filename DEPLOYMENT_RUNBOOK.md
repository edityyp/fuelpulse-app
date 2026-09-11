# FuelPulse — Local Deployment Runbook

**Prepared:** 2026-09-08  
**Target Supabase project:** `pbjftnlixuysmeotpsjc`  
**Repository:** `https://github.com/edityyp/fuelpulse-app` (branch `main`)  
**Status:** All pre-flight checks passed. Migration runner ready. Must be executed from a machine with network access to Supabase.

---

## ⚠️ URGENT — Rotate credentials immediately

The database password and service role key were pasted in a chat window. **Rotate both before proceeding:**

1. **Rotate DB password:** Supabase Dashboard → Project Settings → Database → Reset database password  
2. **Rotate service role key:** Supabase Dashboard → Project Settings → API → Regenerate service_role key  
3. Update your local `.env` / secrets after rotating.

The previous credentials must be considered compromised and must not be used.

---

## Pre-flight verification (confirmed by Notion AI, 2026-09-08)

| Check | Result |
|-------|--------|
| JWT `ref` claim | `pbjftnlixuysmeotpsjc` ✓ |
| JWT `role` claim | `service_role` ✓ |
| Migration file Git SHA | `24898a751e2979c9147d11ef84c52106e2da0746` ✓ |
| Migration file SHA-256 | `92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44` ✓ |
| Repository HEAD | `5d407c80` (docs-only, no code changes) ✓ |
| Old project `riywnbifqpsylsdocoyi` | NOT accessed ✓ |
| Local test suite | 62/62 passed ✓ |
| Database clean (session 1) | All 14 app tables absent ✓ |

---

## Phase 1 — Clone and verify locally

```bash
git clone https://github.com/edityyp/fuelpulse-app.git
cd fuelpulse-app
git log --oneline -5
# Expected HEAD: 5d407c80 or newer docs-only commit

# Verify migration file checksum
sha256sum supabase/migrations/202609080001_initial.sql
# Expected: 92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44
```

## Phase 2 — Install dependencies

```bash
npm ci
```

## Phase 3+6 — Verify target identity and clean database

Create a file `verify.mts` and run it:

```typescript
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await c.connect();
console.log('Connected OK');

const r = await c.query(`SELECT current_database() AS db, version(), current_setting('transaction_read_only') AS ro`);
console.log(r.rows[0]);
if (r.rows[0].ro === 'on') throw new Error('FATAL: read-only connection');

const schemas = (await c.query(`SELECT schema_name FROM information_schema.schemata`)).rows.map(r => r.schema_name);
console.log('Schemas:', schemas.join(', '));
if (schemas.includes('app') || schemas.includes('fuelpulse_meta')) {
  throw new Error('FATAL: FuelPulse schemas already exist — database not clean');
}

const legacy = (await c.query(`SELECT to_regclass('public.fuelpulse_migrations') AS t`)).rows[0];
if (legacy.t) throw new Error('FATAL: Legacy tracker found');

console.log('DATABASE_CLEAN: OK — safe to proceed');
await c.end();
```

```bash
MIGRATION_DATABASE_URL='postgresql://postgres:YOUR_NEW_PASSWORD@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres' \
npx tsx verify.mts
```

**Verify output shows:** `DATABASE_CLEAN: OK`

## Phase 7 — Run hardened migration runner

```bash
MIGRATION_DATABASE_URL='postgresql://postgres:YOUR_NEW_PASSWORD@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres' \
FUELPULSE_PRIVATE_METADATA_CONFIRMED=true \
npx tsx scripts/migrate.ts
```

> **Note on URL encoding:** If your password contains `[`, `@`, `]`, they must be URL-encoded in the connection string: `[` → `%5B`, `@` → `%40`, `]` → `%5D`. After rotating, use the new password — ideally one without special characters.

**Expected output (success):**
```
[migrate] lock acquired
[migrate] 202609080001_initial.sql: checksum OK
[migrate] applied 202609080001_initial.sql
[migrate] released lock
[migrate] done
```

The runner is atomic (advisory lock + transaction). It is safe to re-run if it fails.

## Phase 8 — Post-migration schema verification

```bash
MIGRATION_DATABASE_URL='postgresql://postgres:YOUR_NEW_PASSWORD@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres' \
npx tsx -e "
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await c.connect();
const tables = (await c.query(\`SELECT table_name FROM information_schema.tables WHERE table_schema='app' ORDER BY table_name\`)).rows.map(r=>r.table_name);
console.log('Tables:', tables.length, '(expected 14):', tables.join(', '));
const policies = (await c.query(\`SELECT count(*) FROM pg_policies WHERE schemaname='app'\`)).rows[0].count;
console.log('Policies:', policies, '(expected 26)');
const rls = (await c.query(\`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='app' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relkind='r'\`)).rows[0].count;
console.log('FORCE RLS:', rls, '(expected 14)');
const meta = (await c.query(\`SELECT count(*) FROM information_schema.tables WHERE table_schema='fuelpulse_meta' AND table_name='migrations'\`)).rows[0].count;
console.log('fuelpulse_meta.migrations:', meta, '(expected 1)');
await c.end();
"
```

**Pass criteria:** 14 tables, 26 policies, 14 FORCE RLS, 1 private tracker.

## Phase 9 — Expose `app` schema via PostgREST (not `fuelpulse_meta`)

In Supabase Dashboard → Settings → API → Exposed schemas, add `app`.  
**Do NOT add** `fuelpulse_meta` — it must stay private.

OR run in Supabase SQL Editor:
```sql
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,app';
NOTIFY pgrst, 'reload config';
```

Verify `fuelpulse_meta` is not exposed:
```bash
curl -s 'https://pbjftnlixuysmeotpsjc.supabase.co/rest/v1/' \
  -H 'apikey: YOUR_ANON_KEY' | jq 'keys'
# Must NOT contain fuelpulse_meta entries
```

## Phase 10 — Set application role passwords and runtime config

In Supabase SQL Editor (postgres user):
```sql
ALTER ROLE fuelpulse_app PASSWORD 'strong-unique-password-1';
ALTER ROLE fuelpulse_gateway PASSWORD 'strong-unique-password-2';
```

Create `.env` (never commit):
```env
DATABASE_URL=postgresql://fuelpulse_app:strong-unique-password-1@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres
GATEWAY_DATABASE_URL=postgresql://fuelpulse_gateway:strong-unique-password-2@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres
SUPABASE_URL=https://pbjftnlixuysmeotpsjc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-rotated-service-role-key>
JWT_SECRET=<from-supabase-dashboard-settings-api>
```

## Phase 11 — Run application test suite

```bash
npm test
# Expected: 62 tests pass
```

## Phase 12 — Build verification

```bash
npm run build         # Frontend Vite production build
npx tsc --noEmit      # TypeScript compile check
npx eslint . --ext .ts,.tsx
```

## Phase 13 — Security checks

```bash
# Unauthenticated RLS blocks all rows
curl -s 'https://pbjftnlixuysmeotpsjc.supabase.co/rest/v1/organizations' \
  -H 'apikey: YOUR_ANON_KEY' | jq .
# Expected: [] (empty — RLS blocks without valid JWT)

# fuelpulse_meta not reachable via REST
curl -s 'https://pbjftnlixuysmeotpsjc.supabase.co/rest/v1/migrations' \
  -H 'apikey: YOUR_ANON_KEY' | jq .
# Expected: error — relation not found or not exposed
```

## Phase 14 — Git commit and push

```bash
# Update SUPABASE_DEPLOYMENT_RESULT.md to record successful deployment
git add SUPABASE_DEPLOYMENT_RESULT.md IMPLEMENTATION_STATUS.md
git commit -m "deploy: successfully applied 202609080001_initial.sql to pbjftnlixuysmeotpsjc"
git push origin main
```

---

## Why this must be run locally

Notion AI runs in a sandboxed environment with **zero outbound network connectivity**. All of the following failed from the sandbox:
- DNS resolution (GitHub, Supabase, npm registry — all unreachable)
- TCP connection to Supabase PostgreSQL port 5432
- HTTP to Supabase REST API

Additionally, the `pg` npm module was absent from the ZIP's `node_modules`. All verifiable pre-flight checks were completed via the connected GitHub MCP integration (JWT claims, migration file content and checksums, repository state). The migration itself requires direct PostgreSQL writes and must run locally.
