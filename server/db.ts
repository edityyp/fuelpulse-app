import pg from 'pg';
import type { Actor } from '../shared/contracts.js';
import { mockDb } from './mockDb.js';

const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const allowMockDb = !isProduction && process.env.FUELPULSE_ALLOW_MOCK_DB === 'true';
const hasRealDb = Boolean(databaseUrl);

function buildDbConfig() {
  if (!databaseUrl) return null;

  // Keep the connection string exactly as supplied by Supabase/Vercel.  In
  // particular, don't rewrite the pooler host or credentials.  Supabase's
  // current certificates are publicly trusted, so Node can validate the TLS
  // chain without requiring a repository-local CA file.  This also prevents a
  // missing build artifact from crashing the Vercel function during import.
  const connection = new URL(databaseUrl);
  connection.searchParams.delete('sslmode');
  connection.searchParams.delete('sslcert');
  connection.searchParams.delete('sslkey');
  connection.searchParams.delete('sslrootcert');

  return {
    connectionString: connection.toString(),
    ssl: { rejectUnauthorized: true },
    max: 20,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  };
}

const realPool = hasRealDb ? new pg.Pool(buildDbConfig()!) : null;
let useMock = allowMockDb;

function databaseUnavailableError(cause?: unknown) {
  const error = new Error('Production database unavailable');
  Object.assign(error, { statusCode: 503, cause });
  return error;
}

const mockClient = {
  query: async (text: string, params?: unknown[]) => {
    if (!allowMockDb) throw databaseUnavailableError();
    return mockDb.executeQuery(text, params);
  },
  release: () => {},
};

export const pool = {
  query: async (text: string, params?: unknown[]) => {
    if (useMock || !realPool) {
      if (allowMockDb) return mockDb.executeQuery(text, params);
      throw databaseUnavailableError();
    }
    try {
      return await realPool.query(text, params);
    } catch (err) {
      // Never silently switch a production request to the in-memory database.
      // Doing so can make authentication/admin writes appear successful while
      // no real data is persisted.
      if (allowMockDb) {
        console.warn('Database connection unavailable, active mock fallback:', (err as Error).message);
        useMock = true;
        return mockDb.executeQuery(text, params);
      }
      console.error('Database connection unavailable:', (err as Error).message);
      throw databaseUnavailableError(err);
    }
  },
  connect: async () => {
    if (useMock || !realPool) {
      if (allowMockDb) return mockClient as unknown as pg.PoolClient;
      throw databaseUnavailableError();
    }
    try {
      return await realPool.connect();
    } catch (err) {
      if (allowMockDb) {
        console.warn('Database connection unavailable, active mock fallback:', (err as Error).message);
        useMock = true;
        return mockClient as unknown as pg.PoolClient;
      }
      console.error('Database connection unavailable:', (err as Error).message);
      throw databaseUnavailableError(err);
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
