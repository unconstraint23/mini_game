import React from "react";
import {
  Activity,
  BarChart3,
  Eye,
  Flame,
  Grid2x2,
  Palette,
  Sparkles,
  Timer,
} from "lucide-react";
import type { AppView, HealthResponse, StatsOverview } from "../types/game";

interface MobileNavProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  health: HealthResponse | null;
  stats: StatsOverview | null;
}

export const MobileTopBar: React.FC<MobileNavProps> = ({
  activeView,
  onSelectView,
  health,
  stats,
}) => {
  return (
    <header className="md:hidden shrink-0 safe-top px-4 pb-2.5 border-b border-slate-800/80 bg-[#090F1E]/95 backdrop-blur-xl flex items-center justify-between gap-2 z-20 select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-orange-500 p-[1.5px] shrink-0">
          <div className="w-full h-full rounded-[10.5px] bg-slate-950 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold text-white tracking-tight">NeuroPulse</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                health ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-amber-400 animate-pulse"
              }`}
            />
          </div>
          <div className="text-[10px] text-slate-400 truncate">灵动反应 · 专注力训练</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-slate-800 px-2.5 py-1 text-[11px] font-bold text-amber-300">
          <Flame className="w-3.5 h-3.5" />
          <span className="tabular-nums">{stats?.streak_days ?? 0}天</span>
        </div>
        <button
          type="button"
          onClick={() => onSelectView("scenes")}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            activeView === "scenes"
              ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
              : "bg-slate-900/90 border-slate-800 text-slate-300"
          }`}
        >
          <Grid2x2 className="w-3.5 h-3.5" />
          <span>场景库</span>
        </button>
      </div>
    </header>
  );
};

export const MobileBottomNav: React.FC<{
  activeView: AppView;
  onSelectView: (view: AppView) => void;
}> = ({ activeView, onSelectView }) => {
  const tabs: { id: AppView; label: string; icon: React.ReactNode; activeColor: string }[] = [
    {
      id: "scene1",
      label: "双物",
      icon: <Activity className="w-5 h-5" />,
      activeColor: "text-cyan-300 bg-cyan-500/15 border-cyan-400/35",
    },
    {
      id: "scene2",
      label: "色词",
      icon: <Palette className="w-5 h-5" />,
      activeColor: "text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-400/35",
    },
    {
      id: "scene3",
      label: "3D追踪",
      icon: <Eye className="w-5 h-5" />,
      activeColor: "text-sky-300 bg-sky-500/15 border-sky-400/35",
    },
    {
      id: "scene4",
      label: "急停",
      icon: <Timer className="w-5 h-5" />,
      activeColor: "text-amber-300 bg-amber-500/15 border-amber-400/35",
    },
    {
      id: "history",
      label: "档案",
      icon: <BarChart3 className="w-5 h-5" />,
      activeColor: "text-emerald-300 bg-emerald-500/15 border-emerald-400/35",
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/90 bg-[#080E1D]/95 backdrop-blur-xl px-2 pt-1.5 safe-bottom select-none">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectView(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl border transition-all duration-150 cursor-pointer ${
                active
                  ? tab.activeColor
                  : "border-transparent text-slate-400 active:scale-95"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-bold leading-none mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
