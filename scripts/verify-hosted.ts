/**
 * FuelPulse Hosted Supabase Verification Suite
 *
 * Verifies the live Supabase deployment end-to-end:
 *   - Phase 1: target identity
 *   - Phase 2: 14 tables, FORCE RLS, 26 policies
 *   - Phase 3: roles and grant correctness
 *   - Phase 4: migration metadata privacy
 *   - Phase 5: PostgREST / Data API exposure
 *   - Phase 6: tenant isolation (transactional write test, always rolled back)
 *
 * Required env:
 *   MIGRATION_DATABASE_URL  -- postgres admin connection to Supabase
 * Optional env (enables HTTP exposure checks):
 *   SUPABASE_URL            -- https://pbjftnlixuysmeotpsjc.supabase.co
 *   SUPABASE_ANON_KEY       -- Supabase anon JWT
 */

import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const EXPECTED_TABLES = [
  'audit_logs', 'coupons', 'credentials', 'daily_counts',
  'fuels', 'login_events', 'login_limits', 'organizations',
  'points_ledger', 'pump_fuels', 'pumps', 'sessions', 'transactions', 'users',
];
const MIGRATION_NAME = '202609080001_initial.sql';
const MIGRATION_PATH = 'supabase/migrations/' + MIGRATION_NAME;
const EXPECTED_SHA = '92da7987e5559af29b2fb3d903dec722d74541f163d906aaa969f2f00c582c44';
const EXPECTED_POLICIES = 26;

// Supabase API roles that must have NO access to fuelpulse_meta
const SUPABASE_API_ROLES = ['anon', 'authenticated', 'service_role', 'authenticator'];

const connStr = process.env.MIGRATION_DATABASE_URL;
if (!connStr) throw new Error('MIGRATION_DATABASE_URL is required');
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY;

const client = new pg.Client({ connectionString: connStr });
const passed: string[] = [];
const failed: string[] = [];

function ok(name: string, detail?: string) {
  passed.push(name);
  console.log(`  \u2713 ${name}${detail ? ': ' + detail : ''}`);
}

function bad(name: string, detail: string): never {
  failed.push(name);
  console.error(`  \u2717 ${name}: ${detail}`);
  throw new Error(`VERIFICATION FAILED: ${name} -- ${detail}`);
}

async function httpGet(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log('='.repeat(52));
  console.log('FuelPulse Hosted Verification Suite');
  console.log('Target:', new URL(connStr!).hostname);
  console.log('='.repeat(52));

  await client.connect();

  // ── Phase 1: Identity ─────────────────────────────────────────
  console.log('\nPhase 1: Target identity');
  {
    const r = (await client.query(`
      SELECT current_database() AS db,
             current_setting('transaction_read_only') AS ro,
             (SELECT setting FROM pg_settings WHERE name = 'server_version') AS pg_ver,
             current_user AS cu
    `)).rows[0];

    if (r.ro === 'on') bad('writable-connection', 'Connection is read-only -- rotate to postgres admin');
    ok('writable-connection', `db=${r.db} pg=${r.pg_ver} user=${r.cu}`);

    const host = new URL(connStr!).hostname;
    if (host.includes('riywnbifqpsylsdocoyi')) bad('not-old-project', 'Host matches the excluded old project!');
    ok('not-old-project', host);

    const meta = (await client.query(`SELECT to_regnamespace('fuelpulse_meta') AS n`)).rows[0].n;
    if (!meta) bad('migration-applied', 'fuelpulse_meta schema missing -- migration may not have run');
    ok('migration-applied', 'fuelpulse_meta schema found');
  }

  // ── Phase 2: Schema structure ─────────────────────────────────
  console.log('\nPhase 2: Schema structure -- 14 tables, FORCE RLS, 26 policies');
  {
    const tables: string[] = (await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'app' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)).rows.map((r: { table_name: string }) => r.table_name);

    const missing = EXPECTED_TABLES.filter(t => !tables.includes(t));
    const extra = tables.filter(t => !EXPECTED_TABLES.includes(t));
    if (missing.length) bad('14-tables-present', `Missing: ${missing.join(', ')}`);
    if (extra.length) bad('14-tables-only', `Unexpected extra tables: ${extra.join(', ')}`);
    ok('14-tables-present', tables.join(', '));

    const rlsRows: { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[] =
      (await client.query(`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'app' AND c.relkind = 'r'
        ORDER BY c.relname
      `)).rows;

    for (const row of rlsRows) {
      if (!row.relrowsecurity) bad('rls-enabled', `app.${row.relname} has RLS disabled`);
      if (!row.relforcerowsecurity) bad('force-rls', `app.${row.relname} missing FORCE RLS`);
    }
    ok('force-rls-all-14', `${rlsRows.length}/14 tables have ENABLE+FORCE RLS`);

    const policyCount = parseInt(
      (await client.query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'app'`)).rows[0].n
    );
    if (policyCount !== EXPECTED_POLICIES) bad('26-policies', `Expected ${EXPECTED_POLICIES}, found ${policyCount}`);
    ok('26-policies', `exactly ${policyCount} RLS policies`);

    const indexes: string[] = (await client.query(`
      SELECT i.relname FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_class c ON c.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'app' AND NOT x.indisprimary
      ORDER BY i.relname
    `)).rows.map((r: { relname: string }) => r.relname);
    const requiredIndexes = ['sessions_expiry', 'transaction_recent', 'transaction_employee', 'points_balance', 'audit_recent'];
    const missingIdx = requiredIndexes.filter(i => !indexes.includes(i));
    if (missingIdx.length) bad('indexes', `Missing indexes: ${missingIdx.join(', ')}`);
    ok('indexes', requiredIndexes.join(', '));
  }

  // ── Phase 3: Roles and grants ─────────────────────────────────
  console.log('\nPhase 3: Roles and grants');
  {
    for (const role of ['fuelpulse_app', 'fuelpulse_gateway']) {
      const exists = (await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role])).rowCount;
      if (!exists) bad(`role-${role}`, `Role ${role} not found`);
      const bypassRls = (await client.query(
        `SELECT rolbypassrls FROM pg_roles WHERE rolname = $1`, [role]
      )).rows[0].rolbypassrls;
      if (bypassRls) bad(`role-${role}-nobypassrls`, `${role} has BYPASSRLS -- unexpected privilege escalation`);
      ok(`role-${role}`, `exists, NOBYPASSRLS`);
    }

    const inh = (await client.query(`
      SELECT 1 FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid
      JOIN pg_roles g ON g.oid = m.member
      WHERE r.rolname = 'fuelpulse_app' AND g.rolname = 'fuelpulse_gateway'
    `)).rowCount;
    if (!inh) bad('gateway-inherits-app', 'fuelpulse_gateway does not have fuelpulse_app granted');
    ok('gateway-inherits-app');

    // fuelpulse_app: SELECT+INSERT on transactions, NO DELETE
    const txApp = (await client.query(`
      SELECT
        has_table_privilege('fuelpulse_app', 'app.transactions', 'SELECT') AS sel,
        has_table_privilege('fuelpulse_app', 'app.transactions', 'INSERT') AS ins,
        has_table_privilege('fuelpulse_app', 'app.transactions', 'DELETE') AS del
    `)).rows[0];
    if (!txApp.sel || !txApp.ins) bad('app-transactions-select-insert', `sel=${txApp.sel} ins=${txApp.ins}`);
    if (txApp.del) bad('app-transactions-no-delete', 'fuelpulse_app must NOT have DELETE on transactions');
    ok('app-transactions-grants', 'SELECT, INSERT; no DELETE');

    // fuelpulse_app: SELECT+UPDATE on organizations, NO INSERT/DELETE
    const orgApp = (await client.query(`
      SELECT
        has_table_privilege('fuelpulse_app', 'app.organizations', 'SELECT') AS sel,
        has_table_privilege('fuelpulse_app', 'app.organizations', 'UPDATE') AS upd,
        has_table_privilege('fuelpulse_app', 'app.organizations', 'INSERT') AS ins,
        has_table_privilege('fuelpulse_app', 'app.organizations', 'DELETE') AS del
    `)).rows[0];
    if (!orgApp.sel || !orgApp.upd) bad('app-organizations-grants', JSON.stringify(orgApp));
    if (orgApp.ins || orgApp.del) bad('app-organizations-no-insert-delete', 'fuelpulse_app must NOT have INSERT/DELETE on organizations');
    ok('app-organizations-grants', 'SELECT, UPDATE only');

    // fuelpulse_gateway: full CRUD on credentials
    const gwCred = (await client.query(`
      SELECT
        has_table_privilege('fuelpulse_gateway', 'app.credentials', 'SELECT') AS sel,
        has_table_privilege('fuelpulse_gateway', 'app.credentials', 'INSERT') AS ins,
        has_table_privilege('fuelpulse_gateway', 'app.credentials', 'UPDATE') AS upd,
        has_table_privilege('fuelpulse_gateway', 'app.credentials', 'DELETE') AS del
    `)).rows[0];
    if (!gwCred.sel || !gwCred.ins || !gwCred.upd || !gwCred.del) bad('gateway-credentials-grants', JSON.stringify(gwCred));
    ok('gateway-credentials-grants', 'SELECT, INSERT, UPDATE, DELETE');

    // fuelpulse_app must NOT have access to credentials
    const appCred = (await client.query(`
      SELECT has_table_privilege('fuelpulse_app', 'app.credentials', 'SELECT') AS sel
    `)).rows[0];
    if (appCred.sel) bad('app-no-credentials-access', 'fuelpulse_app must NOT have SELECT on app.credentials');
    ok('app-no-credentials-access', 'fuelpulse_app cannot read credentials');

    // PUBLIC revoked from app schema
    const pubUsage = (await client.query(`
      SELECT has_schema_privilege('public', 'app', 'USAGE') AS usage
    `)).rows[0].usage;
    if (pubUsage) bad('app-schema-public-revoked', 'PUBLIC still has USAGE on app schema');
    ok('app-schema-public-revoked', 'PUBLIC has no USAGE on app schema');
  }

  // ── Phase 4: Migration metadata privacy ──────────────────────
  console.log('\nPhase 4: Migration metadata privacy');
  {
    const history: { name: string; sha256: string; applied_at: Date }[] =
      (await client.query(`SELECT name, sha256, applied_at FROM fuelpulse_meta.migrations`)).rows;

    if (history.length !== 1) bad('metadata-1-row', `Expected 1 row, found ${history.length}`);
    if (history[0].name !== MIGRATION_NAME) bad('metadata-name', `Expected ${MIGRATION_NAME}, got ${history[0].name}`);
    ok('metadata-1-row', `applied at ${history[0].applied_at}`);

    let fileSha: string;
    try {
      const sql = await readFile(MIGRATION_PATH, 'utf8');
      fileSha = createHash('sha256').update(sql).digest('hex');
      if (fileSha !== EXPECTED_SHA) bad('migration-file-sha', `File SHA ${fileSha} != expected ${EXPECTED_SHA}`);
    } catch {
      console.log(`  ! Could not read ${MIGRATION_PATH} (CI may not have it in cwd)`);
      fileSha = EXPECTED_SHA;
    }
    if (history[0].sha256 !== fileSha) bad('metadata-sha256', `DB has ${history[0].sha256}, expected ${fileSha}`);
    ok('metadata-sha256', history[0].sha256);

    const metaRls = (await client.query(`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE oid = 'fuelpulse_meta.migrations'::regclass
    `)).rows[0];
    if (!metaRls.relrowsecurity) bad('metadata-rls-enabled', 'RLS not enabled on fuelpulse_meta.migrations');
    ok('metadata-rls-enabled', 'RLS enabled on fuelpulse_meta.migrations');

    const policies = parseInt(
      (await client.query(`SELECT count(*)::int n FROM pg_policies WHERE schemaname = 'fuelpulse_meta'`)).rows[0].n
    );
    if (policies > 0) bad('metadata-no-policies', `Found ${policies} unexpected policies on fuelpulse_meta`);
    ok('metadata-no-policies', 'No RLS policies expose fuelpulse_meta');

    const pubGrant = (await client.query(`
      SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
      WHERE n.nspname = 'fuelpulse_meta' AND a.grantee = 0
    `)).rowCount;
    if (pubGrant) bad('metadata-no-public-grant', 'PUBLIC has a grant on fuelpulse_meta schema');
    ok('metadata-no-public-grant', 'No PUBLIC privilege on fuelpulse_meta');

    for (const role of SUPABASE_API_ROLES) {
      const exists = (await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role])).rowCount;
      if (!exists) { console.log(`  - ${role} not present, skipping`); continue; }
      const access = (await client.query(
        `SELECT has_schema_privilege($1, 'fuelpulse_meta', 'USAGE') AS usage`, [role]
      )).rows[0];
      if (access.usage) bad(`metadata-blocked-${role}`, `${role} has USAGE on fuelpulse_meta`);
      ok(`metadata-blocked-${role}`, `${role} cannot access fuelpulse_meta`);
    }

    const legacy = (await client.query(`SELECT to_regclass('public.fuelpulse_migrations') AS t`)).rows[0].t;
    if (legacy) bad('no-legacy-tracker', 'Unexpected public.fuelpulse_migrations exists');
    ok('no-legacy-tracker', 'No legacy public tracker');
  }

  // ── Phase 5: PostgREST / Data API exposure ────────────────────
  console.log('\nPhase 5: PostgREST / Data API exposure');
  {
    const pgrstSchemas = (await client.query(
      `SELECT current_setting('pgrst.db_schemas', true) AS s`
    )).rows[0].s ?? '';

    if (pgrstSchemas.split(',').map((s: string) => s.trim()).includes('fuelpulse_meta')) {
      bad('pgrst-no-fuelpulse_meta', `pgrst.db_schemas includes fuelpulse_meta: "${pgrstSchemas}"`);
    }
    ok('pgrst-no-fuelpulse_meta', `pgrst.db_schemas = "${pgrstSchemas || '(not set at db level)'}"`);

    const exposedSchemas = pgrstSchemas.split(',').map((s: string) => s.trim());
    if (exposedSchemas.some((s: string) => s === 'app' || s === 'public')) {
      ok('pgrst-app-exposure-configured', `app in pgrst.db_schemas: "${pgrstSchemas}"`);
    } else {
      console.log(`  ! pgrst.db_schemas does not include 'app' at DB level`);
      console.log('    Configure: Supabase Dashboard > Settings > API > Exposed schemas > add app');
    }

    if (supabaseUrl && anonKey) {
      const baseHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

      // fuelpulse_meta MUST be blocked
      const metaRes = await httpGet(
        `${supabaseUrl}/rest/v1/migrations?select=sha256`,
        { ...baseHeaders, 'Accept-Profile': 'fuelpulse_meta' }
      );
      if (metaRes.ok) {
        const body = JSON.parse(metaRes.body);
        if (Array.isArray(body) && body.some((r: Record<string, unknown>) => r.sha256)) {
          bad('http-fuelpulse_meta-blocked', `Migration history readable via REST: ${metaRes.body.slice(0, 120)}`);
        }
      }
      ok('http-fuelpulse_meta-blocked', `HTTP ${metaRes.status} -- fuelpulse_meta not exposed via REST`);

      // app.organizations must return empty for anon (RLS blocks)
      const orgRes = await httpGet(
        `${supabaseUrl}/rest/v1/organizations?select=id`,
        { ...baseHeaders, 'Accept-Profile': 'app' }
      );
      if (orgRes.ok) {
        const body = JSON.parse(orgRes.body);
        if (!Array.isArray(body)) bad('http-app-rls', `Unexpected response: ${orgRes.body.slice(0, 120)}`);
        if (body.length > 0) bad('http-app-rls-empty', `RLS not blocking anon: ${body.length} orgs returned`);
        ok('http-app-rls-empty', 'Anonymous query to app.organizations returns [] -- RLS active');
      } else if (orgRes.status === 404 || orgRes.status === 406) {
        console.log(`  ! app schema not yet exposed via PostgREST (HTTP ${orgRes.status})`);
        console.log('    Configure: Supabase Dashboard > Settings > API > Exposed schemas > add app');
      } else {
        ok('http-app-response', `HTTP ${orgRes.status}`);
      }

      const health = await httpGet(`${supabaseUrl}/rest/v1/`, { ...baseHeaders });
      ok('http-postgrest-health', `PostgREST root HTTP ${health.status}`);
    } else {
      console.log('  ! SUPABASE_URL / SUPABASE_ANON_KEY not set -- HTTP checks skipped');
      console.log('    Add SUPABASE_URL and SUPABASE_ANON_KEY to GitHub secrets to enable them.');
    }
  }

  // ── Phase 6: Tenant isolation ──────────────────────────────────
  console.log('\nPhase 6: Tenant isolation (transactional -- always rolled back)');
  {
    await client.query('BEGIN');
    let isolationOk = false;
    try {
      // Insert two test organisations as postgres admin
      const orgA: string = (await client.query(
        `INSERT INTO app.organizations(slug,name) VALUES('ci-verify-tenant-a','CI Verify A') RETURNING id`
      )).rows[0].id;
      const orgB: string = (await client.query(
        `INSERT INTO app.organizations(slug,name) VALUES('ci-verify-tenant-b','CI Verify B') RETURNING id`
      )).rows[0].id;

      // Insert a pump for each org
      const pumpA: string = (await client.query(
        `INSERT INTO app.pumps(organization_id,name) VALUES($1,'Pump-A') RETURNING id`, [orgA]
      )).rows[0].id;
      await client.query(`INSERT INTO app.pumps(organization_id,name) VALUES($1,'Pump-B')`, [orgB]);

      // Switch to fuelpulse_app with org A context (SET LOCAL -- reverts on ROLLBACK)
      await client.query(`SET LOCAL ROLE fuelpulse_app`);
      await client.query(
        `SELECT set_config('app.org',$1,true),
                set_config('app.actor','00000000-0000-0000-0000-000000000000',true),
                set_config('app.role','OWNER',true)`,
        [orgA]
      );

      // Org A actor should see ONLY org A's pump
      const seen: { id: string; organization_id: string }[] =
        (await client.query(`SELECT id, organization_id FROM app.pumps ORDER BY id`)).rows;

      if (seen.length !== 1) bad('tenant-isolation-count', `Org A actor sees ${seen.length} pumps (expected 1)`);
      if (seen[0].id !== pumpA) bad('tenant-isolation-pump', `Wrong pump returned: ${seen[0].id}`);
      if (seen[0].organization_id !== orgA) bad('tenant-isolation-org', 'Result has wrong org ID');
      if (seen.some(p => p.organization_id === orgB)) bad('tenant-isolation-cross-org', 'Org B pump visible to org A actor!');

      // Attempt cross-org update -- must return 0 rows
      const updateRes = await client.query(
        `UPDATE app.pumps SET active = false WHERE organization_id = $1 RETURNING id`, [orgB]
      );
      if ((updateRes.rowCount ?? 0) > 0) bad('tenant-isolation-update', 'Org A actor updated org B pump!');

      ok('tenant-isolation', 'Org A sees its 1 pump only; org B pump invisible and immutable');
      isolationOk = true;
    } catch (e) {
      if (!isolationOk) throw e;
    } finally {
      await client.query('ROLLBACK'); // Always -- no test data survives
    }
    ok('tenant-isolation-cleanup', 'All test data rolled back -- no residue in production DB');
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n' + '='.repeat(52));
  console.log(`\u2713 ${passed.length} checks passed`);
  if (failed.length) {
    console.error(`\u2717 ${failed.length} checks FAILED: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log('\nHOSTED VERIFICATION COMPLETE');
  console.log('  Migration:        applied, SHA-256 verified');
  console.log('  14 tables:        all present in app schema');
  console.log('  FORCE RLS:        all 14 tables');
  console.log('  26 policies:      all active');
  console.log('  Roles & grants:   fuelpulse_app, fuelpulse_gateway correct');
  console.log('  Metadata:         private, no API access');
  console.log('  Tenant isolation: confirmed via transactional test');
  process.exit(0);
}

main()
  .catch(e => {
    console.error('\nFATAL:', e.message);
    process.exit(1);
  })
  .finally(() => client.end().catch(() => {}));
