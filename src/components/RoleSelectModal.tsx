import React, { useState } from "react";
import { X, User, ShieldCheck, Zap, Gift, BarChart3 } from "lucide-react";
import { soundFx } from "../sound";
import type { Actor } from "../../shared/contracts";

interface RoleSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: Actor | null;
  onSelectRole: (role: "EMPLOYEE" | "MANAGER" | "OWNER" | "CUSTOMER") => void;
  onLoginCustom: (code: string, pass: string) => Promise<void>;
}

export const RoleSelectModal: React.FC<RoleSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectRole,
  onLoginCustom,
}) => {
  const [showCustomLogin, setShowCustomLogin] = useState(false);
  const [staffCode, setStaffCode] = useState("owner");
  const [password, setPassword] = useState("StationOwnerPass123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onLoginCustom(staffCode, password);
      soundFx.playSuccess();
      onClose();
    } catch (err) {
      soundFx.playBeep(350, 0.1);
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-emerald-600" />
            <h3 className="font-display font-extrabold text-base text-slate-900">
              Select Forecourt Role
            </h3>
          </div>
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showCustomLogin ? (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-500">
              Switch role mode to test attendant POS, driver loyalty pass, or manager analytics:
            </p>

            <button
              onClick={() => {
                soundFx.playSuccess();
                onSelectRole("EMPLOYEE");
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/80 hover:border-emerald-300 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-slate-900">
                    Forecourt Attendant (POS)
                  </div>
                  <div className="text-xs text-slate-500">
                    Pump island control, ALPR plate scan, dispense authorization
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                soundFx.playSuccess();
                onSelectRole("CUSTOMER");
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-amber-50/80 hover:border-amber-300 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-slate-900">
                    Driver / Customer Pass
                  </div>
                  <div className="text-xs text-slate-500">
                    Digital Fuel Pass QR, points balance, voucher store
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                soundFx.playSuccess();
                onSelectRole("MANAGER");
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-sky-50/80 hover:border-sky-300 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-900 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-slate-900">
                    Shift Station Manager
                  </div>
                  <div className="text-xs text-slate-500">
                    UST storage tank telemetry, shift reconciliation, sales log
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                soundFx.playSuccess();
                onSelectRole("OWNER");
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/80 hover:border-indigo-300 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-slate-900">
                    Station Owner (Full Admin)
                  </div>
                  <div className="text-xs text-slate-500">
                    Staff management, fuel price controls, reward parameters
                  </div>
                </div>
              </div>
            </button>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowCustomLogin(true)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline"
              >
                Sign in with custom staff credentials
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Staff / Operator Code
              </label>
              <input
                type="text"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Station Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomLogin(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Back to Roles
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Sign In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
