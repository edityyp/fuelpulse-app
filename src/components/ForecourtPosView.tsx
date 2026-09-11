import React, { useState, useEffect } from "react";
import {
  Camera,
  CheckCircle2,
  QrCode,
  Banknote,
  CreditCard,
  Fuel,
  Sparkles,
  Gauge,
  UserCheck,
  Zap,
} from "lucide-react";
import { soundFx } from "../sound";
import { CameraAlprModal } from "./CameraAlprModal";
import { ThermalReceiptModal, type ReceiptData } from "./ThermalReceiptModal";
import type { Catalog, Input, Sale } from "../../shared/contracts";

interface ForecourtPosViewProps {
  catalog: Catalog | null;
  onSaveTransaction: (input: Input) => Promise<void>;
  onShowNotice: (msg: string) => void;
  onRecordSuccess?: (sale: Sale) => void;
}

interface CustomerProfile {
  name: string;
  phone: string;
  tier: "Platinum" | "Gold" | "Silver";
  points: number;
  initials: string;
  visits: number;
  litres: number;
}

const DEMO_CUSTOMERS: Record<string, CustomerProfile> = {
  "MH12DE1432": {
    name: "Aditya Sharma",
    phone: "+91 98765 43210",
    tier: "Platinum",
    points: 1420,
    initials: "AS",
    visits: 18,
    litres: 412,
  },
  "DL01AB7890": {
    name: "Priya Patel",
    phone: "+91 98230 11223",
    tier: "Gold",
    points: 680,
    initials: "PP",
    visits: 11,
    litres: 245,
  },
  "KA05MQ9012": {
    name: "Vikram Rao",
    phone: "+91 97410 98877",
    tier: "Silver",
    points: 210,
    initials: "VR",
    visits: 4,
    litres: 95,
  },
  "MH04AZ4411": {
    name: "Rajesh Verma",
    phone: "+91 98112 33445",
    tier: "Platinum",
    points: 2150,
    initials: "RV",
    visits: 27,
    litres: 610,
  },
};

const DEFAULT_GRADES = [
  { id: "power", name: "Power Petrol", octane: "Octane 95", price: 104.5, color: "emerald" },
  { id: "regular", name: "Regular Petrol", octane: "Octane 91", price: 96.72, color: "sky" },
  { id: "diesel", name: "Turbo Diesel", octane: "Cetane 51", price: 89.2, color: "amber" },
  { id: "cng", name: "Eco CNG", octane: "Clean Burn", price: 76.5, color: "teal" },
];

export const ForecourtPosView: React.FC<ForecourtPosViewProps> = ({
  catalog,
  onSaveTransaction,
  onShowNotice,
  onRecordSuccess,
}) => {
  const [selectedPump, setSelectedPump] = useState<string>("02");
  const [plate, setPlate] = useState<string>("MH12DE1432");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerProfile>(DEMO_CUSTOMERS["MH12DE1432"]);

  const [fuelGrade, setFuelGrade] = useState<string>("Power Petrol");
  const [fuelPrice, setFuelPrice] = useState<number>(104.5);
  const [calcMode, setCalcMode] = useState<"amount" | "volume">("amount");
  const [amountVal, setAmountVal] = useState<number>(1000);
  const [volumeVal, setVolumeVal] = useState<number>(9.57);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH" | "CARD">("UPI");
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  // Sync pricing if catalog fuels exist
  useEffect(() => {
    if (catalog?.fuels?.length) {
      const match = catalog.fuels.find((f) => f.name.toLowerCase().includes(fuelGrade.toLowerCase()));
      if (match) {
        setFuelPrice(match.price_paise / 100);
      }
    }
  }, [catalog, fuelGrade]);

  // Two-way calculation
  const handleAmountChange = (amt: number) => {
    setAmountVal(amt);
    const vol = fuelPrice > 0 ? amt / fuelPrice : 0;
    setVolumeVal(parseFloat(vol.toFixed(2)));
  };

  const handleVolumeChange = (vol: number) => {
    setVolumeVal(vol);
    const amt = vol * fuelPrice;
    setAmountVal(parseFloat(amt.toFixed(2)));
  };

  const handleGradeChange = (name: string, price: number) => {
    soundFx.playTap();
    setFuelGrade(name);
    setFuelPrice(price);
    if (calcMode === "amount") {
      const vol = price > 0 ? amountVal / price : 0;
      setVolumeVal(parseFloat(vol.toFixed(2)));
    } else {
      const amt = volumeVal * price;
      setAmountVal(parseFloat(amt.toFixed(2)));
    }
  };

  const handlePlateChange = (newPlate: string) => {
    const sanitized = newPlate.toUpperCase().replace(/[\s-]/g, "");
    setPlate(sanitized);
    if (DEMO_CUSTOMERS[sanitized]) {
      setCustomer(DEMO_CUSTOMERS[sanitized]);
    } else {
      setCustomer({
        name: `Driver ${sanitized.slice(-4) || "Guest"}`,
        phone: "+91 ••••• •••••",
        tier: "Silver",
        points: 50,
        initials: (sanitized.slice(0, 2) || "FP").toUpperCase(),
        visits: 1,
        litres: 15,
      });
    }
  };

  const handleApplyPreset = (presetAmt: number) => {
    soundFx.playTap();
    setCalcMode("amount");
    handleAmountChange(presetAmt);
  };

  const earnedPoints = Math.max(1, Math.floor(amountVal * 0.02)); // 2% loyalty rebate

  const handleAuthorizeDispense = async () => {
    soundFx.playTap();
    setIsAuthorizing(true);

    const cleanPlate = plate.toUpperCase().replace(/[\s-]/g, "") || "MH12DE1432";
    const txnId = `FP-${Date.now().toString().slice(-6)}`;

    // Prepare contracts Input
    const pumpObj = catalog?.pumps?.[0] || { id: "00000000-0000-0000-0000-000000000001", name: `Pump ${selectedPump}` };
    const fuelObj = catalog?.fuels?.[0] || { id: "00000000-0000-0000-0000-000000000002", name: fuelGrade, price_paise: Math.round(fuelPrice * 100) };

    const inputData: Input = {
      idempotency_key: "00000000-0000-0000-0000-" + Date.now().toString(16).padStart(12, "0"),
      pump_id: pumpObj.id,
      fuel_id: fuelObj.id,
      plate: cleanPlate,
      payment_method: paymentMethod === "CASH" ? "CASH" : "UPI",
      requested_amount_paise: Math.round(amountVal * 100),
    };

    try {
      await onSaveTransaction(inputData);
    } catch {
      // offline fallback or demo mode continue
    }

    soundFx.playSuccess();
    setIsAuthorizing(false);

    // Show thermal receipt
    const receiptData: ReceiptData = {
      txnId,
      date: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      plate: cleanPlate,
      pump: `Pump ${selectedPump} • Nozzle 1`,
      fuel: fuelGrade,
      rate: `₹${fuelPrice.toFixed(2)}/L`,
      volume: `${volumeVal.toFixed(2)} Litres`,
      payment: paymentMethod === "UPI" ? "UPI / QR" : paymentMethod === "CASH" ? "Cash Forecourt" : "Card / Fleet",
      total: `₹${amountVal.toFixed(2)}`,
      points: earnedPoints,
    };

    setActiveReceipt(receiptData);
    onShowNotice(`Dispense Authorized: ₹${amountVal.toFixed(2)} (${volumeVal.toFixed(2)} L) for ${cleanPlate}`);

    // Update customer points locally for instant responsiveness
    setCustomer((prev) => ({
      ...prev,
      points: prev.points + earnedPoints,
      visits: prev.visits + 1,
      litres: prev.litres + Math.round(volumeVal),
    }));

    if (onRecordSuccess) {
      onRecordSuccess({
        id: txnId,
        plate: cleanPlate,
        quantity_ml: Math.round(volumeVal * 1000),
        amount_paise: String(Math.round(amountVal * 100)),
        payment_method: paymentMethod === "CASH" ? "CASH" : "UPI",
        points: earnedPoints,
        fraud: false,
        created_at: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="p-3 sm:p-5 flex flex-col space-y-4 max-w-4xl mx-auto pb-28">
      {/* 1. Forecourt Pump Dispenser Island Banner */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex flex-col items-center justify-center text-sky-700 font-display font-extrabold shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-sky-600 tracking-wider">
              PUMP
            </span>
            <span className="text-xl leading-none">{selectedPump}</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-display font-bold text-slate-900 text-base sm:text-lg">
                Dispenser Island {selectedPump}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                READY
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Power Nozzle • Flow Rate: 38 L/min • Dual Digital Totalizer
            </p>
          </div>
        </div>

        {/* Quick Island Switch Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
          <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">
            Switch:
          </span>
          {["01", "02", "03", "04"].map((p) => {
            const active = selectedPump === p;
            return (
              <button
                key={p}
                onClick={() => {
                  soundFx.playTap();
                  setSelectedPump(p);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  active
                    ? "border border-emerald-500 bg-emerald-600 text-white shadow-xs"
                    : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                P{parseInt(p, 10)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Top Grid: Vehicle Identification & Customer Profile */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Left: Vehicle Plate Scanner Card (ALPR) */}
        <div className="md:col-span-7 bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-sky-600" />
                <span className="font-display font-bold text-sm text-slate-900">
                  Vehicle Identification (ALPR)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>AI Plate OCR</span>
              </span>
            </div>

            {/* License Plate Input Box with IND Plate Styling */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                {/* Blue IND stripe badge */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center pr-1 border-r border-slate-300">
                    <span className="text-[10px] font-black text-sky-700 leading-none">
                      IND
                    </span>
                    <span className="text-[7px] text-amber-500 font-extrabold leading-none">
                      ●
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => handlePlateChange(e.target.value)}
                  placeholder="MH-12-DE-1432"
                  className="w-full pl-14 pr-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 tracking-wider bg-slate-50/50 text-base"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>
              <button
                onClick={() => setIsCameraOpen(true)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-sm shadow-sky-600/20 active:scale-95 transition-all flex-shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Camera</span>
              </button>
            </div>

            {/* Quick Test Vehicle Chips */}
            <div className="mt-3 flex items-center space-x-2 flex-wrap gap-y-1.5">
              <span className="text-[11px] text-slate-400 font-medium">
                Quick Cars:
              </span>
              <button
                onClick={() => {
                  soundFx.playTap();
                  handlePlateChange("MH12DE1432");
                }}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-mono font-bold text-slate-700 border border-slate-200 transition-colors"
              >
                MH-12-DE-1432 (Audi A4)
              </button>
              <button
                onClick={() => {
                  soundFx.playTap();
                  handlePlateChange("DL01AB7890");
                }}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-mono font-bold text-slate-700 border border-slate-200 transition-colors"
              >
                DL-01-AB-7890 (Creta)
              </button>
              <button
                onClick={() => {
                  soundFx.playTap();
                  handlePlateChange("KA05MQ9012");
                }}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-mono font-bold text-slate-700 border border-slate-200 transition-colors"
              >
                KA-05-MQ-9012 (Swift)
              </button>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Auto-Customer Profile Link</span>
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              Forecourt CCTV Ch-02
            </span>
          </div>
        </div>

        {/* Right: Auto-Loaded Customer Loyalty Summary */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Customer Loyalty Profile
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  customer.tier === "Platinum"
                    ? "bg-amber-400 text-slate-950"
                    : customer.tier === "Gold"
                    ? "bg-amber-200 text-amber-900"
                    : "bg-slate-300 text-slate-900"
                }`}
              >
                {customer.tier} Member
              </span>
            </div>
            <div className="flex items-center space-x-3 mb-2.5">
              <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-200 text-sm shadow-inner">
                {customer.initials}
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-base leading-tight">
                  {customer.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {customer.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Points & Perks Bar */}
          <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Points Balance
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="font-display text-xl font-black text-amber-400">
                  {customer.points.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-300 font-medium">
                  pts (₹{(customer.points * 0.1).toFixed(0)} value)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-400">
                Visit Stats
              </span>
              <p className="text-xs text-slate-200 font-semibold">
                {customer.visits} Visits • {customer.litres} L
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle: Fuel Grade Selector */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Fuel className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Forecourt Fuel Grades
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Selected: <strong className="text-slate-800">{fuelGrade}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DEFAULT_GRADES.map((grade) => {
            const isSelected = fuelGrade === grade.name;
            return (
              <button
                key={grade.id}
                onClick={() => handleGradeChange(grade.name, grade.price)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      isSelected
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {grade.octane}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div className="font-display font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate">
                  {grade.name}
                </div>
                <div className="text-emerald-700 font-mono font-black text-sm mt-0.5">
                  ₹{grade.price.toFixed(2)}
                  <span className="text-[10px] font-normal text-slate-500">
                    /L
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Bottom Grid: Dispense Calculator & Presets */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Dispense Calculator Inputs */}
        <div className="md:col-span-7 bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-sky-600" />
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Dispense Calculator
              </h3>
            </div>
            {/* Mode Switcher */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => {
                  soundFx.playTap();
                  setCalcMode("amount");
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  calcMode === "amount"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                By Amount (₹)
              </button>
              <button
                onClick={() => {
                  soundFx.playTap();
                  setCalcMode("volume");
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  calcMode === "volume"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                By Volume (L)
              </button>
            </div>
          </div>

          {/* Main Numeric Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">
              {calcMode === "amount"
                ? "Total Amount to Dispense"
                : "Exact Volume in Litres"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-display font-bold text-lg">
                {calcMode === "amount" ? "₹" : "L"}
              </div>
              <input
                type="number"
                min="10"
                step="1"
                value={calcMode === "amount" ? amountVal : volumeVal}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (calcMode === "amount") {
                    handleAmountChange(val);
                  } else {
                    handleVolumeChange(val);
                  }
                }}
                className="w-full pl-9 pr-28 py-3 rounded-xl border border-slate-300 font-mono font-black text-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  {calcMode === "amount"
                    ? `${volumeVal.toFixed(2)} Litres`
                    : `₹${amountVal.toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Quick Presets
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[200, 500, 1000, 2000, 3500].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleApplyPreset(preset)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    amountVal === preset
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-extrabold"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {preset === 3500 ? "Full Tank" : `₹${preset}`}
                </button>
              ))}
            </div>
          </div>

          {/* Loyalty Bonus Accrual Tag */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900 font-medium">
            <span className="flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Earn Points on this Fill</span>
            </span>
            <span className="font-bold font-mono text-amber-800">
              +{earnedPoints} FuelPulse Points (2% back)
            </span>
          </div>
        </div>

        {/* Right: Payment Method & Dispense Execution Card */}
        <div className="md:col-span-5 bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm mb-2.5">
              Forecourt Payment Mode
            </h3>

            {/* Payment Mode Selector Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3.5">
              <button
                onClick={() => {
                  soundFx.playTap();
                  setPaymentMethod("UPI");
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  paymentMethod === "UPI"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>UPI / QR</span>
              </button>

              <button
                onClick={() => {
                  soundFx.playTap();
                  setPaymentMethod("CASH");
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  paymentMethod === "CASH"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Banknote className="w-4 h-4 text-slate-600" />
                <span>Cash</span>
              </button>

              <button
                onClick={() => {
                  soundFx.playTap();
                  setPaymentMethod("CARD");
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  paymentMethod === "CARD"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <CreditCard className="w-4 h-4 text-slate-600" />
                <span>Card/Fleet</span>
              </button>
            </div>

            {/* Order Summary Compact Table */}
            <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2.5">
              <div className="flex justify-between text-slate-500">
                <span>Base Fuel Rate</span>
                <span className="font-mono">₹{fuelPrice.toFixed(2)}/L</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Calculated Volume</span>
                <span className="font-mono">{volumeVal.toFixed(2)} Litres</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-dashed border-slate-200">
                <span>Payable Total</span>
                <span className="font-mono text-base text-emerald-700 font-extrabold">
                  ₹{amountVal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleAuthorizeDispense}
            disabled={isAuthorizing || amountVal <= 0}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-display font-extrabold text-base rounded-xl shadow-lg shadow-emerald-600/25 active:scale-98 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>
              {isAuthorizing
                ? "Authorizing Island..."
                : "Authorize & Print Dispense"}
            </span>
          </button>
        </div>
      </div>

      {/* Camera OCR Scanner Modal */}
      <CameraAlprModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDetected={(detectedPlate) => handlePlateChange(detectedPlate)}
      />

      {/* Digital Thermal Receipt Modal */}
      <ThermalReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
        onNext={() => {
          setActiveReceipt(null);
          // reset for next fill
          handleAmountChange(500);
        }}
      />
    </div>
  );
};
