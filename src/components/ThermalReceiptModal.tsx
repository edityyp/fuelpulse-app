import React from "react";
import { Check, Printer, Share2, ArrowRight } from "lucide-react";
import { soundFx } from "../sound";

export interface ReceiptData {
  txnId: string;
  date: string;
  plate: string;
  pump: string;
  fuel: string;
  rate: string;
  volume: string;
  payment: string;
  total: string;
  points: number;
}

interface ThermalReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
  onNext: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  receipt,
  onClose,
  onNext,
}) => {
  if (!receipt) return null;

  const handleClose = () => {
    soundFx.playTap();
    onClose();
  };

  const handlePrint = () => {
    soundFx.playTap();
    window.print();
  };

  const handleShare = async () => {
    soundFx.playTap();
    const text = `FuelPulse Dispense Receipt\nTxn: ${receipt.txnId}\nVehicle: ${receipt.plate}\nFuel: ${receipt.fuel} (${receipt.volume})\nTotal: ${receipt.total}\nPoints Earned: +${receipt.points} pts`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "FuelPulse Forecourt Receipt",
          text,
        });
      } catch {
        // user dismissed
      }
    } else {
      navigator.clipboard?.writeText(text);
      soundFx.playBeep(900, 0.05);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 border border-slate-200 relative overflow-hidden">
        {/* Top Paper Tear Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500"></div>

        {/* Close icon */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          title="Close Receipt"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>

        {/* Receipt Header */}
        <div className="text-center border-b border-dashed border-slate-300 pb-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2 font-black shadow-xs">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <h3 className="font-display font-extrabold text-xl text-slate-900">
            Dispense Authorized
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            {receipt.txnId}
          </p>
          <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
            Verified Forecourt Transaction
          </div>
        </div>

        {/* Receipt Details Table */}
        <div className="space-y-2 text-xs text-slate-600 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Date & Time:</span>
            <span className="font-bold text-slate-800">{receipt.date}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Vehicle Plate:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {receipt.plate}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Pump Island:</span>
            <span className="text-slate-800 font-medium">{receipt.pump}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Fuel Grade:</span>
            <span className="font-bold text-emerald-700">{receipt.fuel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Price / Litre:</span>
            <span className="text-slate-700">{receipt.rate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Volume Pumped:</span>
            <span className="font-bold text-slate-900">{receipt.volume}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Payment Mode:</span>
            <span className="font-bold text-sky-700">{receipt.payment}</span>
          </div>

          {/* Grand Total */}
          <div className="flex justify-between items-center border-t border-dashed border-slate-300 pt-2.5 text-base text-slate-950 font-black">
            <span>Total Paid:</span>
            <span className="text-emerald-700 font-extrabold">{receipt.total}</span>
          </div>

          {/* Points Accrual */}
          <div className="bg-amber-50 p-2.5 rounded-xl text-amber-900 font-sans text-xs flex justify-between items-center font-bold border border-amber-200/80">
            <span className="flex items-center space-x-1">
              <span>⭐️ FuelPulse Loyalty Points:</span>
            </span>
            <span className="font-mono text-amber-800 text-sm font-black">
              +{receipt.points} pts
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-2 pt-2">
          <button
            onClick={() => {
              soundFx.playTap();
              onNext();
            }}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-display font-extrabold text-sm rounded-xl shadow-md shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center space-x-2"
          >
            <span>Next Dispense</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-200"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={handleShare}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-200"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
