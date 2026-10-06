import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { tx, fail } from './db.js';
import { digest } from './crypto.js';

const ADMIN_COOKIE = 'fp_admin_session';
const SESSION_HOURS = 8;
const PLANS = ['MONTHLY', 'QUARTERLY', 'HALF_YEAR', 'YEARLY'] as const;
const PAYMENTS = ['CASH', 'UPI', 'BANK', 'OTHER'] as const;

function adminPasswordConfigured() {
  return Boolean(process.env.FUELPULSE_ADMIN_PASSWORD && process.env.FUELPULSE_ADMIN_PASSWORD.length >= 12);
}
function passwordMatches(input: string) {
  const expected = process.env.FUELPULSE_ADMIN_PASSWORD ?? '';
  const a = Buffer.from(digest(input)), b = Buffer.from(digest(expected));
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
function normalizeOwnerCode(value: string) {
  return value.trim().replace(/\\s+/g, '-').toUpperCase();
}
function generatedOwnerCode() { return `FP-OWN-${randomBytes(4).toString('hex').toUpperCase()}`; }
function generatedOwnerPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(18);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}
function planOk(value: unknown): value is typeof PLANS[number] { return typeof value === 'string' && (PLANS as readonly string[]).includes(value); }
function paymentOk(value: unknown): value is typeof PAYMENTS[number] { return typeof value === 'string' && (PAYMENTS as readonly string[]).includes(value); }

export async function privateAdminRoutes(app: FastifyInstance) {
  app.post('/api/admin/login', async (req, reply) => {
    if (!adminPasswordConfigured()) fail(503, 'Admin access is not configured');
    const body = req.body as { password?: unknown };
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || !passwordMatches(password)) fail(401, 'Invalid admin credentials');
    const token = randomBytes(32).toString('hex');
    await tx(c => c.query("insert into public.private_admin_sessions(token_hash,expires_at) values($1,now()+$2*interval '1 hour')", [digest(token), SESSION_HOURS]));
    reply.setCookie(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: SESSION_HOURS * 3600 });
    return { ok: true };
  });

  app.get('/api/admin/me', async req => { await requireAdmin(req); return { ok: true }; });
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

  app.get('/api/admin/subscriptions', async req => {
    await requireAdmin(req);
    return tx(async c => (await c.query(`select o.id as organization_id,o.slug,o.name,o.enabled,
      s.id as subscription_id,s.plan_code,s.starts_at,s.ends_at,s.grace_days,s.status,s.price_paise,s.payment_status,s.last_payment_at,
      greatest(0,ceil(extract(epoch from (s.ends_at-now()))/86400))::int as days_left,
      greatest(0,ceil(extract(epoch from (s.ends_at+s.grace_days*interval '1 day'-now()))/86400))::int as access_days_left
      from public.organizations o
      left join public.station_subscriptions s on s.organization_id=o.id
      order by coalesce(s.ends_at,'infinity'::timestamptz) asc,o.created_at desc`)).rows);
  });

  app.patch('/api/admin/organizations/:id/status', async req => {
    await requireAdmin(req);
    const id = (req.params as { id?: string }).id;
    const body = req.body as { active?: unknown };
    if (!id || typeof body?.active !== 'boolean') fail(400, 'A valid organization ID and active state are required');
    return tx(async c => (await c.query(
      'update public.organizations set enabled=$2 where id=$1 returning id, enabled as active', [id, body.active],
    )).rows[0] ?? fail(404, 'Organization not found'));
  });

  app.post('/api/admin/owners', async req => {
    await requireAdmin(req);
    const body = req.body as { organizationName?: unknown; stationId?: unknown; ownerName?: unknown; ownerCode?: unknown; ownerPassword?: unknown; planCode?: unknown; pricePaise?: unknown; graceDays?: unknown };
    const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';
    const stationId = typeof body?.stationId === 'string' ? body.stationId.trim().toLowerCase() : '';
    const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : '';
    const ownerCode = typeof body?.ownerCode === 'string' && body.ownerCode.trim() ? normalizeOwnerCode(body.ownerCode) : generatedOwnerCode();
    const ownerPassword = typeof body?.ownerPassword === 'string' && body.ownerPassword ? body.ownerPassword : generatedOwnerPassword();
    const planCode = planOk(body?.planCode) ? body.planCode : 'MONTHLY';
    const pricePaise = typeof body?.pricePaise === 'number' && Number.isInteger(body.pricePaise) && body.pricePaise >= 0 ? body.pricePaise : 0;
    const graceDays = typeof body?.graceDays === 'number' && Number.isInteger(body.graceDays) && body.graceDays >= 0 && body.graceDays <= 30 ? body.graceDays : 3;
    if (!organizationName || !ownerName || !stationId) fail(400, 'Business name, Station ID, and owner name are required');
    validCredential(organizationName, 'Business name', 2, 120);
    validCredential(ownerName, 'Owner name', 2, 120);
    validCredential(stationId, 'Station ID', 3, 63);
    validCredential(ownerCode, 'Owner code', 6, 24);
    validCredential(ownerPassword, 'Owner password', 12, 128);
    if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(stationId)) fail(400, 'Station ID may contain lowercase letters, numbers, and hyphens only');
    if (!/^[A-Z0-9-]{6,24}$/.test(ownerCode)) fail(400, 'Owner code may contain letters, numbers, spaces, and hyphens only');

    try {
      const result = await tx(async c => {
        const created = (await c.query('select public.private_admin_create_owner($1,$2,$3,$4,$5) as result', [organizationName, ownerName, stationId, ownerCode, ownerPassword])).rows[0]?.result;
        if (!created?.station_slug || !created?.owner_code || !created?.organizationId) fail(500, 'Owner provisioning returned incomplete credentials');
        const sub = (await c.query(`insert into public.station_subscriptions(organization_id,plan_code,starts_at,ends_at,grace_days,status,price_paise,payment_status,last_payment_at)
          values($1,$2,now(),now()+case $2 when 'MONTHLY' then interval '1 month' when 'QUARTERLY' then interval '3 months' when 'HALF_YEAR' then interval '6 months' when 'YEARLY' then interval '12 months' end,$3,'ACTIVE',$4,'PAID',now())
          returning id,plan_code,starts_at,ends_at,grace_days,price_paise`, [created.organizationId, planCode, graceDays, pricePaise])).rows[0];
        await c.query('insert into public.subscription_payments(organization_id,subscription_id,plan_code,amount_paise,payment_method,notes) values($1,$2,$3,$4,$5,$6)',
          [created.organizationId, sub.id, planCode, pricePaise, 'OTHER', 'Initial package']);
        return { ...created, subscription: sub };
      });
      return { ...result, credentials_saved: true };
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: unknown}).code : undefined;
      if (code === '23505') fail(409, 'Station ID or owner code already exists. Choose unique credentials.');
      throw error;
    }
  });

  app.post('/api/admin/subscriptions/:organizationId/renew', async req => {
    await requireAdmin(req);
    const organizationId = (req.params as { organizationId?: string }).organizationId;
    const body = req.body as { planCode?: unknown; pricePaise?: unknown; paymentMethod?: unknown; paymentReference?: unknown; notes?: unknown; graceDays?: unknown };
    if (!organizationId || !planOk(body?.planCode)) fail(400, 'A valid package is required');
    const pricePaise = typeof body?.pricePaise === 'number' && Number.isInteger(body.pricePaise) && body.pricePaise >= 0 ? body.pricePaise : 0;
    const paymentMethod = paymentOk(body?.paymentMethod) ? body.paymentMethod : 'OTHER';
    const paymentReference = typeof body?.paymentReference === 'string' ? body.paymentReference.trim().slice(0,120) : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0,500) : '';
    const graceDays = typeof body?.graceDays === 'number' && Number.isInteger(body.graceDays) && body.graceDays >= 0 && body.graceDays <= 30 ? body.graceDays : 3;
    return tx(async c => {
      const row = (await c.query('select id,ends_at from public.station_subscriptions where organization_id=$1 for update',[organizationId])).rows[0];
      if (!row) fail(404,'Subscription not found');
      const sub = (await c.query(`update public.station_subscriptions set plan_code=$2,starts_at=case when ends_at<now() then now() else starts_at end,
        ends_at=greatest(ends_at,now())+case $2 when 'MONTHLY' then interval '1 month' when 'QUARTERLY' then interval '3 months' when 'HALF_YEAR' then interval '6 months' when 'YEARLY' then interval '12 months' end,
        grace_days=$3,status='ACTIVE',payment_status='PAID',last_payment_at=now(),blocked_at=null,block_reason=null,updated_at=now()
        where organization_id=$1 returning id,plan_code,starts_at,ends_at,grace_days,price_paise`,[organizationId,body.planCode,graceDays,pricePaise])).rows[0];
      await c.query('update public.station_subscriptions set price_paise=$2 where id=$1',[sub.id,pricePaise]);
      await c.query('insert into public.subscription_payments(organization_id,subscription_id,plan_code,amount_paise,payment_method,payment_reference,notes) values($1,$2,$3,$4,$5,$6,$7)',
        [organizationId,sub.id,body.planCode,pricePaise,paymentMethod,paymentReference||null,notes||null]);
      await c.query('update public.organizations set enabled=true where id=$1',[organizationId]);
      await c.query("update public.staff_accounts set active=true,subscription_blocked=false where organization_id=$1 and subscription_blocked=true",[organizationId]);
      await c.query("update public.user_profiles set status='ACTIVE',subscription_blocked=false,updated_at=now() where organization_id=$1 and subscription_blocked=true",[organizationId]);
      return sub;
    });
  });

  app.post('/api/admin/subscriptions/:organizationId/block', async req => {
    await requireAdmin(req);
    const organizationId = (req.params as { organizationId?: string }).organizationId;
    const body = req.body as { reason?: unknown };
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0,500) : 'Blocked by administrator';
    if (!organizationId) fail(400,'Organization is required');
    return tx(async c => {
      const row=(await c.query(`update public.station_subscriptions set status='BLOCKED',blocked_at=now(),block_reason=$2,updated_at=now()
        where organization_id=$1 returning id,status,block_reason`,[organizationId,reason])).rows[0];
      if(!row) fail(404,'Subscription not found');
      await c.query('update public.organizations set enabled=false where id=$1',[organizationId]);
      await c.query("update public.staff_accounts set active=false,subscription_blocked=true where organization_id=$1 and active",[organizationId]);
      await c.query("update public.user_profiles set status='SUSPENDED',subscription_blocked=true,updated_at=now() where organization_id=$1 and status='ACTIVE'",[organizationId]);
      return row;
    });
  });

  app.post('/api/admin/subscriptions/:organizationId/unblock', async req => {
    await requireAdmin(req);
    const organizationId = (req.params as { organizationId?: string }).organizationId;
    if (!organizationId) fail(400,'Organization is required');
    return tx(async c => {
      const row=(await c.query(`select id,ends_at,grace_days from public.station_subscriptions where organization_id=$1`,[organizationId])).rows[0];
      if(!row) fail(404,'Subscription not found');
      const accessUntil=new Date(new Date(row.ends_at).getTime()+Number(row.grace_days)*86400000);
      if(accessUntil.getTime()<=Date.now()) fail(409,'Package has ended. Renew the package before reactivating.');
      const out=(await c.query(`update public.station_subscriptions set status='ACTIVE',blocked_at=null,block_reason=null,updated_at=now() where organization_id=$1
        returning id,status,ends_at,grace_days`,[organizationId])).rows[0];
      await c.query('update public.organizations set enabled=true where id=$1',[organizationId]);
      await c.query("update public.staff_accounts set active=true,subscription_blocked=false where organization_id=$1 and subscription_blocked=true",[organizationId]);
      await c.query("update public.user_profiles set status='ACTIVE',subscription_blocked=false,updated_at=now() where organization_id=$1 and subscription_blocked=true",[organizationId]);
      return out;
    });
  });
}
