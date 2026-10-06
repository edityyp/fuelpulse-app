import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { tx, fail } from './db.js';
import { digest } from './crypto.js';

const ADMIN_COOKIE = 'fp_admin_session';
const SESSION_HOURS = 8;

function adminPasswordConfigured() {
  return Boolean(process.env.FUELPULSE_ADMIN_PASSWORD && process.env.FUELPULSE_ADMIN_PASSWORD.length >= 12);
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
    const row = (await c.query('select 1 from public.private_admin_sessions where token_hash=$1 and expires_at>now()', [digest(token)])).rows[0];
    if (!row) fail(401, 'Admin session expired');
  });
}

function validCredential(value: string, label: string, min: number, max: number) {
  if (value.length < min || value.length > max) fail(400, `${label} must be ${min}-${max} characters`);
}

function generatedOwnerCode() {
  return `FP-OWN-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function generatedOwnerPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(18);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

export async function privateAdminRoutes(app: FastifyInstance) {
  app.post('/api/admin/login', async (req, reply) => {
    if (!adminPasswordConfigured()) fail(503, 'Admin access is not configured');
    const body = req.body as { password?: unknown };
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || !passwordMatches(password)) fail(401, 'Invalid admin credentials');

    const token = randomBytes(32).toString('hex');
    await tx(c => c.query("insert into public.private_admin_sessions(token_hash,expires_at) values($1,now()+$2*interval '1 hour')", [digest(token), SESSION_HOURS]));
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
    if (token) await tx(c => c.query('delete from public.private_admin_sessions where token_hash=$1', [digest(token)]));
    reply.clearCookie(ADMIN_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/admin/organizations', async req => {
    await requireAdmin(req);
    return tx(async c => (await c.query(`select o.id,o.slug,o.name,o.enabled as active,o.created_at,
      (select count(*) from public.staff_accounts s where s.organization_id=o.id and s.active) as active_users
      from public.organizations o order by o.created_at desc`)).rows);
  });

  app.patch('/api/admin/organizations/:id/status', async req => {
    await requireAdmin(req);
    const id = (req.params as { id?: string }).id;
    const body = req.body as { active?: unknown };
    if (!id || typeof body?.active !== 'boolean') fail(400, 'A valid organization ID and active state are required');
    return tx(async c => (await c.query(
      'update public.organizations set enabled=$2 where id=$1 returning id, enabled as active',
      [id, body.active],
    )).rows[0] ?? fail(404, 'Organization not found'));
  });

  app.post('/api/admin/owners', async req => {
    await requireAdmin(req);
    const body = req.body as {
      organizationName?: unknown;
      stationId?: unknown;
      ownerName?: unknown;
      ownerCode?: unknown;
      ownerPassword?: unknown;
    };
    const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';
    const stationId = typeof body?.stationId === 'string' ? body.stationId.trim().toLowerCase() : '';
    const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : '';
    const ownerCode = typeof body?.ownerCode === 'string' && body.ownerCode.trim() ? body.ownerCode.trim() : generatedOwnerCode();
    const ownerPassword = typeof body?.ownerPassword === 'string' && body.ownerPassword ? body.ownerPassword : generatedOwnerPassword();

    if (!organizationName || !ownerName || !stationId) {
      fail(400, 'Business name, Station ID, and owner name are required');
    }
    validCredential(organizationName, 'Business name', 2, 120);
    validCredential(ownerName, 'Owner name', 2, 120);
    validCredential(stationId, 'Station ID', 3, 63);
    validCredential(ownerCode, 'Owner code', 6, 24);
    validCredential(ownerPassword, 'Owner password', 12, 128);
    if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(stationId)) fail(400, 'Station ID may contain lowercase letters, numbers, and hyphens only');
    if (!/^[A-Za-z0-9-]{6,24}$/.test(ownerCode)) fail(400, 'Owner code may contain letters, numbers, and hyphens only');

    try {
      const result = await tx(async c => (await c.query(
        'select public.private_admin_create_owner($1,$2,$3,$4,$5) as result',
        [organizationName, ownerName, stationId, ownerCode, ownerPassword],
      )).rows[0]?.result);
      if (!result?.station_slug || !result?.owner_code) fail(500, 'Owner provisioning returned incomplete credentials');
      return { ...result, credentials_saved: true };
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: unknown}).code : undefined;
      if (code === '23505') fail(409, 'Station ID or owner code already exists. Choose unique credentials.');
      throw error;
    }
  });
}
