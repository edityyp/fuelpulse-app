import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  Gift,
  Award,
  Sparkles,
  Check,
  Tag,
  Copy,
  Clock,
  Flame,
} from "lucide-react";
import { soundFx } from "../sound";

interface Voucher {
  id: string;
  name: string;
  cost: number;
  description: string;
  badge: string;
}

const AVAILABLE_VOUCHERS: Voucher[] = [
  {
    id: "v-100-fuel",
    name: "₹100 Fuel Discount",
    cost: 1000,
    description: "Direct ₹100 instant deduction on your next petrol or diesel fill.",
    badge: "Most Popular",
  },
  {
    id: "v-car-wash",
    name: "Free Foam Car Wash",
    cost: 800,
    description: "Full exterior foam wash and high-pressure underbody rinse.",
    badge: "Forecourt Special",
  },
  {
    id: "v-engine-oil",
    name: "Engine Oil Top-Up (500ml)",
    cost: 1200,
    description: "Premium synthetic blend engine lubricant forecourt top-up.",
    badge: "Vehicle Health",
  },
  {
    id: "v-snack-50",
    name: "₹50 Convenience Voucher",
    cost: 500,
    description: "Valid for coffee, drinks, and snacks at the forecourt store.",
    badge: "Cafe & Mart",
  },
];

interface RedeemedCoupon {
  code: string;
  name: string;
  date: string;
}

export const ForecourtRewardsView: React.FC = () => {
  const [points, setPoints] = useState<number>(1420);
  const [qrSrc, setQrSrc] = useState<string>("");
  const [redeemed, setRedeemed] = useState<RedeemedCoupon[]>([
    {
      code: "FP-WASH-9912",
      name: "Free Foam Car Wash",
      date: "Valid till 30 Sep 2026",
    },
  ]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const memberId = "FP-8821-PLATINUM";

  useEffect(() => {
    QRCode.toDataURL(memberId, {
      width: 200,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then(setQrSrc)
      .catch(() => {});
  }, [memberId]);

  const handleRedeem = (voucher: Voucher) => {
    if (points < voucher.cost) {
      soundFx.playBeep(400, 0.1);
      alert(`You need ${voucher.cost - points} more points to redeem this voucher!`);
      return;
    }

    soundFx.playSuccess();
    setPoints((p) => p - voucher.cost);
    const newCoupon: RedeemedCoupon = {
      code: `FP-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      name: voucher.name,
      date: "Valid for 30 days",
    };
    setRedeemed((prev) => [newCoupon, ...prev]);
  };

  const copyToClipboard = (code: string) => {
    soundFx.playTap();
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="p-3 sm:p-5 flex flex-col space-y-4 max-w-4xl mx-auto pb-28">
      {/* 1. Digital Fuel Pass Card */}
      <div className="bg-gradient-to-r from-emerald-800 via-sky-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute -right-8 -bottom-8 w-52 h-52 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-400 text-emerald-950 tracking-wider">
                FuelPulse Club Pass
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400/90 text-slate-950">
                Platinum Member
              </span>
            </div>

            <h2 className="font-display font-extrabold text-2xl sm:text-3xl mt-2 leading-tight">
              Aditya Sharma
            </h2>
            <p className="text-xs text-emerald-200 font-mono mt-0.5">
              Member ID: {memberId}
            </p>

            <div className="mt-4 flex items-baseline space-x-2">
              <span className="font-display text-4xl sm:text-5xl font-black text-amber-300">
                {points.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                Available Fuel Points
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1">
              Worth ₹{(points * 0.1).toFixed(2)} in direct fuel cashback or forecourt service vouchers
            </p>
          </div>

          {/* Pass QR Code Card */}
          <div className="bg-white p-3 rounded-2xl flex flex-col items-center justify-center shadow-lg self-start sm:self-center border border-slate-100 flex-shrink-0">
            <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt="Member QR"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-slate-900 rounded-lg"></div>
              )}
            </div>
            <span className="text-[10px] font-black text-slate-800 mt-1.5 uppercase tracking-tight">
              Scan At Pump
            </span>
          </div>
        </div>
      </div>

      {/* 2. Tier Progress Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-bold text-slate-800">
              Loyalty Tier Progression
            </span>
          </div>
          <span className="text-xs font-extrabold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
            Platinum (Tier 3/3)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: "84%" }}
          ></div>
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
          <span>Current Year Fuel Spend: ₹42,850</span>
          <span className="font-medium text-slate-700">180 pts to next VIP anniversary perk</span>
        </div>
      </div>

      {/* 3. Available Rewards Voucher Store */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <Gift className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Redeem Fuel & Service Vouchers
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Balance: <strong className="text-amber-600">{points} pts</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AVAILABLE_VOUCHERS.map((voucher) => {
            const canAfford = points >= voucher.cost;
            return (
              <div
                key={voucher.id}
                className="border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between hover:border-emerald-300 transition-colors bg-slate-50/50"
              >
                <div>
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      {voucher.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                      {voucher.cost} pts
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {voucher.description}
                  </p>
                </div>

                <button
                  onClick={() => handleRedeem(voucher)}
                  disabled={!canAfford}
                  className={`mt-3 w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 ${
                    canAfford
                      ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {canAfford
                      ? `Redeem ${voucher.cost.toLocaleString()} pts`
                      : `Need ${voucher.cost - points} more pts`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Active Redeemed Vouchers */}
      {redeemed.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 mb-3">
            <Tag className="w-4 h-4 text-amber-600" />
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Your Active Forecourt Vouchers ({redeemed.length})
            </h3>
          </div>

          <div className="space-y-2">
            {redeemed.map((coupon, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {coupon.name}
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500">
                    <span className="font-mono font-bold text-emerald-800">
                      {coupon.code}
                    </span>
                    <span>•</span>
                    <span>{coupon.date}</span>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(coupon.code)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-1 hover:bg-emerald-50 transition-colors"
                >
                  {copiedCode === coupon.code ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Past Visit History Ledger */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Recent Forecourt Fills
            </h3>
          </div>
          <span className="text-xs text-slate-400">Audited Loyalty Ledger</span>
        </div>

        <div className="space-y-2">
          {[
            {
              date: "Today, 14:28",
              fuel: "Power Petrol (9.57 L)",
              pump: "Island 02",
              spent: "₹1,000.00",
              pts: "+20 pts",
            },
            {
              date: "04 Sep 2026, 18:12",
              fuel: "Power Petrol (19.14 L)",
              pump: "Island 01",
              spent: "₹2,000.00",
              pts: "+40 pts",
            },
            {
              date: "28 Aug 2026, 09:40",
              fuel: "Power Petrol (28.71 L)",
              pump: "Island 03",
              spent: "₹3,000.00",
              pts: "+60 pts",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">{item.fuel}</div>
                  <div className="text-[11px] text-slate-400">
                    {item.date} • {item.pump}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">{item.spent}</div>
                <div className="font-mono text-emerald-700 font-extrabold text-[11px]">
                  {item.pts}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
