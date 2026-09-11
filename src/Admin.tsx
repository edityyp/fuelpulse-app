import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Users,
  Fuel,
  Tag,
  KeyRound,
  FileText,
  Camera,
  Plus,
} from "lucide-react";
import type { Actor, Catalog } from "../shared/contracts";
import { api, money, errorText } from "./api";
import { scan } from "./assist";
import { soundFx } from "./sound";

type Staff = {
  id: string;
  name: string;
  code: string;
  role: string;
  active: boolean;
};

type Coupon = {
  id: string;
  code: string;
  plate: string;
  expires_at: string;
  redeemed_at: string | null;
};

export function StaffScreen({
  user,
  notify,
}: {
  user: Actor;
  notify: (s: string) => void;
}) {
  const [rows, setRows] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [message, setMessage] = useState("");
  const resetPanel = useRef<HTMLDivElement>(null);

  const load = () => api<Staff[]>("/staff").then(setRows);

  useEffect(() => {
    load().catch((e) => notify(errorText(e)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    requestAnimationFrame(() =>
      resetPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [selected]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto p-3 sm:p-5 pb-28">
      {/* Staff Roster */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="font-display font-bold text-slate-900 text-base">
              Station Team Roster
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {rows.length} Staff
          </span>
        </div>

        <div className="space-y-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <strong className="font-display text-sm text-slate-900">
                  {s.name}
                </strong>
                <p className="text-xs text-slate-500 font-mono">
                  {s.role} • {s.code} •{" "}
                  <span
                    className={
                      s.active
                        ? "text-emerald-700 font-bold"
                        : "text-red-600 font-bold"
                    }
                  >
                    {s.active ? "Active" : "Disabled"}
                  </span>
                </p>
              </div>

              {s.role !== "OWNER" &&
                (user.role === "OWNER" || s.role === "EMPLOYEE") && (
                  <div className="flex items-center space-x-1.5 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playTap();
                        setSelected(s);
                        setMessage("");
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      Reset Pass
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        soundFx.playTap();
                        if (
                          !confirm(
                            `${s.active ? "Disable" : "Enable"} ${
                              s.name
                            }? Existing sessions will be revoked.`
                          )
                        )
                          return;
                        try {
                          await api("/staff/" + s.id, { active: !s.active });
                          await load();
                        } catch (e) {
                          notify(errorText(e));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        s.active
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {s.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      </section>

      {/* Add Staff */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Plus className="w-5 h-5 text-sky-600" />
          <h2 className="font-display font-bold text-slate-900 text-base">
            Provision New Staff
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Set up credentials for forecourt attendants or shift supervisors.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            soundFx.playTap();
            const form = e.currentTarget;
            const d = new FormData(form);
            const code = String(d.get("code") ?? "");
            try {
              if (
                rows.some(
                  (staff) => staff.code.toLowerCase() === code.toLowerCase()
                )
              ) {
                throw new Error(
                  "That staff code already exists. Choose a different code."
                );
              }
              await api("/staff", {
                name: d.get("name"),
                code,
                role: d.get("role"),
                password: d.get("password"),
                retrievable: false,
              });
              form.reset();
              await load();
              soundFx.playSuccess();
              notify("Staff account created successfully.");
            } catch (err) {
              notify(errorText(err));
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Full Name
            </label>
            <input
              name="name"
              minLength={2}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
              placeholder="e.g. Rahul Sharma"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Staff Code
              </label>
              <input
                name="code"
                pattern="[A-Za-z0-9_-]{3,40}"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                placeholder="e.g. staff-4"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Station Role
              </label>
              <select
                name="role"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 font-bold"
              >
                <option value="EMPLOYEE">Attendant (POS)</option>
                {user.role === "OWNER" && (
                  <option value="MANAGER">Shift Manager</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Initial Password
            </label>
            <input
              type="password"
              name="password"
              minLength={12}
              maxLength={128}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
              placeholder="Minimum 12 characters"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs active:scale-98 transition-all"
          >
            Create Staff Account
          </button>
        </form>
      </section>

      {/* Reset Password Modal/Panel */}
      {selected && (
        <div
          ref={resetPanel}
          className="md:col-span-2 bg-amber-50/80 rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-700" />
              <h2 className="font-display font-bold text-amber-950 text-base">
                Reset Password for {selected.name}
              </h2>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="px-2 py-0.5 rounded text-xs font-bold bg-white text-slate-600 border border-slate-200"
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              soundFx.playTap();
              const form = e.currentTarget;
              const d = new FormData(form);
              try {
                const result = await api<{ error?: string }>(
                  "/staff/" + selected.id + "/credential",
                  {
                    action: "change",
                    current: d.get("current"),
                    next: d.get("next"),
                  }
                );
                if (result.error) throw new Error(result.error);
                form.reset();
                soundFx.playSuccess();
                setMessage(
                  `Password reset for ${selected.name}. Existing sessions revoked.`
                );
              } catch (err) {
                notify(errorText(err));
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div>
              <label className="text-xs font-bold text-amber-900 block mb-1">
                Your Admin Password
              </label>
              <input
                type="password"
                name="current"
                required
                minLength={12}
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-amber-900 block mb-1">
                New Staff Password
              </label>
              <input
                type="password"
                name="next"
                required
                minLength={12}
                maxLength={128}
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white"
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between">
              {message && (
                <span className="text-xs text-emerald-800 font-bold">
                  {message}
                </span>
              )}
              <button
                type="submit"
                className="ml-auto px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm Reset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function PumpsScreen({
  catalog,
  refresh,
  notify,
}: {
  catalog: Catalog;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto p-3 sm:p-5 pb-28">
      {/* Pumps & Islands */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Fuel className="w-5 h-5 text-sky-600" />
          <h2 className="font-display font-bold text-slate-900 text-base">
            Dispenser Island Configuration
          </h2>
        </div>

        <div className="space-y-2">
          {catalog.pumps.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between"
            >
              <div>
                <strong className="font-display text-sm text-slate-900">
                  {p.name}
                </strong>
                <span
                  className={`ml-2 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    p.active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {p.active ? "Online" : "Deactivated"}
                </span>
              </div>
              <button
                onClick={async () => {
                  soundFx.playTap();
                  try {
                    await api("/pumps/" + p.id, { active: !p.active });
                    await refresh();
                    soundFx.playSuccess();
                  } catch (e) {
                    notify(errorText(e));
                  }
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
              >
                {p.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>

        {/* Add Pump Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            soundFx.playTap();
            const d = new FormData(e.currentTarget);
            try {
              await api("/pumps", {
                name: d.get("name"),
                fuel_ids: d.getAll("fuels"),
              });
              await refresh();
              soundFx.playSuccess();
              notify("New pump island created");
            } catch (err) {
              notify(errorText(err));
            }
          }}
          className="pt-2 border-t border-slate-100 space-y-2.5"
        >
          <span className="text-xs font-bold text-slate-700 block">
            Add New Dispenser Island
          </span>
          <input
            name="name"
            maxLength={60}
            required
            placeholder="e.g. Pump 05 (High Flow)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/50"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {catalog.fuels.map((f) => (
              <label
                key={f.id}
                className="flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer"
              >
                <input type="checkbox" name="fuels" value={f.id} />
                <span className="font-semibold text-slate-700">{f.name}</span>
              </label>
            ))}
          </div>
          <button className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">
            Add Dispenser Island
          </button>
        </form>
      </section>

      {/* Fuel Pricing */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Tag className="w-5 h-5 text-emerald-600" />
          <h2 className="font-display font-bold text-slate-900 text-base">
            Forecourt Fuel Price Board
          </h2>
        </div>

        <div className="space-y-2">
          {catalog.fuels.map((f) => (
            <div
              key={f.id}
              className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between"
            >
              <span className="font-bold text-xs text-slate-800">{f.name}</span>
              <strong className="font-mono text-emerald-700 text-sm font-black">
                {money(f.price_paise)} / L
              </strong>
            </div>
          ))}
        </div>

        {/* Set Fuel Price Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            soundFx.playTap();
            const d = new FormData(e.currentTarget);
            try {
              await api("/fuels", {
                name: d.get("name"),
                price_paise: Math.round(Number(d.get("price")) * 100),
              });
              await refresh();
              soundFx.playSuccess();
              notify("Fuel price calibrated");
            } catch (err) {
              notify(errorText(err));
            }
          }}
          className="pt-2 border-t border-slate-100 space-y-2.5"
        >
          <span className="text-xs font-bold text-slate-700 block">
            Update or Calibrate Rate
          </span>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="name"
              required
              placeholder="Fuel Name (e.g. Power Petrol)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/50"
            />
            <input
              name="price"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              required
              placeholder="₹/L (e.g. 104.50)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/50 font-mono"
            />
          </div>
          <button className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs">
            Set Fuel Price
          </button>
        </form>
      </section>
    </div>
  );
}

export function CouponsScreen({
  manager,
  notify,
}: {
  manager: boolean;
  notify: (s: string) => void;
}) {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<(() => void) | undefined>(undefined);

  const load = () =>
    manager ? api<Coupon[]>("/coupons").then(setRows) : Promise.resolve();

  useEffect(() => {
    load().catch((e) => notify(errorText(e)));
    return () => stop.current?.();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto p-3 sm:p-5 pb-28">
      {/* Redeem Coupon */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Tag className="w-5 h-5 text-amber-600" />
          <h2 className="font-display font-bold text-slate-900 text-base">
            Redeem Driver Coupon
          </h2>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            soundFx.playTap();
            const d = new FormData(e.currentTarget);
            try {
              await api("/coupons/redeem", { code, plate: d.get("plate") });
              soundFx.playSuccess();
              notify("Coupon redeemed successfully");
              setCode("");
              await load();
            } catch (err) {
              notify(errorText(err));
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Coupon Code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="FP1:..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono bg-slate-50/50"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Vehicle Plate Number
            </label>
            <input
              name="plate"
              required
              placeholder="MH12DE1432"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono bg-slate-50/50 uppercase"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  stop.current?.();
                  if (video.current) {
                    const c = await scan(video.current, setCode);
                    stop.current = () => c.stop();
                  }
                } catch (e) {
                  notify(errorText(e));
                }
              }}
              className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 flex items-center justify-center space-x-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan QR Camera</span>
            </button>
            <button
              type="button"
              onClick={() => stop.current?.()}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold border border-slate-200"
            >
              Stop
            </button>
          </div>

          <video ref={video} muted playsInline className="w-full rounded-xl bg-black aspect-video object-cover" />

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-98 transition-all"
          >
            Redeem Coupon Once
          </button>
        </form>
      </section>

      {/* Issue Coupon (Manager) */}
      {manager && (
        <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h2 className="font-display font-bold text-slate-900 text-base">
              Issue Promotional Coupon
            </h2>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              soundFx.playTap();
              const d = new FormData(e.currentTarget);
              try {
                const c = await api<Coupon>("/coupons", {
                  plate: d.get("plate"),
                  days: Number(d.get("days")),
                });
                setQr(await QRCode.toDataURL(c.code, { width: 240 }));
                soundFx.playSuccess();
                await load();
              } catch (err) {
                notify(errorText(err));
              }
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Vehicle Plate
                </label>
                <input
                  name="plate"
                  required
                  placeholder="MH12DE1432"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase bg-slate-50/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Validity (days)
                </label>
                <input
                  name="days"
                  type="number"
                  min="1"
                  max="90"
                  defaultValue="7"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/50 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs"
            >
              Generate Coupon & QR
            </button>
          </form>

          {qr && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center">
              <img src={qr} alt="Coupon QR" className="w-32 h-32 rounded-lg" />
              <span className="text-[10px] text-slate-500 font-mono mt-1">
                Scan at pump to redeem
              </span>
            </div>
          )}

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {rows.map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900">
                    {c.plate}
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">
                    {c.code}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                    c.redeemed_at
                      ? "bg-slate-200 text-slate-600"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {c.redeemed_at ? "Redeemed" : "Available"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function AuditScreen() {
  const [rows, setRows] = useState<{ action: string; created_at: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<typeof rows>("/audit")
      .then(setRows)
      .catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-5 pb-28">
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <FileText className="w-5 h-5 text-slate-700" />
          <h2 className="font-display font-bold text-slate-900 text-base">
            System Security & Audit Trail
          </h2>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div
              key={i}
              className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg"
            >
              <strong className="text-slate-800 font-mono">{r.action}</strong>
              <span className="text-slate-400 font-mono text-[11px]">
                {new Date(r.created_at).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
