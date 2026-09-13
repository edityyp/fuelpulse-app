import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { tx, fail } from './db.js';
import { digest, hashPassword } from './crypto.js';

const ADMIN_COOKIE = 'fp_admin_session';
const SESSION_HOURS = 8;
const STATION_ID_SUFFIX_LENGTH = 8;
const PROVISION_RETRIES = 5;

function adminPasswordConfigured() {
  return Boolean(process.env.FUELPULSE_ADMIN_PASSWORD && process.env.FUELPULSE_ADMIN_PASSWORD.length >= 16);
}

function passwordMatches(input: string) {
  const expected = process.env.FUELPULSE_ADMIN_PASSWORD ?? '';
  const a = Buffer.from(digest(input));
  const b = Buffer.from(digest(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function requireAdmin(req: FastifyRequest) {
  const token = req.cookies[ADMIN_COOKIE];
  if (!token) fail(401, 'Admin authentication required');
  await tx(async c => {
    const row = (await c.query('select 1 from app.admin_sessions where token_hash=$1 and expires_at>now()', [digest(token)])).rows[0];
    if (!row) fail(401, 'Admin session expired');
  });
}

const OWNER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STATION_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomCode(length: number, alphabet: string) {
  const bytes = randomBytes(length);
  let value = '';
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return value;
}

function makeOwnerCode() {
  return `FP-OWN-${randomCode(6, OWNER_CODE_ALPHABET)}`;
}

function makeOwnerPassword() {
  return `Fp-${randomBytes(12).toString('base64url')}-2026!`;
}

function slugifyStationName(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54);
  return (base.length >= 3 ? base : 'fuel-station');
}

function makeStationId(organizationName: string) {
  return `${slugifyStationName(organizationName)}-${randomCode(STATION_ID_SUFFIX_LENGTH, STATION_ID_ALPHABET)}`;
}

function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505';
}

export async function privateAdminRoutes(app: FastifyInstance) {
  app.post('/api/admin/login', async (req, reply) => {
    if (!adminPasswordConfigured()) fail(503, 'Admin access is not configured');
    const body = req.body as { password?: unknown };
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || !passwordMatches(password)) fail(401, 'Invalid admin credentials');

    const token = randomBytes(32).toString('hex');
    await tx(c => c.query("insert into app.admin_sessions(token_hash,expires_at) values($1,now()+$2*interval '1 hour')", [digest(token), SESSION_HOURS]));
    reply.setCookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    });
    return { ok: true };
  });

  app.get('/api/admin/me', async req => {
    await requireAdmin(req);
    return { ok: true };
  });

  app.post('/api/admin/logout', async (req, reply) => {
    const token = req.cookies[ADMIN_COOKIE];
    if (token) await tx(c => c.query('delete from app.admin_sessions where token_hash=$1', [digest(token)]));
    reply.clearCookie(ADMIN_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/admin/organizations', async req => {
    await requireAdmin(req);
    return tx(async c => (await c.query(`select o.id,o.slug,o.name,o.active,o.created_at,
      (select count(*) from app.users u where u.organization_id=o.id and u.active) as active_users
      from app.organizations o order by o.created_at desc`)).rows);
  });

  app.patch('/api/admin/organizations/:id/status', async req => {
    await requireAdmin(req);
    const id = (req.params as { id?: string }).id;
    const body = req.body as { active?: unknown };
    if (!id || typeof body?.active !== 'boolean') fail(400, 'A valid organization ID and active state are required');
    return tx(async c => (await c.query('select * from app.admin_set_organization_active($1,$2)', [id, body.active])).rows[0]);
  });

  app.post('/api/admin/owners', async req => {
    await requireAdmin(req);
    const body = req.body as { organizationName?: unknown; stationId?: unknown; ownerName?: unknown };
    const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';
    const requestedStationId = typeof body?.stationId === 'string' ? body.stationId.trim().toLowerCase() : '';
    const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : '';
    if (!organizationName || !ownerName) fail(400, 'Organization name and owner name are required');
    if (organizationName.length < 2 || organizationName.length > 120) fail(400, 'Organization name must be 2-120 characters');
    if (ownerName.length < 2 || ownerName.length > 120) fail(400, 'Owner name must be 2-120 characters');
    if (requestedStationId && !/^[a-z0-9][a-z0-9-]{2,62}$/.test(requestedStationId)) fail(400, 'Invalid station ID');

    const ownerPassword = makeOwnerPassword();
    const passwordHash = await hashPassword(ownerPassword);

    for (let attempt = 0; attempt < PROVISION_RETRIES; attempt += 1) {
      const ownerCode = makeOwnerCode();
      // Station IDs are generated by the server by default. A supplied ID is still
      // accepted for backwards compatibility, but is never required by the UI.
      const stationId = requestedStationId || makeStationId(organizationName);
      try {
        const result = await tx(async c => (await c.query(
          'select * from app.admin_provision_owner($1,$2,$3,$4,$5)',
          [organizationName, stationId, ownerName, ownerCode, passwordHash],
        )).rows[0]);
        return { ...result, ownerPassword };
      } catch (error) {
        if (!isUniqueConflict(error) || requestedStationId) throw error;
      }
    }

    fail(409, 'Unable to allocate a unique station ID. Please retry.');
  });
}
