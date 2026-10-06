import type { FastifyInstance } from 'fastify';
import { tx } from './db.js';

const REMINDER_COPY: Record<string,{title:string;body:(station:string,days:number)=>string}> = {
  TEN_DAYS: { title: 'FuelPulse package expires in 10 days', body: (station) => `Your FuelPulse package for ${station} expires in 10 days. Please contact the FuelPulse administrator to renew and avoid interruption.` },
  THREE_DAYS: { title: 'FuelPulse package expires in 3 days', body: (station) => `Your FuelPulse package for ${station} expires in 3 days. Please renew soon to keep access active.` },
  DUE: { title: 'FuelPulse package expires today', body: (station) => `Your FuelPulse package for ${station} expires today. Renewal is due to keep the station active.` },
  OVERDUE: { title: 'FuelPulse package is overdue', body: (station) => `Your FuelPulse package for ${station} has expired. A grace period is active; please renew as soon as possible.` },
};

export function subscriptionCronRoutes(app: FastifyInstance) {
  app.get('/api/cron/subscriptions', async (req, reply) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    return tx(async c => {
      const expired = (await c.query(`update public.station_subscriptions
        set status='EXPIRED',updated_at=now()
        where status='ACTIVE' and ends_at<=now()
        returning organization_id`)).rowCount ?? 0;

      const blocked = (await c.query(`update public.station_subscriptions
        set status='BLOCKED',blocked_at=coalesce(blocked_at,now()),block_reason=coalesce(block_reason,'Package expired after grace period'),updated_at=now()
        where status in ('ACTIVE','EXPIRED') and ends_at + grace_days*interval '1 day' <= now()
        returning organization_id`)).rows;
      for (const row of blocked) {
        await c.query('update public.organizations set enabled=false where id=$1',[row.organization_id]);
        await c.query("update public.staff_accounts set active=false,subscription_blocked=true where organization_id=$1 and active",[row.organization_id]);
        await c.query("update public.user_profiles set status='SUSPENDED',subscription_blocked=true,updated_at=now() where organization_id=$1 and status='ACTIVE'",[row.organization_id]);
        await c.query("update app.users set active=false where organization_id=$1",[row.organization_id]);
      }

      const reminderRows = (await c.query(`
        with due as (
          select s.id as subscription_id,s.organization_id,o.slug,o.name,s.ends_at,
            case
              when (s.ends_at at time zone 'Asia/Kolkata')::date = ((now() at time zone 'Asia/Kolkata')::date + 10) then 'TEN_DAYS'
              when (s.ends_at at time zone 'Asia/Kolkata')::date = ((now() at time zone 'Asia/Kolkata')::date + 3) then 'THREE_DAYS'
              when (s.ends_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date then 'DUE'
              when s.ends_at < now() and s.ends_at + s.grace_days*interval '1 day' > now() then 'OVERDUE'
            end as reminder_type
          from public.station_subscriptions s
          join public.organizations o on o.id=s.organization_id
          where s.status in ('ACTIVE','EXPIRED')
        )
        select d.*,sa.id as owner_id
        from due d
        join public.staff_accounts sa on sa.organization_id=d.organization_id and sa.role='OWNER' and sa.active
        where d.reminder_type is not null
      `)).rows;

      let remindersSent=0;
      for (const row of reminderRows) {
        const scheduledFor = new Date(row.ends_at).toISOString().slice(0,10);
        const inserted=(await c.query(`insert into public.subscription_reminders(subscription_id,reminder_type,scheduled_for)
          values($1,$2,$3::date) on conflict(subscription_id,reminder_type,scheduled_for) do nothing returning id`,
          [row.subscription_id,row.reminder_type,scheduledFor])).rows[0];
        if(!inserted) continue;
        const copy=REMINDER_COPY[row.reminder_type as string];
        if(copy) {
          await c.query(`insert into public.notifications(organization_id,user_id,title,body,kind)
            values($1,$2,$3,$4,'SUBSCRIPTION')`,
            [row.organization_id,row.owner_id,copy.title,copy.body(row.name,row.reminder_type==='TEN_DAYS'?10:row.reminder_type==='THREE_DAYS'?3:0)]);
          remindersSent++;
        }
      }
      return { ok:true,expired,blocked:blocked.length,remindersSent,ranAt:new Date().toISOString() };
    });
  });
}
