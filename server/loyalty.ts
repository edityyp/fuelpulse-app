import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {actor,limit} from "./auth.js";
import {audit,fail,manage,tx} from "./db.js";
import {digest} from "./crypto.js";
import {plate} from "../shared/contracts.js";

export function loyaltyRoutes(app:FastifyInstance){
  app.get("/api/customer/vehicle-summary",async req=>{
    const q=z.object({plate}).strict().parse(req.query);
    const ip=digest(req.ip);
    const result=await tx(async c=>{
      if(!(await limit(c,"vehicle-summary:"+ip,60))) return null;
      const org=(await c.query(`select id,reward_threshold_points,reward_name,reward_quantity_ml from app.organizations order by created_at asc limit 1`)).rows[0];
      if(!org) fail(404,"Station not configured");
      const points=(await c.query(`select coalesce(sum(points),0)::text total from app.points_ledger where organization_id=$1 and plate=$2`,[org.id,q.plate])).rows[0].total;
      const pumps=(await c.query(`select p.id,p.name,coalesce(sum(t.points),0)::int points,count(t.id)::int transactions,coalesce(sum(t.amount_paise),0)::text amount_paise from app.pumps p left join app.transactions t on t.pump_id=p.id and t.organization_id=$1 and t.plate=$2 where p.organization_id=$1 group by p.id,p.name order by p.name`,[org.id,q.plate])).rows;
      const history=(await c.query(`select t.id,t.quantity_ml,t.amount_paise,t.payment_method,t.points,t.fraud,t.created_at,p.name pump_name from app.transactions t left join app.pumps p on p.id=t.pump_id where t.organization_id=$1 and t.plate=$2 order by t.created_at desc limit 100`,[org.id,q.plate])).rows;
      return {plate:q.plate,total_points:String(points),pumps,history,reward:{name:org.reward_name,threshold_points:org.reward_threshold_points,quantity_ml:org.reward_quantity_ml}};
    });
    if(!result) fail(429,"Too many lookups; try again later");
    return result;
  });

  app.get("/api/reward-redemptions",async req=>{
    const a=await actor(req);manage(a);
    return tx(async c=>(await c.query(`select r.id,r.plate,r.reward_name,r.quantity_ml,r.redeemed_at,p.name pump_name,u.name employee_name from app.reward_entitlements r left join app.pumps p on p.id=r.pump_id and p.organization_id=r.organization_id left join app.users u on u.id=r.redeemed_by and u.organization_id=r.organization_id where r.organization_id=$1 and r.redeemed_at is not null order by r.redeemed_at desc limit 100`,[a.organization_id])).rows,a);
  });

  app.post("/api/reward-redemptions/:id/note",async req=>{
    const a=await actor(req);manage(a);
    const id=z.object({id:z.string().uuid()}).parse(req.params).id;
    const b=z.object({note:z.string().trim().max(200)}).strict().parse(req.body);
    return tx(async c=>{const row=(await c.query(`update app.reward_entitlements set redemption_note=$1 where id=$2 and organization_id=$3 returning id`,[b.note,id,a.organization_id])).rows[0];if(!row)fail(404,"Redemption not found");await audit(c,a,"reward.redemption.note",id);return {ok:true};},a);
  });
}
