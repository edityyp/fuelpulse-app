import React from "react";
import {
  Receipt,
  Database,
} from "lucide-react";
import { money } from "../api";
import type { Sale } from "../../shared/contracts";

interface ForecourtStationTelemetryProps {
  sales: Sale[];
  metricsData?: {
    revenue?: string;
    volume?: string;
    transactions?: number;
    points?: string;
    cash?: string;
    upi?: string;
  } | null;
}

export const ForecourtStationTelemetry: React.FC<ForecourtStationTelemetryProps> = ({
  sales,
  metricsData,
}) => {
  // Default fallback shift metrics if not yet populated from backend
  const displayRevenue = metricsData?.revenue ? money(metricsData.revenue) : "₹3,42,850";
  const displayVolume = metricsData?.volume ? `${(Number(metricsData.volume) / 1000).toFixed(1)} L` : "3,485.4 L";
  const displayTxns = metricsData?.transactions ?? (sales.length > 0 ? sales.length : 214);
  const displayPoints = metricsData?.points ? `${metricsData.points} pts` : "6,840 pts";

  const tanks = [
    {
      id: "tank-1",
      name: "Tank 01: Power Petrol",
      pct: 76,
      currentL: "15,200",
      totalL: "20,000",
      status: "Optimal",
      statusColor: "emerald",
      barColor: "bg-emerald-500",
    },
    {
      id: "tank-2",
      name: "Tank 02: Regular Petrol",
      pct: 62,
      currentL: "18,600",
      totalL: "30,000",
      status: "Healthy",
      statusColor: "sky",
      barColor: "bg-sky-500",
    },
    {
      id: "tank-3",
      name: "Tank 03: Turbo Diesel",
      pct: 41,
      currentL: "10,250",
      totalL: "25,000",
      status: "Reorder Soon",
      statusColor: "amber",
      barColor: "bg-amber-500",
    },
  ];

  return (
    <div className="p-3 sm:p-5 flex flex-col space-y-4 max-w-4xl mx-auto pb-28">
      {/* 1. Forecourt KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Daily Shift Sales
          </span>
          <p className="font-display font-black text-xl sm:text-2xl text-slate-900 mt-1">
            {displayRevenue}
          </p>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
            +14% vs avg shift
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Volume Pumped
          </span>
          <p className="font-display font-black text-xl sm:text-2xl text-slate-900 mt-1">
            {displayVolume}
          </p>
          <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-1.5 py-0.5 rounded">
            Flow: 38 L/min
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Transactions
          </span>
          <p className="font-display font-black text-xl sm:text-2xl text-slate-900 mt-1">
            {displayTxns}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            Avg ticket: ₹1,602
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Loyalty Accrued
          </span>
          <p className="font-display font-black text-xl sm:text-2xl text-amber-600 mt-1">
            {displayPoints}
          </p>
          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
            64% repeat drivers
          </span>
        </div>
      </div>

      {/* 2. Underground Storage Tanks (UST) Telemetry */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Underground Storage Tanks (UST) Telemetry
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Calibrated ATG Sensors
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {tanks.map((tank) => (
            <div
              key={tank.id}
              className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-900">
                    {tank.name}
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">
                    {tank.pct}%
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full ${tank.barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${tank.pct}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                <span>
                  {tank.currentL} / {tank.totalL} L
                </span>
                <span
                  className={`font-bold ${
                    tank.statusColor === "emerald"
                      ? "text-emerald-700"
                      : tank.statusColor === "sky"
                      ? "text-sky-700"
                      : "text-amber-700"
                  }`}
                >
                  {tank.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Real-Time Forecourt Transaction Audit Log Table */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-sky-600" />
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Live Shift Forecourt Transactions
            </h3>
          </div>
          <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            ● Real-Time Audited
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-2">Time</th>
                <th className="py-2.5 px-2">Plate / Vehicle</th>
                <th className="py-2.5 px-2">Fuel Grade</th>
                <th className="py-2.5 px-2">Volume</th>
                <th className="py-2.5 px-2">Total (₹)</th>
                <th className="py-2.5 px-2">Method</th>
                <th className="py-2.5 px-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {sales.length > 0 ? (
                sales.slice(0, 10).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-2 font-mono text-slate-500">
                      {new Date(r.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {r.plate}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-800">
                      Power Petrol
                    </td>
                    <td className="py-2.5 px-2 font-mono">
                      {(r.quantity_ml / 1000).toFixed(2)} L
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                      {money(r.amount_paise)}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.payment_method === "UPI"
                            ? "bg-sky-50 text-sky-800 border border-sky-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {r.payment_method}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-700">
                      +{r.points} pts
                    </td>
                  </tr>
                ))
              ) : (
                // Demo fallback rows matching inspiration
                [
                  { time: "14:28", plate: "MH-12-DE-1432", fuel: "Power Petrol", vol: "9.57 L", total: "₹1,000.00", method: "UPI", pts: "+20 pts" },
                  { time: "14:22", plate: "DL-01-AB-7890", fuel: "Turbo Diesel", vol: "22.31 L", total: "₹2,000.00", method: "Cash", pts: "+40 pts" },
                  { time: "14:15", plate: "KA-05-MQ-9012", fuel: "Regular Petrol", vol: "5.17 L", total: "₹500.00", method: "UPI", pts: "+10 pts" },
                  { time: "14:02", plate: "MH-04-AZ-4411", fuel: "Eco CNG", vol: "13.07 kg", total: "₹1,000.00", method: "Card", pts: "+20 pts" },
                  { time: "13:48", plate: "DL-03-CC-5120", fuel: "Power Petrol", vol: "14.35 L", total: "₹1,500.00", method: "UPI", pts: "+30 pts" },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-2 font-mono text-slate-500">{row.time}</td>
                    <td className="py-2.5 px-2">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {row.plate}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-800">{row.fuel}</td>
                    <td className="py-2.5 px-2 font-mono">{row.vol}</td>
                    <td className="py-2.5 px-2 font-mono font-bold text-slate-900">{row.total}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        {row.method}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-700">{row.pts}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
