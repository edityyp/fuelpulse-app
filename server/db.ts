import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Actor } from '../shared/contracts.js';
import { mockDb } from './mockDb.js';

const databaseUrl = process.env.DATABASE_URL;
const hasRealDb = Boolean(databaseUrl);

function buildDbConfig() {
  if (!databaseUrl) return null;

  // Vercel does not apply the Railway Dockerfile's NODE_EXTRA_CA_CERTS setup.
  // Load the approved Supabase CA directly so node-postgres can verify the
  // session-pooler certificate without weakening TLS verification.
  const connection = new URL(databaseUrl);
  connection.searchParams.delete('sslmode');
  connection.searchParams.delete('sslcert');
  connection.searchParams.delete('sslkey');
  connection.searchParams.delete('sslrootcert');

  const ca = readFileSync(resolve(process.cwd(), 'certs/supabase-root-2021-ca.crt'), 'utf8');

  return {
    connectionString: connection.toString(),
    ssl: { ca, rejectUnauthorized: true },
    max: 20,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  };
}

const realPool = hasRealDb ? new pg.Pool(buildDbConfig()!) : null;
let useMock = !hasRealDb;

const mockClient = {
  query: async (text: string, params?: unknown[]) => {
    return mockDb.executeQuery(text, params);
  },
  release: () => {},
};

export const pool = {
  query: async (text: string, params?: unknown[]) => {
    if (useMock || !realPool) {
      return mockDb.executeQuery(text, params);
    }
    try {
      return await realPool.query(text, params);
    } catch (err) {
      console.warn("Database connection unavailable, active mock fallback:", (err as Error).message);
      useMock = true;
      return mockDb.executeQuery(text, params);
    }
  },
  connect: async () => {
    if (useMock || !realPool) {
      return mockClient as unknown as pg.PoolClient;
    }
    try {
      return await realPool.connect();
    } catch (err) {
      console.warn("Database connection unavailable, active mock fallback:", (err as Error).message);
      useMock = true;
      return mockClient as unknown as pg.PoolClient;
    }
  },
  end: async () => {
    if (realPool) {
      await realPool.end().catch(() => {});
    }
  },
} as unknown as pg.Pool;

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>, a?: Actor): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE fuelpulse_gateway');
    if (a) {
      await c.query('SET LOCAL ROLE fuelpulse_app');
      await c.query("select set_config('app.org',$1,true),set_config('app.actor',$2,true),set_config('app.role',$3,true)", [
        a.organization_id,
        a.id,
        a.role,
      ]);
    }
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export function fail(statusCode: number, message: string): never {
  throw Object.assign(Error(message), { statusCode });
}

export function manage(a: Actor) {
  if (a.role === 'EMPLOYEE') fail(403, 'Not authorized');
}

export async function audit(c: pg.PoolClient, a: Actor, action: string, id?: string) {
  await c.query('insert into app.audit_logs(organization_id,actor_id,action,target_id) values($1,$2,$3,$4)', [
    a.organization_id,
    a.id,
    action,
    id ?? null,
  ]);
}
