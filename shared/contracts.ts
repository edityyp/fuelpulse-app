import { z } from "zod";
export const plate = z
  .string()
  .max(40)
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{4,15}$/));
export const password = z.string().min(12).max(128);
export const paymentMethod = z.enum(["CASH", "UPI"]);
export const transaction = z
  .object({
    idempotency_key: z.string().uuid(),
    pump_id: z.string().uuid(),
    fuel_id: z.string().uuid(),
    plate,
    payment_method: paymentMethod.default("CASH"),
    quantity_ml: z.number().int().min(100).max(2000000).optional(),
    requested_amount_paise: z.number().int().min(100).max(100000000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.quantity_ml === undefined) ===
      (value.requested_amount_paise === undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "Provide either litres or amount, not both",
      });
  });
export const coupon = z.string().regex(/^FP1:[a-f0-9]{48}$/);
export const rewardCode = z.string().regex(/^FPR1:[a-f0-9]{48}$/);
export const login = z
  .object({
    station: z.string().regex(/^[a-z0-9-]{3,40}$/),
    code: z.string().min(3).max(40),
    password: z.string().min(1).max(128),
  })
  .strict();
export type Input = z.infer<typeof transaction>;
export type Actor = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
};
export type Pump = { id: string; name: string; active: boolean };
export type Fuel = { id: string; name: string; price_paise: number };
export type Catalog = {
  organization: {
    slug: string;
    name: string;
    points_per_litre: number;
    reward_threshold_points: number;
    reward_name: string;
    reward_quantity_ml: number;
  };
  pumps: Pump[];
  fuels: Fuel[];
  links: { pump_id: string; fuel_id: string }[];
};
export type Sale = {
  id: string;
  plate: string;
  quantity_ml: number;
  amount_paise: string;
  payment_method: "CASH" | "UPI";
  points: number;
  fraud: boolean;
  created_at: string;
};
