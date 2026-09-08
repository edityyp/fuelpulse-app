# FuelPulse -- Supabase Deployment Result

## Status: MIGRATION APPLIED -- VERIFICATION IN PROGRESS

**Target project:** `pbjftnlixuysmeotpsjc`  
**Old project (never touched):** `riywnbifqpsylsdocoyi`  
**Migration:** `supabase/migrations/202609080001_initial.sql`  
**SHA-256:** `92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44`

---

## Session 3 -- 2026-09-08 18:06 IST (Current)

### What completed this session

| Item | Status |
|------|--------|
| Migration applied from Windows machine | CONFIRMED |
| 14 app tables visible in Supabase | CONFIRMED by user |
| `scripts/verify-hosted.ts` pushed | commit `fe3af213` |
| `.github/workflows/ci.yml` content ready | Needs manual commit (see below) |
| Notion status page updated | Done |

### Why .github/workflows/ could not be pushed automatically

The GitHub integration token has `contents: write` scope but not `workflows: write`.
GitHub requires the `workflows` OAuth scope to write to `.github/workflows/`.
**Action required:** commit the CI workflow manually (see instructions below).

---

## URGENT -- Rotate Credentials

The DB password and service role JWT were pasted in chat. Both must be treated as
compromised. Rotate before proceeding:

1. **DB password:** Supabase Dashboard -> Project Settings -> Database -> Reset database password
2. **Service role key:** Supabase Dashboard -> Settings -> API -> Regenerate `service_role` key

---

## Checklist -- Actions Required Before CI Can Run

- [ ] Rotate DB password (URGENT)
- [ ] Rotate service role key (URGENT)
- [ ] Commit `.github/workflows/ci.yml` (see below)
- [ ] Add 4 GitHub repository secrets
- [ ] Add `app` to Supabase Exposed Schemas
- [ ] Trigger workflow and verify all 4 jobs green

---

## Step 1 -- Commit the CI workflow manually

Create `.github/workflows/ci.yml` in the repository. The full content is documented
in the Notion status page (FuelPulse -- Deployment Status & Runbook) and was prepared
by Notion AI in this session. You can commit it via:

```bash
git clone https://github.com/edityyp/fuelpulse-app.git
cd fuelpulse-app
mkdir -p .github/workflows
# Paste the ci.yml content (from Notion status page) into .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m 'ci: add full 4-job GitHub Actions CI pipeline'
git push origin main
```

---

## Step 2 -- Configure GitHub Secrets

GitHub -> edityyp/fuelpulse-app -> Settings -> Secrets and variables -> Actions -> New repository secret:

| Secret | Value |
|--------|-------|
| `MIGRATION_DATABASE_URL` | `postgresql://postgres:NEW_ROTATED_PASSWORD@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres` |
| `SUPABASE_URL` | `https://pbjftnlixuysmeotpsjc.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Dashboard -> Settings -> API -> `anon` public key |
| `QA_PASSWORD` | Any strong password (e.g. `openssl rand -base64 18`) |

---

## Step 3 -- Expose app schema in Supabase

1. Supabase Dashboard -> Project settings -> API
2. Under Exposed schemas, add `app`
3. Save

---

## Step 4 -- Trigger CI and verify all 4 jobs green

GitHub -> Actions -> FuelPulse CI -> Run workflow

Jobs:
1. **hosted-verify** -- runs `scripts/verify-hosted.ts` against live Supabase
2. **unit-tests** -- 62 tests (security, password, assist, migration-runner) on local PG
3. **build** -- TypeScript + ESLint + Vite + server compile
4. **browser-e2e** -- Playwright PWA/offline/OCR end-to-end

---

## Step 5 -- Configure Application Runtime

```env
DATABASE_URL=postgresql://postgres:NEW_PASSWORD@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres
CREDENTIAL_KEY=<openssl rand -base64 32>
APP_ORIGIN=https://YOUR_DOMAIN
NODE_ENV=production
PORT=3000
```

---

## Step 6 -- Bootstrap First Organisation

```bash
MIGRATION_DATABASE_URL='postgresql://postgres:NEW_PASSWORD@db.pbjftnlixuysmeotpsjc.supabase.co:5432/postgres' \
BOOTSTRAP_STATION=your-station-slug \
BOOTSTRAP_NAME="Your Station Name" \
BOOTSTRAP_CODE=OWNER \
BOOTSTRAP_PASSWORD='<strong-password>' \
npx tsx scripts/bootstrap.ts
```

---

## Hosted Verification Coverage (scripts/verify-hosted.ts)

When the CI `hosted-verify` job runs, it checks:

- Phase 1: Target identity (host is pbjftnlixuysmeotpsjc, not old project, fuelpulse_meta exists)
- Phase 2: All 14 app tables present, FORCE RLS on all 14, exactly 26 policies, key indexes
- Phase 3: fuelpulse_app and fuelpulse_gateway roles (NOBYPASSRLS), full grant matrix
- Phase 4: fuelpulse_meta private -- 1 migration row, SHA-256 matches, no public/API-role access
- Phase 5: PostgREST -- fuelpulse_meta not in db_schemas, HTTP exposure checks with anon key
- Phase 6: Tenant isolation -- transactional write test with full ROLLBACK, no production residue

---

## Sessions 1 and 2 -- Historical

### Session 1
- Sandbox has zero outbound network -- migration runner blocked
- All pre-flight checks passed via GitHub MCP
- DEPLOYMENT_RUNBOOK.md pushed to repository

### Session 2
- Credentials provided in chat (rotation required)
- JWT decoded: ref=pbjftnlixuysmeotpsjc, role=service_role
- Migration SHA-256 verified from both ZIP and GitHub
- Sandbox confirmed: zero outbound network, pg module empty
- DEPLOYMENT_RUNBOOK.md committed (86a93dd2)

---

*Updated: 2026-09-08 18:06 IST. Migration confirmed applied. verify-hosted.ts pushed.
Awaiting: credential rotation, ci.yml manual commit, GitHub secrets, first workflow run.*
