import React from "react";
import { ArrowRight, Server } from "lucide-react";
import { soundFx } from "../sound";

interface ForecourtAboutViewProps {
  onLaunchPos: () => void;
  onOpenRewards: () => void;
}

export const ForecourtAboutView: React.FC<ForecourtAboutViewProps> = ({
  onLaunchPos,
  onOpenRewards,
}) => {
  return (
    <div className="p-4 sm:p-6 flex flex-col space-y-8 max-w-4xl mx-auto pb-28">
      {/* 1. Hero Section */}
      <div className="text-center py-6 sm:py-10">
        <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3.5 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-beacon"></span>
          <span>Next-Gen Petrol Forecourt Operating System</span>
        </span>

        <h1 className="font-display font-black text-3xl sm:text-5xl text-slate-950 tracking-tight leading-tight max-w-2xl mx-auto">
          Fuel Smarter. Earn More.{" "}
          <span className="text-emerald-600">Drive Better.</span>
        </h1>

        <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mt-3.5 leading-relaxed">
          FuelPulse unites AI-powered camera number plate recognition with instant customer loyalty rewards and forecourt telemetry for high-volume petrol pumps.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              soundFx.playTap();
              onLaunchPos();
            }}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center space-x-2"
          >
            <span>Launch Forecourt POS Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              soundFx.playTap();
              onOpenRewards();
            }}
            className="px-5 py-3 bg-white border border-slate-300 text-slate-800 rounded-xl font-bold text-sm hover:bg-slate-50 shadow-2xs active:scale-95 transition-all"
          >
            Explore Customer Rewards
          </button>
        </div>
      </div>

      {/* 2. How It Works (3-Step Forecourt Process) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
        <div className="text-center max-w-md mx-auto mb-6">
          <h2 className="font-display font-bold text-xl text-slate-950">
            How FuelPulse Works
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Zero-friction forecourt automation in 3 seamless steps
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center flex flex-col items-center">
            <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-3 font-black font-display text-base">
              1
            </div>
            <h4 className="font-bold text-sm text-slate-900 mb-1.5">
              Optical Plate Scan
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Device camera automatically captures the vehicle registration plate in under 0.8 seconds using neural ALPR.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center flex flex-col items-center">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 font-black font-display text-base">
              2
            </div>
            <h4 className="font-bold text-sm text-slate-900 mb-1.5">
              Smart Dispense Auth
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Staff sets litres or rupees with preset chips. Nozzle flow rates and totals are calculated instantly.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center flex flex-col items-center">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 font-black font-display text-base">
              3
            </div>
            <h4 className="font-bold text-sm text-slate-900 mb-1.5">
              Instant Rewards & Receipt
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Loyalty points are credited to the license plate without physical cards. Thermal receipt prints on authorization.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Dual Value Propositions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            For Forecourt Managers & Owners
          </span>
          <h3 className="font-display font-bold text-lg text-slate-900 mt-2 mb-2">
            Real-Time Forecourt Telemetry
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Monitor Underground Storage Tank (UST) fuel levels, live dispenser pump status, staff shift volumes, and fraud-flagged transactions with high-speed automated reconciliation.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            For Vehicle Owners & Drivers
          </span>
          <h3 className="font-display font-bold text-lg text-slate-900 mt-2 mb-2">
            Cardless Digital Fuel Pass
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            No plastic cards or app downloads required. Your license plate is your loyalty key. Earn 2% back on every fuel fill and redeem instant service vouchers for free washes and lubricants.
          </p>
        </div>
      </div>

      {/* 4. Offline First Assurance */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">
              Forecourt Offline-First Engine
            </div>
            <div className="text-[11px] text-slate-400">
              Transactions queue locally in IndexedDB and synchronize whenever station connectivity resumes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
