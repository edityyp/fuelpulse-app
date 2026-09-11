import pg from 'pg';
import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

export class MigrationSafetyError extends Error {}
const apiRoles = ['anon', 'authenticated', 'service_role', 'authenticator'];
const fail = (message: string): never => { throw new MigrationSafetyError(message); };

// ── Supabase target safety ───────────────────────────────────────────────────
// Hard guardrail to prevent accidentally running migrations against the wrong
// Supabase project.
const EXPECTED_SUPABASE_PROJECT_REF = 'pbjftnlixuysmeotpsjc';
const FORBIDDEN_SUPABASE_PROJECT_REF = 'riywnbifqpsylsdocoyi';
function verifySupabaseTarget(connectionString: string) {
  let host = '';
  try { host = new URL(connectionString).hostname; } catch { fail('Invalid MIGRATION_DATABASE_URL'); }
  if (host.includes(FORBIDDEN_SUPABASE_PROJECT_REF)) fail('Forbidden Supabase target (old project)');
  if (!host.includes(EXPECTED_SUPABASE_PROJECT_REF))
    fail(`Unexpected Supabase target host: ${host} (expected ${EXPECTED_SUPABASE_PROJECT_REF})`);
}

const ident = (name: string) => '"' + name.replaceAll('"', '""') + '"';

type Migration = { name: string; sql: string; sha256: string };
export async function readMigrations(directory: string): Promise<Migration[]> {
  const root = resolve(directory);
  if (!(await lstat(root)).isDirectory()) fail('Migration directory must be a real directory');
  const entries = (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (!entries.length) fail('No migration files found');
  const versions = new Set<string>();
  const result: Migration[] = [];
  for (const entry of entries) {
    const match = /^(\d{12}|\d{14})_[A-Za-z0-9][A-Za-z0-9_-]*\.sql$/.exec(entry.name);
    if (!match || !entry.isFile()) fail('Unexpected migration file or directory');
    if (versions.has(match![1])) fail('Duplicate migration version');
    versions.add(match![1]);
    const file = await open(join(root, entry.name), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024) fail('Unsafe migration file');
      const bytes = await file.readFile();
      const sql = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!sql.trim()) fail('Empty migration file');
      result.push({ name: entry.name, sql, sha256: createHash('sha256').update(bytes).digest('hex') });
    } finally { await file.close(); }
  }
  return result;
}

async function checkExposure(c: pg.Client, confirmed: boolean) {
  if (!confirmed) fail('Confirm fuelpulse_meta is excluded from Data API before migrating');
  const configs = await c.query<{ value: string }>(`
    SELECT current_setting('pgrst.db_schemas', true) AS value
    UNION ALL
    SELECT substring(setting from length('pgrst.db_schemas=') + 1)
    FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) setting
    WHERE setting LIKE 'pgrst.db_schemas=%'
      AND (s.setdatabase = 0 OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()))
  `);
  if (configs.rows.some(row => row.value && row.value.split(',').some(v => v.trim().replaceAll('"', '').toLowerCase() === 'fuelpulse_meta')))
    fail('fuelpulse_meta must not be exposed through Data API');
}

async function verifyMetadata(c: pg.Client, owner: string) {
  const state = (await c.query(`
    SELECT (SELECT rolname FROM pg_roles WHERE oid=n.nspowner) AS schema_owner, (SELECT rolname FROM pg_roles WHERE oid=c.relowner) AS table_owner,
      c.relkind, c.relpersistence, c.relrowsecurity, c.relforcerowsecurity,
      (SELECT count(*)::int FROM pg_class WHERE relnamespace=n.oid) AS relations,
      (SELECT count(*)::int FROM pg_proc WHERE pronamespace=n.oid) AS routines,
      (SELECT count(*)::int FROM pg_type WHERE typnamespace=n.oid
        AND oid NOT IN (c.reltype,(SELECT typarray FROM pg_type WHERE oid=c.reltype))) AS extra_types,
      (SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid) AS policies,
      (SELECT count(*)::int FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal) AS triggers,
      (SELECT count(*)::int FROM pg_rewrite WHERE ev_class=c.oid) AS rules,
      (SELECT count(*)::int FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid) AS inheritance,
      (SELECT count(*)::int FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee<>n.nspowner) AS schema_grants,
      (SELECT count(*)::int FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner) AS table_grants,
      (SELECT count(*)::int FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a
        WHERE at.attrelid=c.oid AND a.grantee<>c.relowner) AS column_grants
    FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
    WHERE n.nspname='fuelpulse_meta' AND c.relname='migrations'
  `)).rows[0];
  if (!state || state.schema_owner !== owner || state.table_owner !== owner || state.relkind !== 'r'
    || state.relpersistence !== 'p' || !state.relrowsecurity || state.relforcerowsecurity || state.relations !== 2
    || ['routines','extra_types','policies','triggers','rules','inheritance','schema_grants','table_grants','column_grants'].some(k => state[k] !== 0))
    fail('Unsafe or unexpected metadata objects, ownership, RLS or grants');
  const columns = (await c.query(`
    SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,
      a.attidentity::text AS identity,a.attgenerated::text AS generated,pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='fuelpulse_meta.migrations'::regclass AND a.attnum>0 ORDER BY a.attnum
  `)).rows;
  const expected = [
    { name:'name',type:'text',required:true,identity:'',generated:'',default_value:null },
    { name:'sha256',type:'text',required:true,identity:'',generated:'',default_value:null },
    { name:'applied_at',type:'timestamp with time zone',required:true,identity:'',generated:'',default_value:'now()' },
  ];
  if (JSON.stringify(columns) !== JSON.stringify(expected)) fail('Unexpected metadata columns');
  const constraints = (await c.query(`SELECT conname AS name,pg_get_constraintdef(oid) AS definition,convalidated AS valid
    FROM pg_constraint WHERE conrelid='fuelpulse_meta.migrations'::regclass ORDER BY conname`)).rows;
  if (JSON.stringify(constraints) !== JSON.stringify([
    { name:'migrations_pkey',definition:'PRIMARY KEY (name)',valid:true },
    { name:'migrations_sha256_check',definition:"CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))",valid:true },
  ])) fail('Unexpected metadata constraints');
  const indexes = (await c.query(`SELECT indisvalid,indisready,indisprimary,indisunique
    FROM pg_index WHERE indrelid='fuelpulse_meta.migrations'::regclass`)).rows;
  if (indexes.length !== 1 || Object.values(indexes[0]).some(v => v !== true)) fail('Unsafe metadata index');
  const denied = await c.query(`
    SELECT r.rolname FROM pg_roles r
    WHERE (r.rolname=ANY($1::text[]) OR r.rolname LIKE 'fuelpulse\\_%' ESCAPE '\\'
      OR (NOT r.rolsuper AND EXISTS (SELECT 1 FROM pg_roles target WHERE target.rolname IN ('fuelpulse_app','fuelpulse_gateway')
        AND pg_has_role(r.oid,target.oid,'MEMBER'))))
      AND r.rolname<>$2
      AND (has_schema_privilege(r.oid,'fuelpulse_meta','USAGE') OR has_schema_privilege(r.oid,'fuelpulse_meta','CREATE')
        OR has_table_privilege(r.oid,'fuelpulse_meta.migrations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(r.oid,'fuelpulse_meta.migrations','SELECT,INSERT,UPDATE,REFERENCES')
        OR pg_has_role(r.oid,$2::regrole,'SET'))
  `, [apiRoles, owner]);
  if (denied.rowCount) fail('API/runtime role has metadata access or can assume the migration owner');
  if ((await c.query('SELECT current_user AS name')).rows[0].name !== owner) fail('Migration owner changed');
}

export type MigrationOptions = { connectionString: string; directory: string; privateMetadataConfirmed: boolean };
export async function runMigrations(options: MigrationOptions): Promise<{ applied: string[]; skipped: number }> {
  if (!options.privateMetadataConfirmed) fail('Confirm fuelpulse_meta is excluded from Data API before migrating');

  verifySupabaseTarget(options.connectionString);

  const files = await readMigrations(options.directory); // Snapshot exact executable bytes before any DB mutation.
  const c = new pg.Client({ connectionString: options.connectionString, connectionTimeoutMillis: 5000, statement_timeout: 60000 });
  const applied: string[] = [];
  let begun = false;
  try {
    await c.connect();
    await c.query('BEGIN'); begun = true;
    await c.query("SET LOCAL search_path=pg_catalog");
    await c.query("SET LOCAL lock_timeout='30s'");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('fuelpulse.migrate',0))");
    await checkExposure(c, options.privateMetadataConfirmed);
    const owner = (await c.query('SELECT current_user AS name')).rows[0].name as string;
    if (apiRoles.includes(owner) || owner.startsWith('fuelpulse_')) fail('Use a separate administrative migration owner, not an API/runtime role');
    const preflight = (await c.query(`SELECT to_regnamespace('fuelpulse_meta')::text AS schema,
      to_regclass('fuelpulse_meta.migrations')::text AS tracker,to_regclass('public.fuelpulse_migrations')::text AS legacy`)).rows[0];
    if (preflight.legacy) fail('Legacy public.fuelpulse_migrations detected; explicit reconciliation required');
    if (Boolean(preflight.schema) !== Boolean(preflight.tracker)) fail('Incomplete or unexpected existing metadata schema');
    if (!preflight.schema) {
      await c.query('CREATE SCHEMA fuelpulse_meta AUTHORIZATION CURRENT_USER');
      await c.query(`CREATE TABLE fuelpulse_meta.migrations (
        name text CONSTRAINT migrations_pkey PRIMARY KEY,
        sha256 text NOT NULL CONSTRAINT migrations_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const roles = (await c.query<{ rolname: string }>('SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])', [apiRoles])).rows;
      const revokeFrom = ['PUBLIC', ...roles.map(r => ident(r.rolname))].join(',');
      await c.query(`REVOKE ALL ON SCHEMA fuelpulse_meta FROM ${revokeFrom}`);
      await c.query(`REVOKE ALL ON TABLE fuelpulse_meta.migrations FROM ${revokeFrom}`);
      await c.query('ALTER TABLE fuelpulse_meta.migrations ENABLE ROW LEVEL SECURITY');
    }
    await verifyMetadata(c, owner);
    const history = (await c.query<{ name: string; sha256: string }>('SELECT name,sha256 FROM fuelpulse_meta.migrations ORDER BY name COLLATE "C"')).rows;
    const byName = new Map(files.map(f => [f.name, f]));
    for (const row of history) {
      const file = byName.get(row.name);
      if (!file) fail('History references a missing migration file');
      if (file!.sha256 !== row.sha256) fail('Applied migration checksum mismatch');
    }
    if (history.some((row, i) => files[i]?.name !== row.name)) fail('Applied history is not an ordered migration prefix');
    for (const file of files.slice(history.length)) {
      await c.query(file.sql);
      await c.query('INSERT INTO fuelpulse_meta.migrations(name,sha256) VALUES($1,$2)', [file.name,file.sha256]);
      applied.push(file.name);
    }
    await verifyMetadata(c, owner);
    await checkExposure(c, options.privateMetadataConfirmed);
    await c.query('COMMIT'); begun = false;
    return { applied, skipped: history.length };
  } catch (error) {
    if (begun) await c.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { await c.end(); }
}
