import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { runMigrations } from '../scripts/migration-runner.js';

const raw = process.env.MIGRATION_TEST_DATABASE_URL;
if (!raw) throw new Error('MIGRATION_TEST_DATABASE_URL must identify disposable local PostgreSQL');
const local = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(local.protocol) || !['127.0.0.1','localhost','[::1]'].includes(local.hostname)
  || local.search || local.hash || process.env.MIGRATION_TEST_ALLOW_DATABASE_CREATION !== 'true')
  throw new Error('Migration tests require explicit disposable LOCAL database-creation approval and no URL overrides');
const root = new pg.Client({ connectionString: raw });
const roles = ['anon','authenticated','service_role','authenticator','fuelpulse_test_runtime'];
before(async () => {
  await root.connect();
  // Cluster must be disposable. Existing roles are not altered or deleted by this suite.
  for (const role of roles) {
    if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount)
      await root.query(`CREATE ROLE "${role}" NOLOGIN ${role === 'service_role' ? 'BYPASSRLS' : 'NOBYPASSRLS'}`);
  }
});
after(async () => { await root.end(); });
const first = '202609080001_first.sql', second = '202609080002_second.sql';
const sql = 'CREATE SCHEMA sample; CREATE TABLE sample.proof(id integer PRIMARY KEY); INSERT INTO sample.proof VALUES (1);';

async function fixture(work: (f: { c: pg.Client; dir: string; run: () => ReturnType<typeof runMigrations>; url: string }) => Promise<void>) {
  const name = 'fuelpulse_migration_test_' + randomUUID().replaceAll('-', '');
  const dir = await mkdtemp(join(tmpdir(), 'fuelpulse-migrations-'));
  const url = new URL(raw!); url.pathname = '/' + name;
  let created = false;
  const c = new pg.Client({ connectionString: url.toString() });
  try {
    await root.query(`CREATE DATABASE "${name}"`); created = true;
    await c.connect();
    await c.query('GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,authenticator');
    await c.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role');
    await writeFile(join(dir, first), sql);
    await work({ c, dir, url: url.toString(), run: () => runMigrations({ connectionString:url.toString(), directory:dir, privateMetadataConfirmed:true }) });
  } finally {
    await c.end();
    if (created) await root.query(`DROP DATABASE "${name}"`);
    await rm(dir, { recursive:true, force:true });
  }
}
async function absent(c: pg.Client) {
  assert.equal((await c.query("SELECT to_regnamespace('fuelpulse_meta') AS n")).rows[0].n, null);
  assert.equal((await c.query("SELECT to_regnamespace('sample') AS n")).rows[0].n, null);
}

test('migration 01: fresh initialization has private owner-only RLS metadata and exact SHA-256', () => fixture(async ({ c, run }) => {
  assert.deepEqual(await run(), { applied:[first], skipped:0 });
  assert.equal((await c.query("SELECT to_regclass('public.fuelpulse_migrations') AS t")).rows[0].t, null);
  const state = (await c.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='fuelpulse_meta.migrations'::regclass")).rows[0];
  assert.deepEqual(state, { relrowsecurity:true, relforcerowsecurity:false });
  const history = (await c.query('SELECT name,sha256,applied_at FROM fuelpulse_meta.migrations')).rows;
  assert.equal(history.length, 1); assert.equal(history[0].name, first);
  assert.equal(history[0].sha256, createHash('sha256').update(sql).digest('hex'));
  assert(history[0].applied_at instanceof Date);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='fuelpulse_meta'")).rows[0].n, 0);
}));

test('migration 02: API and runtime roles cannot read, write, truncate or assume metadata ownership', () => fixture(async ({ c, run }) => {
  await run();
  for (const role of roles) {
    const p = (await c.query(`SELECT has_schema_privilege($1,'fuelpulse_meta','USAGE') AS usage,
      has_schema_privilege($1,'fuelpulse_meta','CREATE') AS create,
      has_table_privilege($1,'fuelpulse_meta.migrations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS table_access`,[role])).rows[0];
    assert.deepEqual(p, { usage:false, create:false, table_access:false });
    for (const query of ['SELECT * FROM fuelpulse_meta.migrations', "INSERT INTO fuelpulse_meta.migrations(name,sha256) VALUES ('fake',repeat('0',64))",
      "UPDATE fuelpulse_meta.migrations SET sha256=repeat('0',64)", 'DELETE FROM fuelpulse_meta.migrations', 'TRUNCATE fuelpulse_meta.migrations']) {
      await c.query('BEGIN');
      try { await c.query(`SET LOCAL ROLE "${role}"`); await assert.rejects(c.query(query), { code:'42501' }); }
      finally { await c.query('ROLLBACK'); }
    }
  }
  const publicAcl = await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
    WHERE n.nspname='fuelpulse_meta' AND a.grantee=0`);
  assert.equal(publicAcl.rowCount, 0);
}));

test('migration 03: repeat is idempotent and preserves timestamps', () => fixture(async ({ c, run }) => {
  await run(); const before = (await c.query('SELECT * FROM fuelpulse_meta.migrations')).rows;
  assert.deepEqual(await run(), { applied:[], skipped:1 });
  assert.deepEqual((await c.query('SELECT * FROM fuelpulse_meta.migrations')).rows, before);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM sample.proof')).rows[0].n, 1);
}));

test('migration 04: changed checksum aborts before a new migration', () => fixture(async ({ c, dir, run }) => {
  await run(); await writeFile(join(dir, first), sql+'\n-- changed');
  await writeFile(join(dir, second), 'CREATE TABLE sample.must_not_exist(id integer)');
  await assert.rejects(run(), /checksum mismatch/);
  assert.equal((await c.query("SELECT to_regclass('sample.must_not_exist') AS t")).rows[0].t, null);
}));

test('migration 05: missing applied file aborts without editing history', () => fixture(async ({ c, dir, run }) => {
  await run(); await rm(join(dir, first)); await writeFile(join(dir, second), 'SELECT 1');
  await assert.rejects(run(), /missing migration file/);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM fuelpulse_meta.migrations')).rows[0].n, 1);
}));

for (const kind of ['text','directory','symlink','duplicate','empty','invalid-utf8'] as const)
  test('migration 06: rejects unexpected input '+kind+' before initialization', () => fixture(async ({ c, dir, run }) => {
    if (kind === 'text') await writeFile(join(dir,'README.md'),'unexpected');
    if (kind === 'directory') await mkdir(join(dir,second));
    if (kind === 'symlink') await symlink(join(dir,first),join(dir,second));
    if (kind === 'duplicate') await writeFile(join(dir,'202609080001_duplicate.sql'),'SELECT 1');
    if (kind === 'empty') await writeFile(join(dir,first),' ');
    if (kind === 'invalid-utf8') await writeFile(join(dir,first),Buffer.from([0xff]));
    await assert.rejects(run()); await absent(c);
  }));

test('migration 07: legacy public history causes a safe abort and is left intact', () => fixture(async ({ c, run }) => {
  await c.query("CREATE TABLE public.fuelpulse_migrations(name text PRIMARY KEY); INSERT INTO public.fuelpulse_migrations VALUES ('legacy')");
  await assert.rejects(run(), /Legacy/); await absent(c);
  assert.deepEqual((await c.query('SELECT * FROM public.fuelpulse_migrations')).rows,[{name:'legacy'}]);
}));

test('migration 08: simultaneous runners serialize and apply once', () => fixture(async ({ c, dir, run }) => {
  await writeFile(join(dir,first), 'SELECT pg_sleep(0.2); '+sql);
  const results = await Promise.all([run(),run(),run()]);
  assert.equal(results.reduce((n,r) => n+r.applied.length,0),1);
  assert.equal(results.reduce((n,r) => n+r.skipped,0),2);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM sample.proof')).rows[0].n,1);
}));

test('migration 09: failed first deployment rolls back metadata, DDL and data', () => fixture(async ({ c, dir, run }) => {
  await writeFile(join(dir,second), 'CREATE TABLE sample.rolled_back(id integer); SELECT 1/0;');
  await assert.rejects(run(), {code:'22012'}); await absent(c);
}));

test('migration 10: failed later migration preserves prior history and data', () => fixture(async ({ c, dir, run }) => {
  await run(); const history=(await c.query('SELECT * FROM fuelpulse_meta.migrations')).rows;
  await writeFile(join(dir,second), 'INSERT INTO sample.proof VALUES (2); SELECT 1/0;');
  await assert.rejects(run(), {code:'22012'});
  assert.deepEqual((await c.query('SELECT * FROM fuelpulse_meta.migrations')).rows,history);
  assert.deepEqual((await c.query('SELECT * FROM sample.proof')).rows,[{id:1}]);
}));

for (const mutation of [
  'ALTER TABLE fuelpulse_meta.migrations DISABLE ROW LEVEL SECURITY',
  'CREATE TABLE fuelpulse_meta.unexpected(id integer)',
  'ALTER TABLE fuelpulse_meta.migrations ADD COLUMN unexpected integer',
  'GRANT USAGE ON SCHEMA fuelpulse_meta TO anon',
  'GRANT SELECT(name) ON fuelpulse_meta.migrations TO authenticated',
  'CREATE POLICY unexpected ON fuelpulse_meta.migrations USING (true)',
  'ALTER SCHEMA fuelpulse_meta OWNER TO anon',
  'ALTER TABLE fuelpulse_meta.migrations DROP CONSTRAINT migrations_sha256_check',
]) test('migration 11: unsafe metadata fails closed: '+mutation.split(' ').slice(0,3).join(' '), () => fixture(async ({ c, run }) => {
  await run(); await c.query(mutation); await assert.rejects(run(), /metadata|Unsafe|Unexpected/);
}));

test('migration 12: unknown pre-existing metadata namespace is not adopted', () => fixture(async ({ c, run }) => {
  await c.query('CREATE SCHEMA fuelpulse_meta');
  await assert.rejects(run(), /existing metadata schema/);
  assert.equal((await c.query("SELECT to_regclass('fuelpulse_meta.migrations') AS t")).rows[0].t,null);
}));

test('migration 13: adding an older migration behind applied history aborts', () => fixture(async ({ c, dir, run }) => {
  await run(); await writeFile(join(dir,'202609070001_older.sql'),'SELECT 1');
  await assert.rejects(run(), /ordered migration prefix/);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM fuelpulse_meta.migrations')).rows[0].n,1);
}));

test('migration 14: explicit exposure confirmation required before writes', () => fixture(async ({ c, dir, url }) => {
  await assert.rejects(runMigrations({connectionString:url,directory:dir,privateMetadataConfirmed:false}), /Confirm/);
  await absent(c);
}));

test('migration 15: observable PostgREST exposure blocks even with confirmation', () => fixture(async ({ c, run, url }) => {
  const db = new URL(url).pathname.slice(1);
  await c.query(`ALTER DATABASE "${db}" SET pgrst.db_schemas='public, fuelpulse_meta'`);
  await assert.rejects(run(), /must not be exposed/); await absent(c);
}));

test('migration 16: privileged API membership is detected, not silently revoked', () => fixture(async ({ c, run }) => {
  await run();
  await c.query('GRANT pg_read_all_data TO anon');
  try { await assert.rejects(run(), /metadata access/); }
  finally { await c.query('REVOKE pg_read_all_data FROM anon'); }
}));

test('migration 17: global table defaults cannot leak API access into private schema', () => fixture(async ({ c, run }) => {
  await c.query('ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role');
  await run();
  for (const role of roles) assert.equal((await c.query("SELECT has_table_privilege($1,'fuelpulse_meta.migrations','SELECT') AS p",[role])).rows[0].p,false);
}));


test('migration 18: quoted non-BYPASSRLS administrative owner can maintain private history', () => fixture(async ({ c, dir, url }) => {
  const role = 'migration-test-owner';
  if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
    await root.query('CREATE ROLE "migration-test-owner" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  const db = new URL(url).pathname.slice(1);
  await c.query(`GRANT CREATE ON DATABASE "${db}" TO "${role}"`);
  const ownerUrl = new URL(url); ownerUrl.username=role;
  const run = () => runMigrations({connectionString:ownerUrl.toString(),directory:dir,privateMetadataConfirmed:true});
  assert.deepEqual(await run(),{applied:[first],skipped:0});
  assert.deepEqual(await run(),{applied:[],skipped:1});
}));

test('migration 19: API roles elevated to superuser are rejected', () => fixture(async ({ c, run }) => {
  await run(); await c.query('ALTER ROLE service_role SUPERUSER');
  try { await assert.rejects(run(), /metadata access/); }
  finally { await c.query('ALTER ROLE service_role NOSUPERUSER'); }
}));
