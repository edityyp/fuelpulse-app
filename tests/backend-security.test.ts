import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.FUELPULSE_ALLOW_MOCK_DB = "true";

const { buildApp } = await import("../server/app.js");
const { mockDb } = await import("../server/mockDb.js");
const { digest } = await import("../server/crypto.js");
const { submit } = await import("../server/transactions.js");

const ORG = "00000000-0000-4000-8000-000000000001";
const OWNER = "00000000-0000-4000-8000-000000000010";
const MANAGER = "00000000-0000-4000-8000-000000000011";
const EMPLOYEE = "00000000-0000-4000-8000-000000000012";
const PUMP = "00000000-0000-4000-8000-000000000020";
const FUEL = "00000000-0000-4000-8000-000000000030";

let app: Awaited<ReturnType<typeof buildApp>>;

function sessionFor(userId: string) {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  mockDb.sessions.push({
    token_hash: digest(token),
    user_id: userId,
    expires_at: new Date(Date.now() + 3600000),
    created_at: new Date().toISOString(),
  });
  return token;
}

async function post(url: string, userId: string, payload: unknown) {
  return app.inject({
    method: "POST",
    url,
    cookies: { fp_session: sessionFor(userId) },
    payload,
  });
}

function addOtherOrgUser(role: "OWNER" | "MANAGER" | "EMPLOYEE" = "EMPLOYEE") {
  const id = randomUUID();
  mockDb.users.push({
    id,
    organization_id: "00000000-0000-4000-8000-000000000099",
    code: "OTHER_" + id.slice(0, 8),
    name: "Other Org User",
    role,
    active: true,
    created_at: new Date().toISOString(),
  });
  return id;
}

before(async () => {
  await mockDb.init();
  app = await buildApp();
});

after(async () => {
  await app.close();
});

test("staff update enforces role and tenant boundaries and revokes sessions", async () => {
  const employee = mockDb.users.find((u) => u.id === EMPLOYEE)!;
  const employeeSession = sessionFor(EMPLOYEE);

  const ownerUpdate = await post("/api/staff/" + EMPLOYEE, OWNER, {
    name: "Updated Employee",
    code: "EMP_UPDATED",
    active: false,
  });
  assert.equal(ownerUpdate.statusCode, 200);
  assert.equal(employee.name, "Updated Employee");
  assert.equal(employee.code, "EMP_UPDATED");
  assert.equal(employee.active, false);
  assert.equal(mockDb.sessions.some((s) => s.token_hash === digest(employeeSession)), false);

  const managerUpdate = await post("/api/staff/" + EMPLOYEE, MANAGER, {
    name: "Manager Updated Employee",
    code: "EMP_MANAGER",
    active: true,
  });
  assert.equal(managerUpdate.statusCode, 200);

  const ownerSelf = await post("/api/staff/" + OWNER, OWNER, { name: "Blocked Owner" });
  assert.equal(ownerSelf.statusCode, 404);

  const managerTarget = await post("/api/staff/" + MANAGER, MANAGER, { name: "Blocked Manager" });
  assert.equal(managerTarget.statusCode, 404);

  const employeeActor = await post("/api/staff/" + EMPLOYEE, EMPLOYEE, { name: "Blocked Employee" });
  assert.equal(employeeActor.statusCode, 403);

  const otherOrgUser = addOtherOrgUser();
  const crossTenant = await post("/api/staff/" + otherOrgUser, OWNER, { name: "Must Not Change" });
  assert.equal(crossTenant.statusCode, 404);
  assert.equal(mockDb.users.find((u) => u.id === otherOrgUser)?.name, "Other Org User");
});

test("coupon redemption records actor ID and rejects tenant, plate, and expiry violations", async () => {
  const code = "FP1:" + "a".repeat(48);
  mockDb.coupons.push({
    id: randomUUID(),
    organization_id: ORG,
    code,
    plate: "MH12AB1234",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_by: OWNER,
    redeemed_by: null,
    redeemed_at: null,
    created_at: new Date().toISOString(),
  });

  const redeemed = await post("/api/coupons/redeem", EMPLOYEE, { code, plate: "MH12 AB 1234" });
  assert.equal(redeemed.statusCode, 200);
  const coupon = mockDb.coupons.find((c) => c.code === code)!;
  assert.equal(coupon.redeemed_by, EMPLOYEE);
  assert.ok(coupon.redeemed_at);

  const wrongPlateCode = "FP1:" + "b".repeat(48);
  mockDb.coupons.push({
    id: randomUUID(), organization_id: ORG, code: wrongPlateCode, plate: "DL01CD5678",
    expires_at: new Date(Date.now() + 3600000).toISOString(), created_by: OWNER,
    redeemed_by: null, redeemed_at: null, created_at: new Date().toISOString(),
  });
  const wrongPlate = await post("/api/coupons/redeem", EMPLOYEE, { code: wrongPlateCode, plate: "MH12AB1234" });
  assert.equal(wrongPlate.statusCode, 409);

  const expiredCode = "FP1:" + "c".repeat(48);
  mockDb.coupons.push({
    id: randomUUID(), organization_id: ORG, code: expiredCode, plate: "MH12AB1234",
    expires_at: new Date(Date.now() - 1000).toISOString(), created_by: OWNER,
    redeemed_by: null, redeemed_at: null, created_at: new Date().toISOString(),
  });
  const expired = await post("/api/coupons/redeem", EMPLOYEE, { code: expiredCode, plate: "MH12AB1234" });
  assert.equal(expired.statusCode, 409);

  const otherOrgCode = "FP1:" + "d".repeat(48);
  mockDb.coupons.push({
    id: randomUUID(), organization_id: "00000000-0000-4000-8000-000000000099", code: otherOrgCode,
    plate: "MH12AB1234", expires_at: new Date(Date.now() + 3600000).toISOString(), created_by: OWNER,
    redeemed_by: null, redeemed_at: null, created_at: new Date().toISOString(),
  });
  const crossTenant = await post("/api/coupons/redeem", EMPLOYEE, { code: otherOrgCode, plate: "MH12AB1234" });
  assert.equal(crossTenant.statusCode, 409);
  assert.equal(mockDb.coupons.find((c) => c.code === otherOrgCode)?.redeemed_by, null);
});

test("coupon redemption is single-winner under concurrent requests", async () => {
  const code = "FP1:" + "e".repeat(48);
  mockDb.coupons.push({
    id: randomUUID(), organization_id: ORG, code, plate: "KA01AA7777",
    expires_at: new Date(Date.now() + 3600000).toISOString(), created_by: OWNER,
    redeemed_by: null, redeemed_at: null, created_at: new Date().toISOString(),
  });

  const results = await Promise.all([
    post("/api/coupons/redeem", EMPLOYEE, { code, plate: "KA01AA7777" }),
    post("/api/coupons/redeem", MANAGER, { code, plate: "KA01AA7777" }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(mockDb.coupons.find((c) => c.code === code)?.redeemed_at ? 1 : 0, 1);
});

test("transaction validation enforces tenant ownership, link ownership, and active pumps", async () => {
  const base = {
    idempotency_key: randomUUID(),
    plate: "MH12AB1234",
    payment_method: "CASH" as const,
    quantity_ml: 1000,
  };

  const valid = await submit(
    { id: EMPLOYEE, organization_id: ORG, name: "Employee", code: "EMP", role: "EMPLOYEE" },
    { ...base, pump_id: PUMP, fuel_id: FUEL },
  );
  assert.equal(valid.organization_id, ORG);
  assert.equal(valid.employee_id, EMPLOYEE);

  const otherOrg = "00000000-0000-4000-8000-000000000099";
  const otherPump = randomUUID();
  const otherFuel = randomUUID();
  mockDb.pumps.push({
    id: otherPump, organization_id: otherOrg, name: "Other Pump", active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  mockDb.fuels.push({ id: otherFuel, organization_id: otherOrg, name: "Other Fuel", price_paise: 10000 });
  mockDb.pumpFuels.push({ organization_id: otherOrg, pump_id: otherPump, fuel_id: otherFuel });

  await assert.rejects(
    submit(
      { id: EMPLOYEE, organization_id: ORG, name: "Employee", code: "EMP", role: "EMPLOYEE" },
      { ...base, idempotency_key: randomUUID(), pump_id: otherPump, fuel_id: otherFuel },
    ),
    /Fuel is unavailable at this pump/,
  );

  const foreignFuel = randomUUID();
  mockDb.fuels.push({ id: foreignFuel, organization_id: otherOrg, name: "Foreign Fuel", price_paise: 10000 });
  mockDb.pumpFuels.push({ organization_id: ORG, pump_id: PUMP, fuel_id: foreignFuel });
  await assert.rejects(
    submit(
      { id: EMPLOYEE, organization_id: ORG, name: "Employee", code: "EMP", role: "EMPLOYEE" },
      { ...base, idempotency_key: randomUUID(), pump_id: PUMP, fuel_id: foreignFuel },
    ),
    /Fuel is unavailable at this pump/,
  );

  const pump = mockDb.pumps.find((p) => p.id === PUMP)!;
  pump.active = false;
  await assert.rejects(
    submit(
      { id: EMPLOYEE, organization_id: ORG, name: "Employee", code: "EMP", role: "EMPLOYEE" },
      { ...base, idempotency_key: randomUUID(), pump_id: PUMP, fuel_id: FUEL },
    ),
    /Fuel is unavailable at this pump/,
  );
  pump.active = true;
});
