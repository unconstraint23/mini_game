import React from "react";
import {
  ArrowLeftRight,
  Calendar,
  Clock,
  EyeOff,
  Flame,
  Play,
  Trash2,
  Zap,
} from "lucide-react";
import type { StatsOverview, TrainingSession } from "../types/game";
import { TactileCard } from "../components/uiverse/UiverseControls";

interface HistoryViewProps {
  stats: StatsOverview | null;
  sessions: TrainingSession[];
  onReplayConfig: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: number) => Promise<void>;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  return s === 0 ? `${m}分钟` : `${m}分${s}秒`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  stats,
  sessions,
  onReplayConfig,
  onDeleteSession,
}) => {
  const maxDaySec = Math.max(
    60,
    ...(stats?.recent_7_days.map((d) => d.duration_sec) ?? [60])
  );

  return (
    <div className="h-full w-full overflow-y-auto px-7 pt-7 pb-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">训练记录与专注统计</h2>
          <p className="text-xs text-slate-400 mt-1">
            由本地 Python + SQLite 数据库持久化记录，追踪你的反应力与专注力成长曲线
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TactileCard className="p-4">
            <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
              <Flame className="w-4 h-4" />
              <span>连续专注天数</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {stats?.streak_days ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">天</span>
            </div>
          </TactileCard>

          <TactileCard className="p-4">
            <div className="flex items-center gap-2 text-xs text-cyan-300 font-semibold">
              <Clock className="w-4 h-4" />
              <span>累计专注时长</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {Math.round((stats?.total_focus_sec ?? 0) / 60)}
              <span className="text-xs font-normal text-slate-400 ml-1">分钟</span>
            </div>
          </TactileCard>

          <TactileCard className="p-4">
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
              <Zap className="w-4 h-4" />
              <span>累计反应指令</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {stats?.total_cues ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">次</span>
            </div>
          </TactileCard>

          <TactileCard className="p-4">
            <div className="flex items-center gap-2 text-xs text-orange-300 font-semibold">
              <ArrowLeftRight className="w-4 h-4" />
              <span>累计中途换手</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {stats?.total_swaps ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">次</span>
            </div>
          </TactileCard>
        </div>

        {/* 7-Day Activity Chart */}
        <TactileCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-bold text-white">近 7 天专注活跃度</h3>
            </div>
            <span className="text-xs text-slate-400">
              总计 {stats?.total_sessions ?? 0} 次训练（完成 {stats?.completed_sessions ?? 0} 次）
            </span>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-36 pt-3">
            {(stats?.recent_7_days ?? []).map((day) => {
              const pct = day.duration_sec > 0 ? Math.max(12, Math.round((day.duration_sec / maxDaySec) * 100)) : 5;
              const shortDate = day.date.slice(5);
              return (
                <div key={day.date} className="flex flex-col items-center h-full justify-end gap-2">
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {day.duration_sec > 0 ? `${Math.round(day.duration_sec / 60)}m` : ""}
                  </div>
                  <div className="w-full max-w-[44px] flex-1 flex items-end">
                    <div
                      title={`${day.date}: ${day.sessions} 次训练 · ${formatDuration(day.duration_sec)} · ${day.cues} 次指令`}
                      className={`w-full rounded-t-xl transition-all duration-300 ${
                        day.duration_sec > 0
                          ? "bg-gradient-to-t from-cyan-600 via-cyan-400 to-sky-300 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]"
                          : "bg-slate-800/70"
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">{shortDate}</div>
                </div>
              );
            })}
          </div>
        </TactileCard>

        {/* Sessions History Table */}
        <TactileCard className="p-6">
          <h3 className="text-sm font-bold text-white mb-4">近期训练明细</h3>

          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              还没有训练记录，去「场景 1 · 双物反应」开启你的第一次专注挑战吧！
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950/75 border border-slate-800/80 px-4 py-3.5 hover:border-cyan-500/35 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/15 to-orange-500/15 border border-slate-700/70 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-black tabular-nums text-cyan-300">
                        {s.focus_score}
                      </span>
                      <span className="text-[9px] text-slate-500">评分</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-cyan-200">{s.item_a}</span>
                        <span className="text-slate-600 text-xs">⇄</span>
                        <span className="text-sm font-bold text-orange-200">{s.item_b}</span>
                        {s.blind_mode && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 text-indigo-300 px-2 py-0.5 text-[10px]">
                            <EyeOff className="w-2.5 h-2.5" />
                            盲听
                          </span>
                        )}
                        {!s.completed && (
                          <span className="rounded-full bg-slate-800 text-slate-400 px-2 py-0.5 text-[10px]">
                            提前结束
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-3">
                        <span>{formatDateTime(s.ended_at)}</span>
                        <span>有效时长 {formatDuration(s.actual_duration_sec)}</span>
                        <span>指令 {s.total_cues} 次</span>
                        <span>换手 {s.swap_count_completed} 次</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReplayConfig(s)}
                      className="ui-chip text-cyan-200 border-cyan-500/30"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>复现配置</span>
                    </button>
                    <button
                      type="button"
                      title="删除此记录"
                      onClick={() => onDeleteSession(s.id)}
                      className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/40 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TactileCard>
      </div>
    </div>
  );
};
