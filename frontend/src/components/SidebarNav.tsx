import React from "react";
import {
  Activity,
  BarChart3,
  Cpu,
  Eye,
  Flame,
  FolderOpen,
  Grid2x2,
  Palette,
  Sparkles,
  Timer,
} from "lucide-react";
import type { AppView, HealthResponse, StatsOverview } from "../types/game";

interface SidebarNavProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  disabled?: boolean;
  health: HealthResponse | null;
  stats: StatsOverview | null;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeView,
  onSelectView,
  disabled = false,
  health,
  stats,
}) => {
  const isMac =
    typeof window !== "undefined" &&
    (window.neuropulse?.platform === "darwin" || navigator.platform.toLowerCase().includes("mac"));

  const sceneItems: {
    id: AppView;
    label: string;
    sub: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      id: "scene1",
      label: "场景 1 · 双物反应",
      sub: "听觉播报 + 换手倒计时",
      icon: <Activity className="w-4 h-4" />,
      accent: "text-cyan-300 bg-cyan-400/20",
    },
    {
      id: "scene2",
      label: "场景 2 · Stroop",
      sub: "色词抗干扰 · 冲动抑制",
      icon: <Palette className="w-4 h-4" />,
      accent: "text-fuchsia-300 bg-fuchsia-400/20",
    },
    {
      id: "scene3",
      label: "场景 3 · 3D 追踪",
      sub: "Three.js 多球空间追踪",
      icon: <Eye className="w-4 h-4" />,
      accent: "text-sky-300 bg-sky-400/20",
    },
    {
      id: "scene4",
      label: "场景 4 · 听觉急停",
      sub: "Go / No-Go 急停反射",
      icon: <Timer className="w-4 h-4" />,
      accent: "text-amber-300 bg-amber-400/20",
    },
  ];

  const toolItems: { id: AppView; label: string; sub: string; icon: React.ReactNode }[] = [
    {
      id: "scenes",
      label: "训练场景库",
      sub: "全部 4 个专注力模块",
      icon: <Grid2x2 className="w-4 h-4" />,
    },
    {
      id: "history",
      label: "训练记录与统计",
      sub: "SQLite 本地专注档案",
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  const todayMin = Math.round((stats?.today_focus_sec ?? 0) / 60);

  return (
    <aside className="hidden md:flex w-64 shrink-0 h-full flex-col border-r border-slate-800/80 bg-[#090F1E]/95 backdrop-blur-xl select-none">
      {/* Draggable header with macOS traffic light clearance */}
      <div className={`ui-drag-region px-5 ${isMac ? "pt-11" : "pt-5"} pb-4 border-b border-slate-800/70`}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-orange-500 p-[1.5px] shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)]">
            <div className="w-full h-full rounded-[14.5px] bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white leading-tight">
              NeuroPulse
            </h1>
            <p className="text-[11px] text-cyan-300/80 font-medium">灵动反应 · 专注力工作室</p>
          </div>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-3 py-3.5 space-y-4 overflow-y-auto">
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            训练场景
          </div>
          <div className="space-y-1">
            {sceneItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectView(item.id)}
                  className={`ui-no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    active
                      ? "bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-transparent text-white border border-cyan-400/40 shadow-[0_0_20px_-6px_rgba(34,211,238,0.4)]"
                      : "text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-slate-100"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? item.accent : "bg-slate-900/90 text-slate-400"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            总览与档案
          </div>
          <div className="space-y-1">
            {toolItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectView(item.id)}
                  className={`ui-no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    active
                      ? "bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-transparent text-white border border-cyan-400/40 shadow-[0_0_20px_-6px_rgba(34,211,238,0.4)]"
                      : "text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-slate-100"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? "bg-cyan-400/20 text-cyan-300" : "bg-slate-900/90 text-slate-400"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Streak & Backend Status Footer */}
      <div className="p-3.5 space-y-2.5 border-t border-slate-800/70">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/90 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <Flame className="w-4 h-4" />
              <span>连续专注</span>
            </div>
            <span className="text-lg font-black tabular-nums text-white">
              {stats?.streak_days ?? 0}{" "}
              <span className="text-xs font-normal text-slate-400">天</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>今日已完成 {stats?.today_sessions ?? 0} 次</span>
            <span className="text-cyan-300 font-semibold">{todayMin} 分钟</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-950/75 border border-slate-800/70 text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                health ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 animate-pulse"
              }`}
            />
            <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-slate-400 truncate">
              {health
                ? health.db_path === "local-offline"
                  ? "本地离线引擎已就绪"
                  : "Python + SQLite 已就绪"
                : "正在连接本地服务..."}
            </span>
          </div>
          {window.neuropulse?.openDataFolder && (
            <button
              type="button"
              title="打开本地 SQLite 数据目录"
              onClick={() => window.neuropulse?.openDataFolder()}
              className="text-slate-500 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
