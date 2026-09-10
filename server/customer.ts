import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { actor, limit } from "./auth.js";
import { audit, fail, manage, tx } from "./db.js";
import { digest } from "./crypto.js";
import { plate, rewardCode } from "../shared/contracts.js";
import { recognizeImage } from "./alpr.js";

const station = z.string().regex(/^[a-z0-9-]{3,40}$/),
  phone = z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  lookup = z.object({ station, plate }).strict(),
  customer = z
    .object({
      name: z.string().trim().min(2).max(80),
      phone_e164: phone,
      plate,
      label: z.string().trim().max(40).optional(),
    })
    .strict(),
  mask = (v: string) =>
    v.length < 5
      ? "\u2022\u2022\u2022\u2022"
      : `${v.slice(0, 3)}${"\u2022".repeat(Math.max(4, v.length - 7))}${v.slice(-4)}`;

type RewardOrg = {
  id: string;
  reward_threshold_points: number;
  reward_name: string;
  reward_quantity_ml: number;
};

async function ensureRewards(
  c: PoolClient,
  org: RewardOrg,
  vehiclePlate: string,
) {
  await c.query(
    "select pg_advisory_xact_lock(hashtextextended($1,0))",
    [`reward:${org.id}:${vehiclePlate}`],
  );
  const earned = Number(
    (
      await c.query(
        "select coalesce(sum(points),0)::text n from app.points_ledger where organization_id=$1 and plate=$2",
        [org.id, vehiclePlate],
      )
    ).rows[0].n,
  );
  const used = Number(
    (
      await c.query(
        "select coalesce(sum(points_cost),0)::text n from app.reward_entitlements where organization_id=$1 and plate=$2",
        [org.id, vehiclePlate],
      )
    ).rows[0].n,
  );
  let ordinal = Number(
    (
      await c.query(
        "select coalesce(max(ordinal),0)::int n from app.reward_entitlements where organization_id=$1 and plate=$2",
        [org.id, vehiclePlate],
      )
    ).rows[0].n,
  ),
    remaining = earned - used,
    created = 0;
  while (remaining >= org.reward_threshold_points && created < 100) {
    ordinal++;
    await c.query(
      "insert into app.reward_entitlements(organization_id,plate,ordinal,code,reward_name,points_cost,quantity_ml) values($1,$2,$3,$4,$5,$6,$7) on conflict(organization_id,plate,ordinal) do nothing",
      [
        org.id,
        vehiclePlate,
        "" + ordinal,
        "FPR1:" + randomBytes(24).toString("hex"),
        org.reward_name,
        org.reward_threshold_points,
        org.reward_quantity_ml,
      ],
    );
    remaining -= org.reward_threshold_points;
    created++;
  }
  return (
    await c.query(
      "select id,code,reward_name,points_cost,quantity_ml,created_at from app.reward_entitlements where organization_id=$1 and plate=$2 and redeemed_at is null order by created_at,id",
      [org.id, vehiclePlate],
    )
  ).rows;
}

export function customerRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    ["image/jpeg", "image/png", "image/webp"],
    { parseAs: "buffer", bodyLimit: 4 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );

  app.post("/api/customer/alpr", async (req) => {
    const ip = digest(req.ip);
    const ok = await tx(async (c) => limit(c, "cust-alpr:" + ip, 60));
    if (!ok) fail(429, "Too many scans; try again later");

    const image = req.body as Buffer;
    if (!Buffer.isBuffer(image) || image.length < 128) fail(400, "Invalid image");

    try {
      const result = await recognizeImage(image);
      const normalized = plate.safeParse(result.plate);
      if (!normalized.success) fail(422, "Plate format was unclear");
      return { ...result, plate: normalized.data, engine: "fast-alpr" };
    } catch (error) {
      fail(
        422,
        error instanceof Error ? error.message : "Plate recognition failed",
      );
    }
  });

  app.get("/api/payment-dashboard", async (req) => {
    const a = await actor(req);
    manage(a);
    return tx(
      async (c) =>
        (
          await c.query(
            "select coalesce(sum(amount_paise) filter(where payment_method='CASH'),0)::text cash,coalesce(sum(amount_paise) filter(where payment_method='UPI'),0)::text upi from app.transactions",
          )
        ).rows[0],
      a,
    );
  });

  app.get("/api/transactions-v2", async (req) => {
    const a = await actor(req),
      q = z
        .object({ offset: z.coerce.number().int().min(0).max(1000000).default(0) })
        .strict()
        .parse(req.query);
    return tx(
      async (c) =>
        (
          await c.query(
            "select id,plate,quantity_ml,amount_paise,payment_method,points,fraud,created_at from app.transactions order by created_at desc,id limit 100 offset $1",
            [q.offset],
          )
        ).rows,
      a,
    );
  });

  app.post("/api/reward-settings", async (req) => {
    const a = await actor(req);
    if (a.role !== "OWNER") fail(403, "Only the owner can change rewards");
    const b = z
      .object({
        reward_threshold_points: z.number().int().min(1).max(1000000),
        reward_name: z.string().trim().min(2).max(120),
        reward_quantity_ml: z.number().int().min(100).max(2000000),
      })
      .strict()
      .parse(req.body);
    return tx(async (c) => {
      await c.query(
        "update app.organizations set reward_threshold_points=$1,reward_name=$2,reward_quantity_ml=$3 where id=$4",
        [b.reward_threshold_points, b.reward_name, b.reward_quantity_ml, a.organization_id],
      );
      await audit(c, a, "rewards.changed");
      return { ok: true };
    }, a);
  });

  app.get("/api/vehicle-lookup", async (req) => {
    const a = await actor(req),
      q = z.object({ plate }).strict().parse(req.query);
    return tx(async (c) => {
      const org = (
        await c.query(
          "select id,reward_threshold_points,reward_name,reward_quantity_ml from app.organizations where id=$1",
          [a.organization_id],
        )
      ).rows[0] as RewardOrg,
        row = (
          await c.query(
            "select c.name,c.phone_e164 from app.customer_vehicles v join app.customers c on c.id=v.customer_id and c.organization_id=v.organization_id where v.plate=$1 and v.active and c.active",
            [q.plate],
          )
        ).rows[0],
        balance = (
          await c.query(
            "select coalesce(sum(points),0)::text balance from app.points_ledger where plate=$1",
            [q.plate],
          )
        ).rows[0].balance,
        last = (
          await c.query(
            "select created_at from app.transactions where plate=$1 order by created_at desc limit 1",
            [q.plate],
          )
        ).rows[0],
        rewards = await ensureRewards(c, org, q.plate);
      return {
        registered: !!row,
        plate: q.plate,
        ...(row ? { name: row.name, masked_phone: mask(row.phone_e164) } : {}),
        balance,
        last_visit: last?.created_at ?? null,
        rewards: rewards.map((r) => ({
          id: r.id,
          name: r.reward_name,
          quantity_ml: r.quantity_ml,
          created_at: r.created_at,
        })),
      };
    }, a);
  });

  app.get("/api/customers", async (req) => {
    const a = await actor(req);
    manage(a);
    return tx(
      async (c) =>
        (
          await c.query(
            "select c.id,c.name,c.phone_e164,c.active,coalesce(json_agg(json_build_object('id',v.id,'plate',v.plate,'label',v.label,'active',v.active) order by v.plate) filter(where v.id is not null),'[]') vehicles from app.customers c left join app.customer_vehicles v on v.customer_id=c.id and v.organization_id=c.organization_id group by c.id order by c.name",
          )
        ).rows,
      a,
    );
  });

  app.post("/api/customers", async (req) => {
    const a = await actor(req),
      b = customer.parse(req.body);
    return tx(async (c) => {
      const owner = (
        await c.query(
          "insert into app.customers(organization_id,name,phone_e164) values($1,$2,$3) returning id",
          [a.organization_id, b.name, b.phone_e164],
        )
      ).rows[0],
        vehicle = (
          await c.query(
            "insert into app.customer_vehicles(organization_id,customer_id,plate,label) values($1,$2,$3,$4) returning id",
            [a.organization_id, owner.id, b.plate, b.label ?? null],
          )
        ).rows[0];
      await audit(c, a, "customer.created", owner.id);
      return { id: owner.id, vehicle_id: vehicle.id };
    }, a);
  });

  app.post("/api/rewards/redeem", async (req) => {
    const a = await actor(req),
      b = z
        .object({ code: rewardCode, plate, pump_id: z.uuid(), fuel_id: z.uuid() })
        .strict()
        .parse(req.body);
    return tx(async (c) => {
      const valid = (
        await c.query(
          "select 1 from app.pump_fuels l join app.pumps p on p.id=l.pump_id and p.organization_id=l.organization_id where l.pump_id=$1 and l.fuel_id=$2 and p.active",
          [b.pump_id, b.fuel_id],
        )
      ).rowCount;
      if (!valid) fail(400, "Pump and fuel are not available");
      const r = (
        await c.query(
          "update app.reward_entitlements set redeemed_by=$1,redeemed_at=now(),pump_id=$2,fuel_id=$3 where code=$4 and plate=$5 and redeemed_at is null returning id,reward_name,quantity_ml",
          [a.id, b.pump_id, b.fuel_id, b.code, b.plate],
        )
      ).rows[0];
      if (!r) fail(409, "Reward invalid or already redeemed");
      await audit(c, a, "reward.redeemed", r.id);
      return r;
    }, a);
  });

  app.post("/api/rewards/redeem-by-plate", async (req) => {
    const a = await actor(req),
      b = z
        .object({ plate, pump_id: z.uuid(), fuel_id: z.uuid() })
        .strict()
        .parse(req.body);
    return tx(async (c) => {
      const valid = (
        await c.query(
          "select 1 from app.pump_fuels l join app.pumps p on p.id=l.pump_id and p.organization_id=l.organization_id where l.pump_id=$1 and l.fuel_id=$2 and p.active",
          [b.pump_id, b.fuel_id],
        )
      ).rowCount;
      if (!valid) fail(400, "Pump and fuel are not available");
      const r = (
        await c.query(
          `update app.reward_entitlements
             set redeemed_by = $1,
                 redeemed_at = now(),
                 pump_id     = $2,
                 fuel_id     = $3
           where id = (
             select id from app.reward_entitlements
              where organization_id = $4
                and plate           = $5
                and redeemed_at is null
              order by created_at, id
              limit 1
              for update skip locked
           )
           returning id, reward_name, quantity_ml`,
          [a.id, b.pump_id, b.fuel_id, a.organization_id, b.plate],
        )
      ).rows[0];
      if (!r) fail(409, "No unredeemed rewards found for this vehicle");
      await audit(c, a, "reward.redeemed.by_plate", r.id);
      return r;
    }, a);
  });

  app.post("/api/customer/identify", async (req) => {
    const b = lookup.parse(req.body),
      ip = digest(req.ip),
      result = await tx(async (c) => {
        if (!(await limit(c, "portal:" + ip, 120))) return null;
        const org = (
          await c.query(
            "select id,reward_threshold_points,reward_name,reward_quantity_ml from app.organizations where slug=$1",
            [b.station],
          )
        ).rows[0] as RewardOrg | undefined;
        if (!org) fail(404, "Station not found");
        const balance = Number(
          (
            await c.query(
              "select coalesce(sum(points),0)::text balance from app.points_ledger where organization_id=$1 and plate=$2",
              [org.id, b.plate],
            )
          ).rows[0].balance,
        ),
          history = (
            await c.query(
              "select id,quantity_ml,amount_paise,payment_method,points,fraud,created_at from app.transactions where organization_id=$1 and plate=$2 order by created_at desc limit 50",
              [org.id, b.plate],
            )
          ).rows,
          rewards = await ensureRewards(c, org, b.plate),
          reserved = Number(
            (
              await c.query(
                "select coalesce(sum(points_cost),0)::text n from app.reward_entitlements where organization_id=$1 and plate=$2",
                [org.id, b.plate],
              )
            ).rows[0].n,
          ),
          spendable = Math.max(0, balance - reserved);
        return {
          plate: b.plate,
          balance: String(spendable),
          lifetime_points: String(balance),
          history,
          reward: {
            name: org.reward_name,
            threshold_points: org.reward_threshold_points,
            quantity_ml: org.reward_quantity_ml,
            available: rewards,
            points_to_next: Math.max(0, org.reward_threshold_points - spendable),
          },
        };
      });
    if (!result) fail(429, "Too many lookups; try again later");
    return result;
  });
}
