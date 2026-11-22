import React from "react";
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Target,
  Zap,
} from "lucide-react";
import { SCENE_META, type SceneId, type TrainingSession } from "../types/game";
import { PushButton } from "../components/uiverse/UiverseControls";

interface SessionSummaryModalProps {
  session: TrainingSession | null;
  onReplay: () => void;
  onBackToSetup: () => void;
  onViewHistory: () => void;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  session,
  onReplay,
  onBackToSetup,
  onViewHistory,
}) => {
  if (!session) return null;

  const meta =
    SCENE_META[session.scene_id as SceneId] ?? SCENE_META.scene_1_dual_object;
  const extra = (session.extra_metrics ?? {}) as Record<string, number | string | boolean>;

  const mins = Math.floor(session.actual_duration_sec / 60);
  const secs = session.actual_duration_sec % 60;
  const durationLabel = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;

  const isScene1 = session.scene_id === "scene_1_dual_object";
  const isScene2 = session.scene_id === "scene_2_stroop";
  const isScene3 = session.scene_id === "scene_3_mot_3d";
  const isScene4 = session.scene_id === "scene_4_gonogo";

  const pctA =
    session.total_cues > 0 ? Math.round((session.item_a_count / session.total_cues) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative max-w-lg w-full rounded-3xl border border-cyan-400/35 bg-gradient-to-b from-slate-900 to-[#080E1C] p-7 shadow-[0_0_80px_-15px_rgba(34,211,238,0.45)]">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-cyan-500/25 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,0.35)] mb-3">
            {session.completed ? (
              <Award className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold mb-2 ${meta.badgeClass}`}
          >
            {meta.shortTag}
          </span>
          <h2 className="text-2xl font-extrabold text-white">
            {session.completed ? "专注训练圆满完成！" : "已保存本次训练记录"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            训练数据已自动写入本地 SQLite 专注档案
          </p>

          {/* Focus Score Pill */}
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-2xl bg-slate-950/90 border border-slate-800 px-6 py-2.5">
            <span className="text-xs text-slate-400">本次专注评分</span>
            <span className="text-4xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300">
              {session.focus_score}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
        </div>

        {/* Scene-specific KPI grid */}
        {isScene1 && (
          <>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
                <Clock className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-white tabular-nums">{durationLabel}</div>
                <div className="text-[11px] text-slate-500">有效反应时长</div>
              </div>
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
                <Zap className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-white tabular-nums">
                  {session.total_cues} 次
                </div>
                <div className="text-[11px] text-slate-500">随机语音指令</div>
              </div>
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
                <ArrowLeftRight className="w-4 h-4 text-amber-300 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-white tabular-nums">
                  {session.swap_count_completed} 次
                </div>
                <div className="text-[11px] text-slate-500">完成中途换手</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-950/75 border border-slate-800/80 p-4">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-cyan-300">
                  {session.item_a} · {session.item_a_count}次 ({pctA}%)
                </span>
                <span className="text-orange-300">
                  {session.item_b} · {session.item_b_count}次 ({pctB}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-sky-500"
                  style={{ width: `${pctA}%` }}
                />
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{ width: `${pctB}%` }}
                />
              </div>
            </div>
          </>
        )}

        {isScene2 && (
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white tabular-nums">
                {Number(extra.accuracy_pct ?? 0)}%
              </div>
              <div className="text-[11px] text-slate-500">
                正确率 ({session.item_a_count}/{session.total_cues})
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
              <Zap className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white tabular-nums">
                {Number(extra.avg_reaction_ms ?? 0) > 0 ? `${extra.avg_reaction_ms}ms` : "--"}
              </div>
              <div className="text-[11px] text-slate-500">平均反应速度</div>
            </div>
            <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
              <Flame className="w-4 h-4 text-amber-300 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white tabular-nums">
                x{Number(extra.max_combo ?? session.swap_count_completed)}
              </div>
              <div className="text-[11px] text-slate-500">最高连击数</div>
            </div>
          </div>
        )}

        {isScene3 && (
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
              <Target className="w-4 h-4 text-sky-300 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white tabular-nums">
                {Number(extra.accuracy_pct ?? 0)}%
              </div>
              <div className="text-[11px] text-slate-500">空间锁定命中率</div>
            </div>
            <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white tabular-nums">
                {session.item_a_count}/{session.total_cues}
              </div>
              <div className="text-[11px] text-slate-500">命中目标光球</div>
            </div>
            <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
              <Award className="w-4 h-4 text-amber-300 mx-auto mb-1" />
              <div className="text-lg font-extrabold text-white tabular-nums">
                {Number(extra.perfect_rounds ?? session.swap_count_completed)} 轮
              </div>
              <div className="text-[11px] text-slate-500">全中完美轮次</div>
            </div>
          </div>
        )}

        {isScene4 && (
          <>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
                <ShieldCheck className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-white tabular-nums">
                  {Number(extra.accuracy_pct ?? 0)}%
                </div>
                <div className="text-[11px] text-slate-500">综合精准度</div>
              </div>
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
                <Zap className="w-4 h-4 text-amber-300 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-white tabular-nums">
                  {Number(extra.avg_reaction_ms ?? 0) > 0 ? `${extra.avg_reaction_ms}ms` : "--"}
                </div>
                <div className="text-[11px] text-slate-500">平均拍击速度</div>
              </div>
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5 text-center">
                <CheckCircle2 className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
                <div className="text-lg font-extrabold text-white tabular-nums">
                  {Number(extra.nogo_inhibits ?? session.item_b_count)} 次
                </div>
                <div className="text-[11px] text-slate-500">成功急停克制</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-5 text-xs text-slate-400">
              <span>行动命中：{Number(extra.go_hits ?? session.item_a_count)}</span>
              <span>漏击超时：{Number(extra.go_misses ?? 0)}</span>
              <span className="text-rose-400">
                冲动误触：{Number(extra.false_alarms ?? session.swap_count_completed)}
              </span>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {isScene1 ? (
            <PushButton variant="cyan" size="md" onClick={onReplay} className="flex-1">
              <RotateCcw className="w-4 h-4" />
              <span>再来一局</span>
            </PushButton>
          ) : (
            <PushButton variant="cyan" size="md" onClick={onBackToSetup} className="flex-1">
              <RotateCcw className="w-4 h-4" />
              <span>返回场景继续练</span>
            </PushButton>
          )}
          {isScene1 && (
            <PushButton variant="ghost" size="md" onClick={onBackToSetup}>
              <Sliders className="w-4 h-4" />
              <span>调整配置</span>
            </PushButton>
          )}
          <button
            type="button"
            onClick={onViewHistory}
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 px-2 py-2 cursor-pointer"
          >
            查看档案 →
          </button>
        </div>
      </div>
    </div>
  );
};
