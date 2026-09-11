import React from "react";
import { Zap, Gift, BarChart3, Info, ShieldAlert } from "lucide-react";
import { soundFx } from "../sound";

interface ForecourtBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isManagerOrOwner: boolean;
}

export const ForecourtBottomNav: React.FC<ForecourtBottomNavProps> = ({
  activeTab,
  setActiveTab,
  isManagerOrOwner,
}) => {
  const tabs = [
    { id: "pos", label: "Staff POS", icon: Zap },
    { id: "rewards", label: "Rewards", icon: Gift },
    { id: "station", label: "Station", icon: BarChart3 },
    ...(isManagerOrOwner
      ? [{ id: "admin", label: "Admin", icon: ShieldAlert }]
      : []),
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              soundFx.playTap();
              setActiveTab(tab.id);
            }}
            className={`flex-1 py-1.5 flex flex-col items-center justify-center transition-all ${
              isActive
                ? "text-emerald-700 font-bold scale-105"
                : "text-slate-400 hover:text-slate-700 font-medium"
            }`}
          >
            <Icon
              className={`w-5 h-5 mb-0.5 ${
                isActive ? "stroke-[2.5] text-emerald-600" : ""
              }`}
            />
            <span className="text-[11px] leading-tight tracking-tight">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
