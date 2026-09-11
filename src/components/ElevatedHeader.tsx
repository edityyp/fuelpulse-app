import React from "react";
import { User, LogOut, ArrowRightLeft } from "lucide-react";
import { soundFx } from "../sound";
import type { Actor } from "../../shared/contracts";

interface ElevatedHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  online: boolean;
  user: Actor | null;
  stationName?: string;
  stationSlug?: string;
  onLogout: () => void;
  onOpenRoleModal?: () => void;
}

export const ElevatedHeader: React.FC<ElevatedHeaderProps> = ({
  activeTab,
  setActiveTab,
  online,
  user,
  stationName = "FuelPulse Forecourt",
  stationSlug = "local-qa",
  onLogout,
  onOpenRoleModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
      {/* Brand & Station Info */}
      <div className="flex items-center space-x-3 min-w-0">
        <div
          onClick={() => {
            soundFx.playTap();
            setActiveTab("pos");
          }}
          className="cursor-pointer flex items-center space-x-2.5 select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center font-display font-black text-lg shadow-sm shadow-emerald-700/30">
            F
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-display font-black text-slate-900 text-base sm:text-lg tracking-tight leading-tight">
                FuelPulse
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                OS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-[180px] sm:max-w-xs">
              {stationName} • <span className="font-mono">{stationSlug}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Connectivity Beacon */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              online ? "bg-emerald-500 pulse-beacon" : "bg-amber-500"
            }`}
          ></span>
          <span
            className={`text-[11px] font-bold tracking-wide uppercase ${
              online ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {online ? "Online" : "Offline Queue"}
          </span>
        </div>

        {/* Quick Role Switcher */}
        <button
          onClick={() => {
            soundFx.playTap();
            if (onOpenRoleModal) {
              onOpenRoleModal();
            } else {
              setActiveTab(activeTab === "pos" ? "rewards" : activeTab === "rewards" ? "station" : "pos");
            }
          }}
          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center space-x-1.5 transition-colors shadow-2xs"
          title="Switch Forecourt Role / Mode"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
          <span className="capitalize hidden sm:inline">
            {user ? `${user.role.toLowerCase()} mode` : "Role Switch"}
          </span>
          <span className="sm:hidden text-[11px]">Roles</span>
        </button>

        {/* User Info / Sign In / Out */}
        {user ? (
          <div className="flex items-center space-x-1.5 pl-1">
            <div className="hidden md:flex flex-col items-end leading-tight text-right">
              <span className="text-xs font-bold text-slate-900 truncate max-w-[100px]">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {user.code}
              </span>
            </div>
            <button
              onClick={() => {
                soundFx.playTap();
                onLogout();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              soundFx.playTap();
              if (onOpenRoleModal) onOpenRoleModal();
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
          >
            <User className="w-3.5 h-3.5" />
            <span>Staff Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
