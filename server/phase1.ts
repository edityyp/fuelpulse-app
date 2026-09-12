import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { actor, manage } from "./auth.js";
import { tx } from "./db.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function phase1Routes(app: FastifyInstance) {
  app.get("/api/phase1/dashboard", async (req) => {
    const a = await actor(req);
    manage(a);
    return tx(async (c) => {
      const summary = (await c.query(`with days as (
        select coalesce(sum(amount_paise) filter(where business_day=(now() at time zone o.timezone)::date),0)::text today_revenue,
        coalesce(sum(quantity_ml) filter(where business_day=(now() at time zone o.timezone)::date),0)::text today_volume,
        count(*) filter(where business_day=(now() at time zone o.timezone)::date)::int today_transactions,
        coalesce(sum(amount_paise) filter(where business_day >= (now() at time zone o.timezone)::date - 6),0)::text week_revenue,
        coalesce(sum(amount_paise) filter(where business_day >= (now() at time zone o.timezone)::date - 29),0)::text month_revenue,
        coalesce(avg(amount_paise) filter(where business_day=(now() at time zone o.timezone)::date),0)::text today_average,
        count(*) filter(where business_day=(now() at time zone o.timezone)::date and fraud)::int today_fraud
        from app.transactions t join app.organizations o on o.id=t.organization_id where t.organization_id=$1
      ) select * from days`,[a.organization_id])).rows[0];
      const fuel=(await c.query(`select f.name,count(t.id)::int transactions,coalesce(sum(t.quantity_ml),0)::text volume,coalesce(sum(t.amount_paise),0)::text revenue
        from app.transactions t join app.fuels f on f.id=t.fuel_id where t.organization_id=$1 and t.business_day >= (select (now() at time zone timezone)::date-6 from app.organizations where id=$1)
        group by f.id,f.name order by sum(t.amount_paise) desc limit 8`,[a.organization_id])).rows;
      const pumps=(await c.query(`select p.name,count(t.id)::int transactions,coalesce(sum(t.quantity_ml),0)::text volume,coalesce(sum(t.amount_paise),0)::text revenue,count(t.id) filter(where t.fraud)::int fraud
        from app.pumps p left join app.transactions t on t.pump_id=p.id and t.organization_id=p.organization_id and t.business_day >= (select (now() at time zone timezone)::date-6 from app.organizations where id=$1)
        where p.organization_id=$1 group by p.id,p.name order by sum(coalesce(t.amount_paise,0)) desc nulls last limit 12`,[a.organization_id])).rows;
      const staff=(await c.query(`select u.id,u.name,u.code,u.role,count(t.id)::int transactions,coalesce(sum(t.amount_paise),0)::text revenue,coalesce(sum(t.quantity_ml),0)::text volume,count(t.id) filter(where t.fraud)::int fraud,coalesce(avg(t.amount_paise),0)::text average
        from app.users u left join app.transactions t on t.employee_id=u.id and t.organization_id=u.organization_id and t.business_day >= (select (now() at time zone timezone)::date-6 from app.organizations where id=$1)
        where u.organization_id=$1 and u.role in ('EMPLOYEE','MANAGER') group by u.id,u.name,u.code,u.role order by sum(coalesce(t.amount_paise,0)) desc`,[a.organization_id])).rows;
      const alerts=(await c.query(`with today as (select coalesce(sum(amount_paise) filter(where business_day=(now() at time zone o.timezone)::date),0)::numeric today,
        coalesce(sum(amount_paise) filter(where business_day=(now() at time zone o.timezone)::date-1),0)::numeric yesterday,
        count(*) filter(where business_day=(now() at time zone o.timezone)::date and fraud)::int fraud
        from app.transactions t join app.organizations o on o.id=t.organization_id where t.organization_id=$1) select * from today`,[a.organization_id])).rows[0];
      const result:{level:"critical"|"warning"|"info";title:string;detail:string}[]=[];
      if(Number(alerts.fraud)>0) result.push({level:"critical",title:`${alerts.fraud} fraud flag${Number(alerts.fraud)===1?"":"s"} today`,detail:"Review flagged transactions before closing the business day."});
      if(Number(alerts.yesterday)>0&&Number(alerts.today)<Number(alerts.yesterday)*.75) result.push({level:"warning",title:"Sales are down today",detail:`${Math.round((1-Number(alerts.today)/Number(alerts.yesterday))*100)}% below yesterday so far.`});
      if(!result.length) result.push({level:"info",title:"Operations look healthy",detail:"No high-priority sales or fraud alerts were detected."});
      return {summary,fuel,pumps,staff,alerts:result};
    },a);
  });

  app.get("/api/phase1/report", async (req) => {
    const a=await actor(req); manage(a);
    const q=z.object({from:date.optional(),to:date.optional()}).strict().parse(req.query);
    return tx(async c => {
      const params=[a.organization_id,q.from??"1900-01-01",q.to??"2999-12-31"];
      return (await c.query(`select t.created_at,t.plate,f.name fuel,p.name pump,t.quantity_ml,t.price_paise,t.amount_paise,t.payment_method,t.points,t.fraud,u.name employee
        from app.transactions t join app.fuels f on f.id=t.fuel_id join app.pumps p on p.id=t.pump_id left join app.users u on u.id=t.employee_id
        where t.organization_id=$1 and t.business_day between $2::date and $3::date order by t.created_at desc,t.id desc limit 10000`,params)).rows;
    },a);
  });

  app.get("/api/phase2/insights", async (req) => {
    const a=await actor(req); manage(a);
    return tx(async c => {
      const rows=(await c.query(`with periods as (
        select coalesce(sum(amount_paise) filter(where business_day=(now() at time zone o.timezone)::date),0)::numeric today,
        coalesce(sum(amount_paise) filter(where business_day between (now() at time zone o.timezone)::date-6 and (now() at time zone o.timezone)::date),0)::numeric week,
        coalesce(sum(amount_paise) filter(where business_day between (now() at time zone o.timezone)::date-13 and (now() at time zone o.timezone)::date-7),0)::numeric previous_week,
        count(*) filter(where business_day=(now() at time zone o.timezone)::date and fraud)::int today_fraud,
        count(*) filter(where business_day between (now() at time zone o.timezone)::date-6 and (now() at time zone o.timezone)::date and fraud)::int week_fraud,
        count(*) filter(where business_day between (now() at time zone o.timezone)::date-6 and (now() at time zone o.timezone)::date)::int week_tx
        from app.transactions t join app.organizations o on o.id=t.organization_id where t.organization_id=$1) select * from periods`,[a.organization_id])).rows[0];
      const concentration=(await c.query(`select plate,count(*)::int tx,coalesce(sum(amount_paise),0)::numeric revenue,count(*) filter(where fraud)::int fraud
        from app.transactions where organization_id=$1 and business_day >= (select (now() at time zone timezone)::date-6 from app.organizations where id=$1)
        group by plate order by count(*) desc,sum(amount_paise) desc limit 5`,[a.organization_id])).rows;
      const insights:{kind:"sales"|"fraud"|"attention";title:string;detail:string;severity:"high"|"medium"|"low"}[]=[];
      const week=Number(rows.week),previous=Number(rows.previous_week);
      if(previous>0){const change=(week-previous)/previous*100;if(change<=-10) insights.push({kind:"sales",title:"Sales trend needs attention",detail:`Revenue is ${Math.abs(Math.round(change))}% lower than the previous 7-day period. Check peak-hour coverage and repeat-customer activity.`,severity:change<=-25?"high":"medium"});else if(change>=10) insights.push({kind:"sales",title:"Positive sales momentum",detail:`Revenue is ${Math.round(change)}% higher than the previous 7-day period. Preserve the current operating pattern.`,severity:"low"});}
      const fraudRate=Number(rows.week_tx)?Number(rows.week_fraud)/Number(rows.week_tx):0;
      if(Number(rows.today_fraud)>0) insights.push({kind:"fraud",title:"Fraud review recommended",detail:`${rows.today_fraud} transaction${Number(rows.today_fraud)===1?" is":"s are"} flagged today. Review the transaction evidence and staff activity before day close.`,severity:"high"});
      else if(fraudRate>.03) insights.push({kind:"fraud",title:"Elevated fraud rate",detail:`${Math.round(fraudRate*1000)/10}% of the last 7 days' transactions are flagged. Review recurring patterns rather than individual transactions only.`,severity:"medium"});
      const repeat=concentration.find((r:{tx:number;fraud:number})=>r.tx>=5&&r.fraud>0);
      if(repeat) insights.push({kind:"attention",title:"Repeat vehicle requires review",detail:`Vehicle ${repeat.plate} has ${repeat.tx} transactions in 7 days with ${repeat.fraud} fraud flag${repeat.fraud===1?"":"s"}.`,severity:"medium"});
      if(!insights.length) insights.push({kind:"attention",title:"No unusual pattern detected",detail:"The available 7-day sales and fraud signals are within the normal thresholds used by FuelPulse intelligence.",severity:"low"});
      return {generated_at:new Date().toISOString(),insights,metrics:{week_revenue:rows.week,previous_week_revenue:rows.previous_week,week_fraud:rows.week_fraud,week_transactions:rows.week_tx},top_vehicles:concentration};
    },a);
  });
}
