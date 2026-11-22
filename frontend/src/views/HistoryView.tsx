import React, { useState } from "react";
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
import {
  SCENE_META,
  type AppView,
  type SceneId,
  type StatsOverview,
  type TrainingSession,
} from "../types/game";
import { TactileCard } from "../components/uiverse/UiverseControls";

interface HistoryViewProps {
  stats: StatsOverview | null;
  sessions: TrainingSession[];
  onReplayConfig: (session: TrainingSession) => void;
  onJumpScene: (view: AppView) => void;
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

function sceneIdToView(sceneId: string): AppView {
  if (sceneId === "scene_2_stroop") return "scene2";
  if (sceneId === "scene_3_mot_3d") return "scene3";
  if (sceneId === "scene_4_gonogo") return "scene4";
  return "scene1";
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  stats,
  sessions,
  onReplayConfig,
  onJumpScene,
  onDeleteSession,
}) => {
  const [filterScene, setFilterScene] = useState<"all" | SceneId>("all");

  const filteredSessions =
    filterScene === "all"
      ? sessions
      : sessions.filter((s) => s.scene_id === filterScene);

  const maxDaySec = Math.max(
    60,
    ...(stats?.recent_7_days.map((d) => d.duration_sec) ?? [60])
  );

  return (
    <div className="h-full w-full overflow-y-auto px-4 sm:px-7 pt-4 sm:pt-7 pb-24 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">训练记录与专注统计</h2>
          <p className="text-xs text-slate-400 mt-1">
            本地离线安全持久化记录全部 4 大场景的反应力与专注力成长档案
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
              <span>累计训练事件</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {stats?.total_cues ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">次</span>
            </div>
          </TactileCard>

          <TactileCard className="p-4">
            <div className="flex items-center gap-2 text-xs text-orange-300 font-semibold">
              <ArrowLeftRight className="w-4 h-4" />
              <span>总计完成训练</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {stats?.total_sessions ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">局</span>
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
              const pct =
                day.duration_sec > 0
                  ? Math.max(12, Math.round((day.duration_sec / maxDaySec) * 100))
                  : 5;
              const shortDate = day.date.slice(5);
              return (
                <div key={day.date} className="flex flex-col items-center h-full justify-end gap-2">
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {day.duration_sec >= 60
                      ? `${Math.round(day.duration_sec / 60)}m`
                      : day.duration_sec > 0
                        ? `${day.duration_sec}s`
                        : ""}
                  </div>
                  <div className="w-full max-w-[44px] flex-1 flex items-end">
                    <div
                      title={`${day.date}: ${day.sessions} 次训练 · ${formatDuration(day.duration_sec)} · ${day.cues} 次事件`}
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

        {/* Sessions History List with Scene Filter */}
        <TactileCard className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-white">近期训练明细</h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: "全部场景" },
                  { id: "scene_1_dual_object", label: "场景 1" },
                  { id: "scene_2_stroop", label: "场景 2" },
                  { id: "scene_3_mot_3d", label: "场景 3" },
                  { id: "scene_4_gonogo", label: "场景 4" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterScene(tab.id)}
                  className={`ui-chip text-xs ${filterScene === tab.id ? "ui-chip--active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              当前筛选下暂无训练记录，去左侧任意训练场景开启一次挑战吧！
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSessions.map((s) => {
                const meta =
                  SCENE_META[s.scene_id as SceneId] ?? SCENE_META.scene_1_dual_object;
                const extra = (s.extra_metrics ?? {}) as Record<
                  string,
                  number | string | boolean
                >;

                return (
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
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.shortTag}
                          </span>
                          <span className="text-sm font-bold text-slate-100">
                            {s.item_a}
                            {s.scene_id === "scene_1_dual_object" ? " ⇄ " : " · "}
                            {s.item_b}
                          </span>
                          {s.blind_mode && s.scene_id !== "scene_3_mot_3d" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 text-indigo-300 px-2 py-0.5 text-[10px]">
                              <EyeOff className="w-2.5 h-2.5" />
                              {s.scene_id === "scene_2_stroop" ? "语音干扰" : "盲听"}
                            </span>
                          )}
                          {!s.completed && (
                            <span className="rounded-full bg-slate-800 text-slate-400 px-2 py-0.5 text-[10px]">
                              提前结束
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-3">
                          <span>{formatDateTime(s.ended_at)}</span>
                          <span>时长 {formatDuration(s.actual_duration_sec)}</span>
                          {s.scene_id === "scene_1_dual_object" && (
                            <>
                              <span>指令 {s.total_cues} 次</span>
                              <span>换手 {s.swap_count_completed} 次</span>
                            </>
                          )}
                          {s.scene_id === "scene_2_stroop" && (
                            <>
                              <span>正确率 {Number(extra.accuracy_pct ?? 0)}%</span>
                              <span>均速 {Number(extra.avg_reaction_ms ?? 0)}ms</span>
                              <span>最高连击 x{Number(extra.max_combo ?? s.swap_count_completed)}</span>
                            </>
                          )}
                          {s.scene_id === "scene_3_mot_3d" && (
                            <>
                              <span>
                                命中 {s.item_a_count}/{s.total_cues} ({Number(extra.accuracy_pct ?? 0)}%)
                              </span>
                              <span>完美轮 {Number(extra.perfect_rounds ?? s.swap_count_completed)}</span>
                            </>
                          )}
                          {s.scene_id === "scene_4_gonogo" && (
                            <>
                              <span>精准度 {Number(extra.accuracy_pct ?? 0)}%</span>
                              <span>均速 {Number(extra.avg_reaction_ms ?? 0)}ms</span>
                              <span>急停 {Number(extra.nogo_inhibits ?? s.item_b_count)} 次</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.scene_id === "scene_1_dual_object" ? (
                        <button
                          type="button"
                          onClick={() => onReplayConfig(s)}
                          className="ui-chip text-cyan-200 border-cyan-500/30"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>复现配置</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onJumpScene(sceneIdToView(s.scene_id))}
                          className="ui-chip text-cyan-200 border-cyan-500/30"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>再去练</span>
                        </button>
                      )}
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
                );
              })}
            </div>
          )}
        </TactileCard>
      </div>
    </div>
  );
};
