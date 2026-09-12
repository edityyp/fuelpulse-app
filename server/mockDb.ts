import { randomUUID } from "node:crypto";
import { hashPassword } from "./crypto.js";

interface MockOrg {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  points_per_litre: number;
  reward_threshold_points: number;
  reward_name: string;
  reward_quantity_ml: number;
  created_at: string;
}

interface MockUser {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  active: boolean;
  created_at: string;
}

interface MockCredential {
  user_id: string;
  password_hash: string;
  encrypted_password: string | null;
  updated_at: string;
}

interface MockSession {
  token_hash: string;
  user_id: string;
  expires_at: Date;
  created_at: string;
}

interface MockPump {
  id: string;
  organization_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface MockFuel {
  id: string;
  organization_id: string;
  name: string;
  price_paise: number;
}

interface MockTransaction {
  id: string;
  organization_id: string;
  pump_id: string;
  employee_id: string;
  fuel_id: string;
  plate: string;
  quantity_ml: number;
  price_paise: number;
  amount_paise: number;
  payment_method: string;
  points: number;
  fraud: boolean;
  business_day: string;
  idempotency_key: string;
  request_hash: string;
  created_at: string;
}

interface MockPointEntry {
  id: string;
  organization_id: string;
  plate: string;
  transaction_id: string;
  points: number;
  created_at: string;
}

interface MockCoupon {
  id: string;
  organization_id: string;
  code: string;
  plate: string;
  expires_at: string;
  created_by: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface MockAuditLog {
  id: number;
  organization_id: string;
  actor_id: string;
  action: string;
  target_id: string | null;
  created_at: string;
}

interface MockCustomer {
  id: string;
  organization_id: string;
  name: string;
  phone_e164: string;
  active: boolean;
  created_at: string;
}

interface MockCustomerVehicle {
  id: string;
  organization_id: string;
  customer_id: string;
  plate: string;
  label?: string;
  active: boolean;
  created_at: string;
}

interface MockCustomerSession {
  token_hash: string;
  organization_id: string;
  customer_id: string;
  trusted_until: string;
  last_used_at: string;
  created_at: string;
}

interface MockRewardEntitlement {
  id: string;
  organization_id: string;
  plate: string;
  code: string;
  reward_name: string;
  points_cost: number;
  quantity_ml: number;
  redeemed_at: string | null;
  redeemed_by: string | null;
  expires_at: string;
  created_at: string;
}

class MockDatabase {
  initialized = false;
  org: MockOrg = {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "local-qa",
    name: "FuelPulse · Station 01",
    timezone: "Asia/Kolkata",
    points_per_litre: 1,
    reward_threshold_points: 100,
    reward_name: "1 Litre Free Fuel",
    reward_quantity_ml: 1000,
    created_at: new Date().toISOString(),
  };

  users: MockUser[] = [
    {
      id: "00000000-0000-4000-8000-000000000010",
      organization_id: "00000000-0000-4000-8000-000000000001",
      code: "OWNER",
      name: "Station Owner",
      role: "OWNER",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000011",
      organization_id: "00000000-0000-4000-8000-000000000001",
      code: "MANAGER",
      name: "Shift Manager",
      role: "MANAGER",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000012",
      organization_id: "00000000-0000-4000-8000-000000000001",
      code: "EMPLOYEE",
      name: "Forecourt Staff",
      role: "EMPLOYEE",
      active: true,
      created_at: new Date().toISOString(),
    },
  ];

  credentials: MockCredential[] = [];
  sessions: MockSession[] = [];
  loginLimits = new Map<string, { attempts: number; until_at: number }>();

  pumps: MockPump[] = [
    {
      id: "00000000-0000-4000-8000-000000000020",
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Pump 01",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000021",
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Pump 02",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  fuels: MockFuel[] = [
    {
      id: "00000000-0000-4000-8000-000000000030",
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Petrol",
      price_paise: 10450,
    },
    {
      id: "00000000-0000-4000-8000-000000000031",
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Diesel",
      price_paise: 9200,
    },
  ];

  pumpFuels = [
    { organization_id: "00000000-0000-4000-8000-000000000001", pump_id: "00000000-0000-4000-8000-000000000020", fuel_id: "00000000-0000-4000-8000-000000000030" },
    { organization_id: "00000000-0000-4000-8000-000000000001", pump_id: "00000000-0000-4000-8000-000000000020", fuel_id: "00000000-0000-4000-8000-000000000031" },
    { organization_id: "00000000-0000-4000-8000-000000000001", pump_id: "00000000-0000-4000-8000-000000000021", fuel_id: "00000000-0000-4000-8000-000000000030" },
    { organization_id: "00000000-0000-4000-8000-000000000001", pump_id: "00000000-0000-4000-8000-000000000021", fuel_id: "00000000-0000-4000-8000-000000000031" },
  ];

  transactions: MockTransaction[] = [
    {
      id: "00000000-0000-4000-8000-000000000101",
      organization_id: "00000000-0000-4000-8000-000000000001",
      pump_id: "00000000-0000-4000-8000-000000000020",
      employee_id: "00000000-0000-4000-8000-000000000012",
      fuel_id: "00000000-0000-4000-8000-000000000030",
      plate: "MH12AB1234",
      quantity_ml: 10000,
      price_paise: 10450,
      amount_paise: 104500,
      payment_method: "UPI",
      points: 10,
      fraud: false,
      business_day: new Date().toISOString().split("T")[0],
      idempotency_key: "00000000-0000-4000-8000-000000000201",
      request_hash: "hash1",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      organization_id: "00000000-0000-4000-8000-000000000001",
      pump_id: "00000000-0000-4000-8000-000000000021",
      employee_id: "00000000-0000-4000-8000-000000000012",
      fuel_id: "00000000-0000-4000-8000-000000000031",
      plate: "DL01CD5678",
      quantity_ml: 20000,
      price_paise: 9200,
      amount_paise: 184000,
      payment_method: "CASH",
      points: 20,
      fraud: false,
      business_day: new Date().toISOString().split("T")[0],
      idempotency_key: "00000000-0000-4000-8000-000000000202",
      request_hash: "hash2",
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  pointsLedger: MockPointEntry[] = [
    {
      id: "00000000-0000-4000-8000-000000000301",
      organization_id: "00000000-0000-4000-8000-000000000001",
      plate: "MH12AB1234",
      transaction_id: "00000000-0000-4000-8000-000000000101",
      points: 10,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000302",
      organization_id: "00000000-0000-4000-8000-000000000001",
      plate: "DL01CD5678",
      transaction_id: "00000000-0000-4000-8000-000000000102",
      points: 20,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  coupons: MockCoupon[] = [];
  auditLogs: MockAuditLog[] = [];
  customers: MockCustomer[] = [
    {
      id: "00000000-0000-4000-8000-000000000401",
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Aditi Rao",
      phone_e164: "+919876543210",
      active: true,
      created_at: new Date().toISOString(),
    },
  ];
  customerVehicles: MockCustomerVehicle[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      organization_id: "00000000-0000-4000-8000-000000000001",
      customer_id: "00000000-0000-4000-8000-000000000401",
      plate: "MH12AB1234",
      label: "Honda City",
      active: true,
      created_at: new Date().toISOString(),
    },
  ];
  customerSessions: MockCustomerSession[] = [];
  rewardEntitlements: MockRewardEntitlement[] = [];

  async init() {
    if (this.initialized) return;
    try {
      const defaultHash = await hashPassword("password12345");
      for (const u of this.users) {
        this.credentials.push({
          user_id: u.id,
          password_hash: defaultHash,
          encrypted_password: null,
          updated_at: new Date().toISOString(),
        });
      }
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  async executeQuery(sqlText: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    await this.init();
    const sql = sqlText.trim().replace(/\s+/g, " ");

    // Health check / Ping
    if (/^select 1\b/i.test(sql)) {
      return { rows: [{ "?column?": 1 }], rowCount: 1 };
    }

    // Transaction & Session settings
    if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|select set_config)/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    if (/select pg_advisory_xact_lock/i.test(sql)) {
      return { rows: [{ pg_advisory_xact_lock: true }], rowCount: 1 };
    }

    // Login Limits
    if (/insert into app\.login_limits/i.test(sql)) {
      return { rows: [{ attempts: 1 }], rowCount: 1 };
    }
    if (/delete from app\.login_limits/i.test(sql)) {
      return { rows: [], rowCount: 1 };
    }

    // Login Events
    if (/insert into app\.login_events/i.test(sql)) {
      return { rows: [], rowCount: 1 };
    }

    // Select User for Login: where o.slug=$1 and u.code=$2
    if (/from app\.users u join app\.organizations o.*where o\.slug=\$1 and u\.code=\$2/i.test(sql)) {
      const slug = String(params[0] ?? "").toLowerCase();
      const code = String(params[1] ?? "").toUpperCase();
      // Match station by slug or allow default QA station
      const user = this.users.find(
        (u) =>
          u.code.toUpperCase() === code &&
          (this.org.slug.toLowerCase() === slug ||
            slug === "demo" ||
            slug === "station-01" ||
            slug === "fuelpulse-main" ||
            !slug)
      );
      if (user) {
        const cred = this.credentials.find((c) => c.user_id === user.id);
        return {
          rows: [
            {
              ...user,
              password_hash: cred?.password_hash ?? "",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // Store Session
    if (/insert into app\.sessions\(token_hash,user_id,expires_at\)/i.test(sql)) {
      const token_hash = String(params[0]);
      const user_id = String(params[1]);
      const hours = Number(params[2] ?? 8);
      const expires_at = new Date(Date.now() + hours * 3600000);
      this.sessions = this.sessions.filter((s) => s.token_hash !== token_hash);
      this.sessions.push({ token_hash, user_id, expires_at, created_at: new Date().toISOString() });
      return { rows: [], rowCount: 1 };
    }

    // Lookup Session / Actor: where s.token_hash=$1
    if (/from app\.sessions s join app\.users u.*where s\.token_hash=\$1/i.test(sql)) {
      const token_hash = String(params[0]);
      const session = this.sessions.find((s) => s.token_hash === token_hash && s.expires_at > new Date());
      if (session) {
        const user = this.users.find((u) => u.id === session.user_id && u.active);
        if (user) {
          return {
            rows: [
              {
                id: user.id,
                organization_id: user.organization_id,
                name: user.name,
                code: user.code,
                role: user.role,
              },
            ],
            rowCount: 1,
          };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Delete Session (Logout)
    if (/delete from app\.sessions where token_hash=\$1/i.test(sql)) {
      const token_hash = String(params[0]);
      this.sessions = this.sessions.filter((s) => s.token_hash !== token_hash);
      return { rows: [], rowCount: 1 };
    }

    // Select Organizations
    if (/select \* from app\.organizations\b/i.test(sql)) {
      return { rows: [{ ...this.org }], rowCount: 1 };
    }
    if (/from app\.organizations where slug=\$1/i.test(sql)) {
      return { rows: [{ ...this.org }], rowCount: 1 };
    }
    if (/select \(now\(\) at time zone timezone\)::date d,points_per_litre from app\.organizations/i.test(sql)) {
      return {
        rows: [{ d: new Date().toISOString().split("T")[0], points_per_litre: this.org.points_per_litre }],
        rowCount: 1,
      };
    }
    if (/update app\.organizations set points_per_litre=\$1 where id=\$2/i.test(sql)) {
      this.org.points_per_litre = Number(params[0]);
      return { rows: [], rowCount: 1 };
    }

    // Pumps & Fuels
    if (/select \* from app\.pumps order by name/i.test(sql)) {
      return { rows: [...this.pumps].sort((a, b) => a.name.localeCompare(b.name)), rowCount: this.pumps.length };
    }
    if (/select \* from app\.fuels order by name/i.test(sql)) {
      return { rows: [...this.fuels].sort((a, b) => a.name.localeCompare(b.name)), rowCount: this.fuels.length };
    }
    if (/select pump_id,fuel_id from app\.pump_fuels/i.test(sql)) {
      return { rows: [...this.pumpFuels], rowCount: this.pumpFuels.length };
    }
    if (/select f\.price_paise from app\.fuels f join app\.pump_fuels pf.*where f\.id=\$2/i.test(sql)) {
      const fuelId = String(params[1]);
      const fuel = this.fuels.find((f) => f.id === fuelId);
      return { rows: fuel ? [{ price_paise: fuel.price_paise }] : [], rowCount: fuel ? 1 : 0 };
    }

    // Add / Update Pump
    if (/insert into app\.pumps\(organization_id,name\) values\(\$1,\$2\) returning id/i.test(sql)) {
      const id = randomUUID();
      const name = String(params[1]);
      const pump: MockPump = {
        id,
        organization_id: this.org.id,
        name,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.pumps.push(pump);
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/insert into app\.pump_fuels values\(\$1,\$2,\$3\)/i.test(sql)) {
      this.pumpFuels.push({
        organization_id: String(params[0]),
        pump_id: String(params[1]),
        fuel_id: String(params[2]),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/update app\.pumps set active=\$1,updated_at=now\(\) where id=\$2 returning id/i.test(sql)) {
      const active = Boolean(params[0]);
      const id = String(params[1]);
      const p = this.pumps.find((pump) => pump.id === id);
      if (p) p.active = active;
      return { rows: p ? [{ id }] : [], rowCount: p ? 1 : 0 };
    }

    // Add / Update Fuels
    if (/insert into app\.fuels\(organization_id,name,price_paise\) values\(\$1,\$2,\$3\)/i.test(sql)) {
      const name = String(params[1]);
      const price_paise = Number(params[2]);
      let f = this.fuels.find((fuel) => fuel.name.toLowerCase() === name.toLowerCase());
      if (f) {
        f.price_paise = price_paise;
      } else {
        f = { id: randomUUID(), organization_id: this.org.id, name, price_paise };
        this.fuels.push(f);
      }
      return { rows: [{ id: f.id }], rowCount: 1 };
    }

    // Transactions
    if (/from app\.transactions where organization_id=\$1 and idempotency_key=\$2/i.test(sql)) {
      const key = String(params[1]);
      const existing = this.transactions.find((t) => t.idempotency_key === key);
      return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 };
    }
    if (/select count\(\*\)::int n from app\.transactions where pump_id=\$1 and plate=\$2 and business_day=\$3/i.test(sql)) {
      const pumpId = String(params[0]);
      const plate = String(params[1]);
      const count = this.transactions.filter((t) => t.pump_id === pumpId && t.plate === plate).length;
      return { rows: [{ n: count }], rowCount: 1 };
    }
    if (/insert into app\.transactions\(.*\) values\(.*\) returning \*/i.test(sql)) {
      const [
        organization_id,
        pump_id,
        fuel_id,
        employee_id,
        plate,
        quantity_ml,
        price_paise,
        amount_paise,
        payment_method,
        points,
        fraud,
        business_day,
        idempotency_key,
        request_hash,
      ] = params;
      const txRow: MockTransaction = {
        id: randomUUID(),
        organization_id: String(organization_id),
        pump_id: String(pump_id),
        fuel_id: String(fuel_id),
        employee_id: String(employee_id),
        plate: String(plate),
        quantity_ml: Number(quantity_ml),
        price_paise: Number(price_paise),
        amount_paise: Number(amount_paise),
        payment_method: String(payment_method),
        points: Number(points),
        fraud: Boolean(fraud),
        business_day: String(business_day),
        idempotency_key: String(idempotency_key),
        request_hash: String(request_hash),
        created_at: new Date().toISOString(),
      };
      this.transactions.unshift(txRow);
      return { rows: [txRow as unknown as Record<string, unknown>], rowCount: 1 };
    }
    if (/from app\.transactions order by created_at desc.*limit/i.test(sql)) {
      const offset = Number(params[0] ?? 0);
      const rows = this.transactions.slice(offset, offset + 100) as unknown as Record<string, unknown>[];
      return { rows, rowCount: rows.length };
    }

    // Points Ledger
    if (/insert into app\.points_ledger\(organization_id,plate,transaction_id,points\) values\(\$1,\$2,\$3,\$4\)/i.test(sql)) {
      const [organization_id, plate, transaction_id, points] = params;
      this.pointsLedger.push({
        id: randomUUID(),
        organization_id: String(organization_id),
        plate: String(plate),
        transaction_id: String(transaction_id),
        points: Number(points),
        created_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/select coalesce\(sum\(points\),0\)::text balance from app\.points_ledger where plate=\$1/i.test(sql)) {
      const plate = String(params[0]);
      const sum = this.pointsLedger.filter((p) => p.plate === plate).reduce((a, b) => a + b.points, 0);
      return { rows: [{ balance: String(sum) }], rowCount: 1 };
    }
    if (/select transaction_id,points,created_at from app\.points_ledger where plate=\$1/i.test(sql)) {
      const plate = String(params[0]);
      const rows = this.pointsLedger.filter((p) => p.plate === plate).slice(0, 100);
      return { rows, rowCount: rows.length };
    }

    // Dashboard Metrics
    if (/select count\(\*\)::int transactions,coalesce\(sum\(amount_paise\),0\)::text revenue/i.test(sql)) {
      const totalAmount = this.transactions.reduce((acc, t) => acc + t.amount_paise, 0);
      const totalVolume = this.transactions.reduce((acc, t) => acc + t.quantity_ml, 0);
      const totalPoints = this.transactions.reduce((acc, t) => acc + t.points, 0);
      const fraudCount = this.transactions.filter((t) => t.fraud).length;
      return {
        rows: [
          {
            transactions: this.transactions.length,
            revenue: String(totalAmount),
            volume: String(totalVolume),
            fraud: fraudCount,
            points: String(totalPoints),
            today: this.transactions.length,
          },
        ],
        rowCount: 1,
      };
    }
    if (/select count\(\*\)::int n from app\.users where active and role='EMPLOYEE'/i.test(sql)) {
      const count = this.users.filter((u) => u.active && u.role === "EMPLOYEE").length;
      return { rows: [{ n: count }], rowCount: 1 };
    }
    if (/select count\(\*\)::int n from app\.pumps where active/i.test(sql)) {
      const count = this.pumps.filter((p) => p.active).length;
      return { rows: [{ n: count }], rowCount: 1 };
    }
    if (/select count\(\*\)::int n from app\.coupons where redeemed_at is null/i.test(sql)) {
      const count = this.coupons.filter((c) => !c.redeemed_at).length;
      return { rows: [{ n: count }], rowCount: 1 };
    }

    // Staff List
    if (/select id,name,code,role,active from app\.users order by name/i.test(sql)) {
      return { rows: [...this.users].sort((a, b) => a.name.localeCompare(b.name)), rowCount: this.users.length };
    }
    if (/insert into app\.users\(organization_id,name,code,role\) values\(\$1,\$2,\$3,\$4\) returning id/i.test(sql)) {
      const id = randomUUID();
      const roleParam = String(params[3] ?? "EMPLOYEE");
      const role: "OWNER" | "MANAGER" | "EMPLOYEE" =
        roleParam === "OWNER" || roleParam === "MANAGER" ? roleParam : "EMPLOYEE";
      const u: MockUser = {
        id,
        organization_id: this.org.id,
        name: String(params[1]),
        code: String(params[2]),
        role,
        active: true,
        created_at: new Date().toISOString(),
      };
      this.users.push(u);
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/insert into app\.credentials\(user_id,password_hash,encrypted_password\) values\(\$1,\$2,\$3\)/i.test(sql)) {
      this.credentials.push({
        user_id: String(params[0]),
        password_hash: String(params[1]),
        encrypted_password: params[2] ? String(params[2]) : null,
        updated_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/update app\.users set active=/i.test(sql)) {
      const id = String(params[3]);
      const u = this.users.find((user) => user.id === id);
      if (u) {
        if (params[0] !== undefined) u.active = Boolean(params[0]);
        if (params[1]) u.name = String(params[1]);
        if (params[2]) u.code = String(params[2]);
      }
      return { rows: u ? [{ id }] : [], rowCount: u ? 1 : 0 };
    }

    // Coupons
    if (/select \* from app\.coupons order by created_at desc/i.test(sql)) {
      return { rows: [...this.coupons], rowCount: this.coupons.length };
    }
    if (/insert into app\.coupons\(organization_id,code,plate,expires_at,created_by\) values/i.test(sql)) {
      const coupon: MockCoupon = {
        id: randomUUID(),
        organization_id: String(params[0]),
        code: String(params[1]),
        plate: String(params[2]),
        expires_at: new Date(Date.now() + Number(params[3] ?? 7) * 86400000).toISOString(),
        created_by: String(params[4]),
        redeemed_by: null,
        redeemed_at: null,
        created_at: new Date().toISOString(),
      };
      this.coupons.unshift(coupon);
      return { rows: [coupon], rowCount: 1 };
    }
    if (/update app\.coupons set redeemed_by=\$1,redeemed_at=now\(\) where code=\$2 and plate=\$3/i.test(sql)) {
      const redeemed_by = String(params[0]);
      const code = String(params[1]);
      const plate = String(params[2]);
      const c = this.coupons.find((coup) => coup.code === code && coup.plate === plate && !coup.redeemed_at);
      if (c) {
        c.redeemed_by = redeemed_by;
        c.redeemed_at = new Date().toISOString();
        return { rows: [{ id: c.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Audit Logs
    if (/insert into app\.audit_logs/i.test(sql)) {
      this.auditLogs.push({
        id: this.auditLogs.length + 1,
        organization_id: String(params[0]),
        actor_id: String(params[1]),
        action: String(params[2]),
        target_id: params[3] ? String(params[3]) : null,
        created_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/select action,target_id,created_at from app\.audit_logs order by created_at desc/i.test(sql)) {
      const rows = [...this.auditLogs].reverse().slice(0, 100);
      return { rows, rowCount: rows.length };
    }

    // Customer & Vehicles (Portal)
    if (/from app\.customers c join app\.customer_vehicles cv.*where c\.organization_id=\$1 and cv\.plate=\$2/i.test(sql)) {
      const plate = String(params[1]);
      const v = this.customerVehicles.find((veh) => veh.plate === plate && veh.active);
      if (v) {
        const c = this.customers.find((cust) => cust.id === v.customer_id && cust.active);
        if (c) {
          return { rows: [{ ...c, plate: v.plate }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }
    if (/from app\.customers where organization_id=\$1 and phone_e164=\$2/i.test(sql)) {
      const phone = String(params[1]);
      const c = this.customers.find((cust) => cust.phone_e164 === phone);
      return { rows: c ? [c] : [], rowCount: c ? 1 : 0 };
    }
    if (/insert into app\.customers/i.test(sql)) {
      const id = randomUUID();
      const c: MockCustomer = {
        id,
        organization_id: this.org.id,
        name: String(params[1]),
        phone_e164: String(params[2]),
        active: true,
        created_at: new Date().toISOString(),
      };
      this.customers.push(c);
      return { rows: [c], rowCount: 1 };
    }
    if (/insert into app\.customer_vehicles/i.test(sql)) {
      const id = randomUUID();
      const cv: MockCustomerVehicle = {
        id,
        organization_id: this.org.id,
        customer_id: String(params[1]),
        plate: String(params[2]),
        label: params[3] ? String(params[3]) : undefined,
        active: true,
        created_at: new Date().toISOString(),
      };
      this.customerVehicles.push(cv);
      return { rows: [cv], rowCount: 1 };
    }
    if (/from app\.customer_sessions/i.test(sql)) {
      const hash = String(params[0]);
      const sess = this.customerSessions.find((s) => s.token_hash === hash);
      return { rows: sess ? [sess] : [], rowCount: sess ? 1 : 0 };
    }

    // Default fallback: empty result
    return { rows: [], rowCount: 0 };
  }
}

export const mockDb = new MockDatabase();
