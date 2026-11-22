import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Compass,
  Eye,
  Play,
  Sparkles,
  Square,
  Target,
} from "lucide-react";
import type { SessionPayload, UserSettings } from "../types/game";
import { Mot3DCanvas, type MotPhase } from "../components/Mot3DCanvas";
import { soundFx } from "../services/soundFx";
import {
  GlowToggle,
  PushButton,
  SegmentedControl,
  TactileCard,
} from "../components/uiverse/UiverseControls";

interface Scene3MotViewProps {
  settings: UserSettings;
  onPlayingChange: (playing: boolean) => void;
  onSessionComplete: (payload: SessionPayload) => void;
}

type MotDifficulty = "easy" | "standard" | "master";

const PRESETS: Record<
  MotDifficulty,
  { ballCount: number; targetCount: number; speedScale: number; rounds: number; trackSec: number }
> = {
  easy: { ballCount: 6, targetCount: 2, speedScale: 0.85, rounds: 4, trackSec: 6 },
  standard: { ballCount: 8, targetCount: 3, speedScale: 1.1, rounds: 5, trackSec: 7 },
  master: { ballCount: 10, targetCount: 4, speedScale: 1.38, rounds: 6, trackSec: 8 },
};

function pickRandomTargets(total: number, count: number): number[] {
  const arr = Array.from({ length: total }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count).sort((a, b) => a - b);
}

export const Scene3MotView: React.FC<Scene3MotViewProps> = ({
  settings,
  onPlayingChange,
  onSessionComplete,
}) => {
  // Setup config
  const [difficulty, setDifficulty] = useState<MotDifficulty>("standard");
  const [ballCount, setBallCount] = useState(8);
  const [targetCount, setTargetCount] = useState(3);
  const [speedScale, setSpeedScale] = useState(1.1);
  const [totalRounds, setTotalRounds] = useState(5);
  const [trackSec, setTrackSec] = useState(7);
  const [enableOrbit, setEnableOrbit] = useState(true);

  // Runtime state
  const [isPlaying, setIsPlaying] = useState(false);
  const [roundIdx, setRoundIdx] = useState(1);
  const [roundKey, setRoundKey] = useState(0);
  const [phase, setPhase] = useState<MotPhase>("highlight");
  const [phaseSecLeft, setPhaseSecLeft] = useState(2.6);
  const [targetIndices, setTargetIndices] = useState<number[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [roundBanner, setRoundBanner] = useState("");

  // Session score accumulators
  const [totalHits, setTotalHits] = useState(0);
  const [totalTargetsSoFar, setTotalTargetsSoFar] = useState(0);
  const [perfectRounds, setPerfectRounds] = useState(0);

  const runRef = useRef({
    startedAtIso: "",
    startPerfMs: 0,
    hits: 0,
    targets: 0,
    perfects: 0,
    roundsDone: 0,
    finished: false,
  });

  useEffect(() => {
    onPlayingChange(isPlaying);
    return () => onPlayingChange(false);
  }, [isPlaying, onPlayingChange]);

  const applyPreset = (d: MotDifficulty) => {
    setDifficulty(d);
    const p = PRESETS[d];
    setBallCount(p.ballCount);
    setTargetCount(p.targetCount);
    setSpeedScale(p.speedScale);
    setTotalRounds(p.rounds);
    setTrackSec(p.trackSec);
  };

  const finishSession = useCallback(
    (completed: boolean) => {
      const r = runRef.current;
      if (r.finished) return;
      r.finished = true;
      setIsPlaying(false);

      const elapsedSec = Math.max(1, Math.round((performance.now() - r.startPerfMs) / 1000));
      if (!completed && r.roundsDone === 0) {
        return;
      }
      const acc = r.targets > 0 ? Math.round((r.hits / r.targets) * 100) : 0;
      const score = Math.min(100, Math.max(10, Math.round(acc * 0.9 + (completed ? 10 : 0))));

      if (completed && settings.sound_fx_enabled) {
        soundFx.playSessionComplete(0.45);
      }

      onSessionComplete({
        scene_id: "scene_3_mot_3d",
        item_a: `${ballCount}球追${targetCount}球`,
        item_b: `${r.roundsDone}/${totalRounds}轮`,
        configured_duration_sec: totalRounds * (trackSec + 5),
        actual_duration_sec: elapsedSec,
        total_cues: r.targets,
        item_a_count: r.hits,
        item_b_count: Math.max(0, r.targets - r.hits),
        swap_count_completed: r.perfects,
        swap_countdown_sec: trackSec,
        min_interval_ms: Math.round(speedScale * 1000),
        max_interval_ms: Math.round(speedScale * 1000),
        blind_mode: enableOrbit,
        completed,
        focus_score_override: score,
        extra_metrics: {
          accuracy_pct: acc,
          hits: r.hits,
          total_targets: r.targets,
          perfect_rounds: r.perfects,
          rounds_completed: r.roundsDone,
          total_rounds: totalRounds,
          ball_count: ballCount,
          target_count: targetCount,
        },
        started_at: r.startedAtIso,
        ended_at: new Date().toISOString(),
      });
    },
    [
      ballCount,
      enableOrbit,
      onSessionComplete,
      settings.sound_fx_enabled,
      speedScale,
      targetCount,
      totalRounds,
      trackSec,
    ]
  );

  const launchRound = useCallback(
    (nextRoundNum: number) => {
      const targets = pickRandomTargets(ballCount, targetCount);
      setRoundIdx(nextRoundNum);
      setRoundKey((k) => k + 1);
      setTargetIndices(targets);
      setSelectedIndices([]);
      setPhase("highlight");
      setPhaseSecLeft(2.6);
      setRoundBanner(`第 ${nextRoundNum} / ${totalRounds} 轮 · 牢记这 ${targetCount} 颗青色光球`);
      if (settings.sound_fx_enabled) soundFx.playTargetLock(0.38);
    },
    [ballCount, settings.sound_fx_enabled, targetCount, totalRounds]
  );

  const handleStart = () => {
    soundFx.unlock();
    runRef.current = {
      startedAtIso: new Date().toISOString(),
      startPerfMs: performance.now(),
      hits: 0,
      targets: 0,
      perfects: 0,
      roundsDone: 0,
      finished: false,
    };
    setTotalHits(0);
    setTotalTargetsSoFar(0);
    setPerfectRounds(0);
    setIsPlaying(true);
    launchRound(1);
  };

  // Phase timers for highlight -> tracking -> recall, and reveal -> next round
  useEffect(() => {
    if (!isPlaying) return;

    if (phase === "highlight" || phase === "tracking") {
      const durationMs = phase === "highlight" ? 2600 : trackSec * 1000;
      const start = performance.now();
      let rafId = 0;

      const step = (now: number) => {
        const rem = Math.max(0, (durationMs - (now - start)) / 1000);
        setPhaseSecLeft(rem);
        if (now - start >= durationMs) {
          if (phase === "highlight") {
            setPhase("tracking");
            setRoundBanner("全神贯注追踪目标球的 3D 运动轨迹！");
          } else {
            setPhase("recall");
            setRoundBanner(`请用鼠标直接点击 3D 场景中的 ${targetCount} 颗目标球`);
            if (settings.sound_fx_enabled) soundFx.playResumeChime(0.35);
          }
          return;
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(rafId);
    }

    if (phase === "reveal") {
      const timer = window.setTimeout(() => {
        if (runRef.current.finished) return;
        if (roundIdx >= totalRounds) {
          finishSession(true);
        } else {
          launchRound(roundIdx + 1);
        }
      }, 2100);
      return () => window.clearTimeout(timer);
    }
  }, [
    finishSession,
    isPlaying,
    launchRound,
    phase,
    roundIdx,
    settings.sound_fx_enabled,
    targetCount,
    totalRounds,
    trackSec,
  ]);

  const handleToggleSelect = useCallback(
    (ballIdx: number) => {
      if (phase !== "recall") return;
      setSelectedIndices((prev) => {
        if (prev.includes(ballIdx)) {
          return prev.filter((id) => id !== ballIdx);
        }
        if (prev.length >= targetCount) return prev;
        if (settings.sound_fx_enabled) soundFx.playTargetLock(0.28);
        return [...prev, ballIdx];
      });
    },
    [phase, settings.sound_fx_enabled, targetCount]
  );

  const handleConfirmSelection = useCallback(() => {
    if (phase !== "recall" || selectedIndices.length !== targetCount) return;

    const targetSet = new Set(targetIndices);
    const hits = selectedIndices.filter((idx) => targetSet.has(idx)).length;
    const isPerfect = hits === targetCount;

    runRef.current.hits += hits;
    runRef.current.targets += targetCount;
    runRef.current.roundsDone += 1;
    if (isPerfect) runRef.current.perfects += 1;

    setTotalHits(runRef.current.hits);
    setTotalTargetsSoFar(runRef.current.targets);
    setPerfectRounds(runRef.current.perfects);
    setPhase("reveal");
    setRoundBanner(
      isPerfect
        ? `完美锁定！本轮 ${hits}/${targetCount} 全部命中`
        : `本轮命中 ${hits}/${targetCount}（翠绿=正确 · 青色=漏选 · 玫红=误选）`
    );

    if (settings.sound_fx_enabled) {
      if (isPerfect) soundFx.playSuccessHit(0.45);
      else soundFx.playErrorBuzz(0.32);
    }
  }, [phase, selectedIndices, settings.sound_fx_enabled, targetCount, targetIndices]);

  // Enter submits selection during recall; Esc aborts
  useEffect(() => {
    if (!isPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && phase === "recall" && selectedIndices.length === targetCount) {
        handleConfirmSelection();
      } else if (e.key === "Escape") {
        finishSession(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishSession, handleConfirmSelection, isPlaying, phase, selectedIndices.length, targetCount]);

  if (isPlaying) {
    return (
      <div className="h-full w-full flex flex-col bg-[#050914] select-none overflow-hidden">
        {/* Top HUD */}
        <header className="px-6 pt-5 pb-2 z-10">
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="rounded-xl bg-sky-500/20 border border-sky-400/40 px-3 py-1 font-extrabold text-sky-200">
                第 {roundIdx} / {totalRounds} 轮
              </span>
              <span className="text-slate-300 font-semibold">{roundBanner}</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-400 flex items-center gap-3 tabular-nums">
                <span>
                  累计命中{" "}
                  <strong className="text-emerald-300">
                    {totalHits}/{totalTargetsSoFar}
                  </strong>
                </span>
                <span>
                  完美轮 <strong className="text-cyan-300">{perfectRounds}</strong>
                </span>
              </div>
              <PushButton variant="rose" size="sm" onClick={() => finishSession(false)}>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>结束追踪</span>
              </PushButton>
            </div>
          </div>
        </header>

        {/* Interactive Three.js 3D Arena */}
        <div className="relative flex-1 mx-6 my-2 rounded-3xl border border-sky-500/25 bg-gradient-to-b from-slate-950 via-[#070E1F] to-slate-950 overflow-hidden shadow-[inset_0_0_80px_rgba(14,165,233,0.08)]">
          <Mot3DCanvas
            roundKey={roundKey}
            ballCount={ballCount}
            targetIndices={targetIndices}
            phase={phase}
            speedScale={speedScale}
            enableOrbit={enableOrbit}
            selectedIndices={selectedIndices}
            onToggleSelect={handleToggleSelect}
          />

          {/* Floating Phase Pill */}
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2">
            {(phase === "highlight" || phase === "tracking") && (
              <div className="rounded-full bg-slate-950/85 border border-sky-400/40 px-4 py-1.5 text-xs font-bold text-sky-200 shadow-lg backdrop-blur-md tabular-nums">
                {phase === "highlight" ? "记忆目标" : "3D 追踪倒计时"} ·{" "}
                {phaseSecLeft.toFixed(1)}s
              </div>
            )}
          </div>
        </div>

        {/* Bottom Selection Bar */}
        <footer className="px-6 pb-5 pt-2 z-10">
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-950/80 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <Target className="w-4 h-4 text-amber-300" />
              {phase === "recall" ? (
                <span>
                  已选定{" "}
                  <strong className="text-amber-300 tabular-nums">
                    {selectedIndices.length} / {targetCount}
                  </strong>{" "}
                  颗球（点击已选球可取消重选）
                </span>
              ) : phase === "reveal" ? (
                <span className="text-emerald-300 font-semibold">
                  正在结算本轮结果，即将进入下一轮...
                </span>
              ) : (
                <span className="text-slate-400">
                  保持视线居中，用余光同时锁定 {targetCount} 颗目标球在 3D 立方体内的空间轨迹
                </span>
              )}
            </div>

            <PushButton
              variant="emerald"
              size="sm"
              disabled={phase !== "recall" || selectedIndices.length !== targetCount}
              onClick={handleConfirmSelection}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>确认锁定答案 (Enter)</span>
            </PushButton>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-7 pt-7 pb-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 via-[#0A1326] to-slate-950 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-[11px] font-bold text-sky-200 mb-3">
                <Eye className="w-3.5 h-3.5" />
                <span>场景 3 · 3D 多球视觉追踪 (MOT)</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                三维空间动态目标追踪，拓展多点注意广度
              </h2>
              <p className="text-sm text-slate-300/85 mt-2 leading-relaxed">
                基于 Three.js 实时物理碰撞渲染：每轮先记住发光的青色目标球，在所有光球变为同色并高速三维交错运动后，用鼠标直接点选出所有目标球。
              </p>
            </div>
            <PushButton
              variant="cyan"
              size="lg"
              onClick={handleStart}
              className="min-w-[205px] shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>开始 3D 视觉追踪</span>
            </PushButton>
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Sparkles className="w-4 h-4 text-sky-300" />
              <span>难度预设与球数微调</span>
            </div>

            <SegmentedControl<MotDifficulty>
              options={[
                { value: "easy", label: "入门模式", hint: "6球追2 · 慢速" },
                { value: "standard", label: "标准模式", hint: "8球追3 · 中速" },
                { value: "master", label: "大师空间", hint: "10球追4 · 高速" },
              ]}
              value={difficulty}
              onChange={applyPreset}
              className="w-full justify-between"
            />

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>场内总球数</span>
                  <span className="text-sky-300 font-bold tabular-nums">{ballCount} 颗</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={12}
                  step={1}
                  value={ballCount}
                  onChange={(e) => {
                    const nextTotal = Number(e.target.value);
                    setBallCount(nextTotal);
                    setTargetCount((t) => Math.min(t, Math.max(2, nextTotal - 2)));
                  }}
                  className="np-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>需追踪目标球</span>
                  <span className="text-cyan-300 font-bold tabular-nums">{targetCount} 颗</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={Math.min(5, ballCount - 2)}
                  step={1}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  className="np-slider w-full"
                />
              </div>
            </div>
          </TactileCard>

          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Compass className="w-4 h-4 text-cyan-300" />
              <span>运动速度、轮数与三维视差</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>训练轮数</span>
                  <span className="text-white font-bold tabular-nums">{totalRounds} 轮</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={8}
                  step={1}
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                  className="np-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>单轮追踪时长</span>
                  <span className="text-white font-bold tabular-nums">{trackSec} 秒</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={12}
                  step={1}
                  value={trackSec}
                  onChange={(e) => setTrackSec(Number(e.target.value))}
                  className="np-slider w-full"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>球体运动速度倍率</span>
                <span className="text-amber-300 font-bold tabular-nums">
                  {speedScale.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.65}
                step={0.05}
                value={speedScale}
                onChange={(e) => setSpeedScale(Number(e.target.value))}
                className="np-slider w-full"
              />
            </div>

            <div className="pt-2 border-t border-slate-800/70">
              <GlowToggle
                checked={enableOrbit}
                onChange={setEnableOrbit}
                label="3D 动态摄像机缓动视差"
                description="追踪期间镜头柔和摆动，真实强化三维纵深空间判断力"
              />
            </div>
          </TactileCard>
        </div>
      </div>
    </div>
  );
};
