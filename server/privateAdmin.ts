import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { tx, fail } from './db.js';
import { digest, hashPassword } from './crypto.js';

const ADMIN_COOKIE = 'fp_admin_session';
const SESSION_HOURS = 8;

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

function makeOwnerCode() {
  return `FP-OWN-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
}

function makeOwnerPassword() {
  return `Fp-${randomBytes(12).toString('base64url')}-2026!`;
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
    return tx(async c => (await c.query(`select o.id,o.slug,o.name,o.created_at,
      (select count(*) from app.users u where u.organization_id=o.id and u.active) as active_users
      from app.organizations o order by o.created_at desc`)).rows);
  });

  app.post('/api/admin/owners', async req => {
    await requireAdmin(req);
    const body = req.body as { organizationName?: unknown; stationId?: unknown; ownerName?: unknown };
    const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';
    const stationId = typeof body?.stationId === 'string' ? body.stationId.trim().toLowerCase() : '';
    const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : '';
    if (!organizationName || !stationId || !ownerName) fail(400, 'Organization name, station ID, and owner name are required');

    const ownerCode = makeOwnerCode();
    const ownerPassword = makeOwnerPassword();
    const passwordHash = await hashPassword(ownerPassword);
    const result = await tx(async c => (await c.query(
      'select * from app.admin_provision_owner($1,$2,$3,$4,$5)',
      [organizationName, stationId, ownerName, ownerCode, passwordHash],
    )).rows[0]);

    return { ...result, ownerPassword };
  });
}
