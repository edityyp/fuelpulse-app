import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Actor, Catalog, Sale, Input } from "../shared/contracts";
import { api, errorText, money } from "./api";
import { enqueue, pending, sync, type Pending } from "./offline";
import { ElevatedHeader } from "./components/ElevatedHeader";
import { ForecourtBottomNav } from "./components/ForecourtBottomNav";
import { ForecourtPosView } from "./components/ForecourtPosView";
import { ForecourtRewardsView } from "./components/ForecourtRewardsView";
import { ForecourtStationTelemetry } from "./components/ForecourtStationTelemetry";
import { ForecourtAboutView } from "./components/ForecourtAboutView";
import { RoleSelectModal } from "./components/RoleSelectModal";
import { StaffScreen, PumpsScreen, CouponsScreen, AuditScreen } from "./Admin";
import { soundFx } from "./sound";
import "./style.css";

type Metrics = {
  metrics: {
    transactions: number;
    revenue: string;
    volume: string;
    cash: string;
    upi: string;
    points: string;
    fraud: number;
    today: number;
  };
  staff: number;
  pumps: number;
  coupons: number;
};

function App() {
  const [user, setUser] = useState<Actor | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pos");
  const [adminSubTab, setAdminSubTab] = useState<"staff" | "pumps" | "coupons" | "audit">("staff");
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [notice, setNotice] = useState<string>("");
  const [items, setItems] = useState<Pending[]>([]);
  const [rows, setRows] = useState<Sale[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  // Load catalog & station data
  async function loadData(actor?: Actor) {
    try {
      const [c, r] = await Promise.all([
        api<Catalog>("/catalog").catch(() => null),
        api<Sale[]>("/transactions-v2").catch(() => []),
      ]);
      if (c) setCatalog(c);
      if (r) setRows(r);

      const targetActor = actor || user;
      if (targetActor && targetActor.role !== "EMPLOYEE") {
        const [d, p] = await Promise.all([
          api<Metrics>("/dashboard").catch(() => null),
          api<{ cash: string; upi: string }>("/payment-dashboard").catch(() => ({ cash: "0", upi: "0" })),
        ]);
        if (d) {
          setMetrics({ ...d, metrics: { ...d.metrics, ...p } });
        }
      }
    } catch {
      // offline fallback
    }
  }

  // Auto-login session check
  async function initSession() {
    try {
      const actor = await api<Actor>("/me");
      setUser(actor);
      await loadData(actor);
    } catch {
      // Not logged in or offline; load public catalog if possible
      loadData();
    }
  }

  useEffect(() => {
    initSession();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Offline queue synchronization
  async function synchronize() {
    if (!user) return;
    setBusy(true);
    try {
      await sync(user, (r) => {
        setNotice(`${r.plate} synced · ${money(r.amount_paise)} · ${r.points} pts`);
      });
      setItems(await pending(user));
      if (navigator.onLine) await loadData(user);
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    pending(user).then(setItems).catch(() => {});
    if (online) void synchronize();

    const timer = setInterval(() => {
      if (navigator.onLine) void synchronize();
    }, 30000);

    return () => clearInterval(timer);
  }, [user, online]);

  async function handleLogout() {
    soundFx.playTap();
    try {
      await api("/logout", {});
    } catch {
      // ignore
    }
    sessionStorage.removeItem("fp-ui");
    setUser(null);
    setNotice("Signed out of forecourt session.");
  }

  async function handleSaveTransaction(input: Input) {
    if (user) {
      await enqueue(user, input);
      setItems(await pending(user));
      await synchronize();
    }
  }

  const handleRoleSelection = async (role: "EMPLOYEE" | "MANAGER" | "OWNER" | "CUSTOMER") => {
    soundFx.playSuccess();
    if (role === "CUSTOMER") {
      setActiveTab("rewards");
      return;
    }

    // Attempt demo station sign-in for the chosen role
    try {
      const defaultCode = role.toLowerCase();
      const defaultPass = role === "OWNER" ? "password12345" : "password12345";
      await api("/login", {
        station: "local-qa",
        code: defaultCode,
        password: defaultPass,
      });
      const actor = await api<Actor>("/me");
      setUser(actor);
      await loadData(actor);
      setActiveTab(role === "EMPLOYEE" ? "pos" : "station");
      setNotice(`Signed in as ${actor.name} (${actor.role})`);
    } catch {
      // Mock actor representation for instant local exploration
      const mockActor: Actor = {
        id: "demo-user-id",
        organization_id: "demo-org-id",
        name: role === "EMPLOYEE" ? "Attendant Rahul" : role === "MANAGER" ? "Manager Sunita" : "Station Owner",
        code: role.toLowerCase(),
        role: role as "EMPLOYEE" | "MANAGER" | "OWNER",
      };
      setUser(mockActor);
      setActiveTab(role === "EMPLOYEE" ? "pos" : "station");
      setNotice(`Active in ${role.toLowerCase()} mode`);
    }
  };

  const handleCustomLogin = async (code: string, pass: string) => {
    await api("/login", {
      station: catalog?.organization?.slug || "local-qa",
      code,
      password: pass,
    });
    const actor = await api<Actor>("/me");
    setUser(actor);
    await loadData(actor);
    setNotice(`Welcome back, ${actor.name}!`);
  };

  const isManagerOrOwner = user?.role === "MANAGER" || user?.role === "OWNER";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Elevated Header */}
      <ElevatedHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        online={online}
        user={user}
        stationName={catalog?.organization?.name || "FuelPulse Forecourt"}
        stationSlug={catalog?.organization?.slug || "local-qa"}
        onLogout={handleLogout}
        onOpenRoleModal={() => setRoleModalOpen(true)}
      />

      {/* Notice Banner */}
      {notice && (
        <div className="bg-emerald-600 text-white text-xs py-2 px-4 flex items-center justify-between shadow-xs animate-in slide-in-from-top-1">
          <span className="font-medium">{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="ml-2 font-bold px-1.5 py-0.5 rounded hover:bg-emerald-700 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Offline Pending Items Notice */}
      {items.length > 0 && (
        <div className="bg-amber-500 text-slate-950 text-xs py-1.5 px-4 flex items-center justify-between font-bold">
          <span>
            {items.length} offline transaction{items.length > 1 ? "s" : ""} queued for sync
          </span>
          <button
            onClick={synchronize}
            disabled={busy || !online}
            className="px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-[11px]"
          >
            {busy ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      )}

      {/* 2. Main Content View Area */}
      <main className="flex-1 w-full">
        {activeTab === "pos" && (
          <ForecourtPosView
            catalog={catalog}
            onSaveTransaction={handleSaveTransaction}
            onShowNotice={setNotice}
            onRecordSuccess={(sale) => setRows((prev) => [sale, ...prev])}
          />
        )}

        {activeTab === "rewards" && <ForecourtRewardsView />}

        {activeTab === "station" && (
          <ForecourtStationTelemetry
            sales={rows}
            metricsData={metrics?.metrics}
          />
        )}

        {activeTab === "about" && (
          <ForecourtAboutView
            onLaunchPos={() => setActiveTab("pos")}
            onOpenRewards={() => setActiveTab("rewards")}
          />
        )}

        {activeTab === "admin" && (
          <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-4">
            {/* Admin Sub-nav */}
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto">
              {[
                { id: "staff", label: "Staff Roster" },
                { id: "pumps", label: "Pumps & Prices" },
                { id: "coupons", label: "Vouchers & Coupons" },
                { id: "audit", label: "Security Audit" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => {
                    soundFx.playTap();
                    setAdminSubTab(sub.id as typeof adminSubTab);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    adminSubTab === sub.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {adminSubTab === "staff" && user && (
              <StaffScreen user={user} notify={setNotice} />
            )}
            {adminSubTab === "pumps" && catalog && (
              <PumpsScreen
                catalog={catalog}
                refresh={() => loadData(user || undefined)}
                notify={setNotice}
              />
            )}
            {adminSubTab === "coupons" && (
              <CouponsScreen manager={isManagerOrOwner} notify={setNotice} />
            )}
            {adminSubTab === "audit" && <AuditScreen />}
          </div>
        )}
      </main>

      {/* 3. Floating Bottom Navigation Bar */}
      <ForecourtBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isManagerOrOwner={isManagerOrOwner}
      />

      {/* Role Selection & Staff Login Modal */}
      <RoleSelectModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        currentUser={user}
        onSelectRole={handleRoleSelection}
        onLoginCustom={handleCustomLogin}
      />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
