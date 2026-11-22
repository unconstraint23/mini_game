import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  EyeOff,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  CueEvent,
  PlayPhase,
  Scene1Plan,
  SessionPayload,
  UserSettings,
} from "../types/game";
import { Scene3DStage, type ActiveCueSignal } from "../components/Scene3DStage";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { PushButton } from "../components/uiverse/UiverseControls";
import { speechManager } from "../services/speech";
import { soundFx } from "../services/soundFx";

interface Scene1PlayViewProps {
  plan: Scene1Plan;
  settings: UserSettings;
  nativeTtsAvailable: boolean;
  onFinish: (payload: SessionPayload) => void;
  onCancel: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export const Scene1PlayView: React.FC<Scene1PlayViewProps> = ({
  plan,
  settings,
  nativeTtsAvailable,
  onFinish,
  onCancel,
}) => {
  const [phase, setPhase] = useState<PlayPhase>("ready");
  const [readyCount, setReadyCount] = useState(3);
  const [activeElapsedMs, setActiveElapsedMs] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);

  // Swap countdown states
  const [swapWaitingSpeech, setSwapWaitingSpeech] = useState(false);
  const [swapSecondsRemaining, setSwapSecondsRemaining] = useState(plan.swap_countdown_sec);
  const [swapProgress, setSwapProgress] = useState(0);

  // Live cue feedback
  const [activeCue, setActiveCue] = useState<ActiveCueSignal | null>(null);
  const [lastCueLabel, setLastCueLabel] = useState<string>("等待首个指令...");
  const [lastCueKind, setLastCueKind] = useState<"item_a" | "item_b" | null>(null);
  const [recentCues, setRecentCues] = useState<CueEvent[]>([]);
  const [mutedFx, setMutedFx] = useState(!settings.sound_fx_enabled);

  // Live counters
  const [counts, setCounts] = useState({ total: 0, a: 0, b: 0, swaps: 0 });

  // Mutable engine refs for drift-free 60fps loop
  const engineRef = useRef({
    phase: "ready" as PlayPhase,
    startedAtIso: new Date().toISOString(),
    activeElapsedMs: 0,
    nextEventIdx: 0,
    isSwapped: false,
    swapWaitingSpeech: false,
    swapElapsedMs: 0,
    swapTotalMs: plan.swap_countdown_sec * 1000,
    lastSpokenCountdown: -1,
    totalCues: 0,
    itemACount: 0,
    itemBCount: 0,
    swapsCompleted: 0,
    finished: false,
    mutedFx: !settings.sound_fx_enabled,
    unmounted: false,
  });

  useEffect(() => {
    engineRef.current.mutedFx = mutedFx;
  }, [mutedFx]);

  const speakOptions = useCallback(
    () => ({
      rate: settings.speech_rate,
      volume: settings.speech_volume,
      engine: settings.tts_engine,
      voiceName: settings.voice_name,
      nativeAvailable: nativeTtsAvailable,
    }),
    [settings, nativeTtsAvailable]
  );

  const finalizeSession = useCallback(
    (completed: boolean) => {
      const eng = engineRef.current;
      if (eng.finished) return;
      eng.finished = true;
      eng.phase = "completed";
      setPhase("completed");

      speechManager.stop();
      if (completed) {
        if (!eng.mutedFx) {
          soundFx.playSessionComplete(0.5);
        }
        void speechManager.speak("训练完成，干得漂亮", speakOptions());
      }

      const payload: SessionPayload = {
        scene_id: "scene_1_dual_object",
        item_a: plan.item_a,
        item_b: plan.item_b,
        configured_duration_sec: plan.duration_sec,
        actual_duration_sec: Math.min(
          plan.duration_sec,
          Math.max(1, Math.round(eng.activeElapsedMs / 1000))
        ),
        total_cues: eng.totalCues,
        item_a_count: eng.itemACount,
        item_b_count: eng.itemBCount,
        swap_count_completed: eng.swapsCompleted,
        swap_countdown_sec: plan.swap_countdown_sec,
        min_interval_ms: settings.min_interval_ms,
        max_interval_ms: settings.max_interval_ms,
        blind_mode: settings.blind_mode,
        completed,
        started_at: eng.startedAtIso,
        ended_at: new Date().toISOString(),
      };

      onFinish(payload);
    },
    [onFinish, plan, settings, speakOptions]
  );

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (eng.phase === "playing") {
      eng.phase = "paused";
      setPhase("paused");
      speechManager.stop();
    } else if (eng.phase === "paused") {
      eng.phase = "playing";
      setPhase("playing");
    }
  }, []);

  const handleAbort = useCallback(() => {
    const eng = engineRef.current;
    speechManager.stop();
    if (eng.activeElapsedMs >= 5000 && eng.totalCues > 0) {
      finalizeSession(false);
    } else {
      eng.finished = true;
      onCancel();
    }
  }, [finalizeSession, onCancel]);

  // Keyboard shortcuts: Space (Pause/Resume), Escape (Stop)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.code === "Escape") {
        e.preventDefault();
        handleAbort();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause, handleAbort]);

  // Initial quick 3-2-1 prep sequence
  useEffect(() => {
    let cancelled = false;
    engineRef.current.unmounted = false;
    soundFx.unlock();

    const runReady = async () => {
      for (const n of [3, 2, 1]) {
        if (cancelled) return;
        setReadyCount(n);
        if (!engineRef.current.mutedFx) {
          soundFx.playCountdownTick(n, 0.35);
        }
        await new Promise((r) => setTimeout(r, 650));
      }
      if (cancelled) return;

      if (!engineRef.current.mutedFx) {
        soundFx.playResumeChime(0.45);
      }
      engineRef.current.startedAtIso = new Date().toISOString();
      engineRef.current.phase = "playing";
      setPhase("playing");
      void speechManager.speak("开始", speakOptions());
    };

    void runReady();
    return () => {
      cancelled = true;
      engineRef.current.unmounted = true;
      speechManager.stop();
    };
  }, [speakOptions]);

  // Main monotonic 60fps game loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    const totalDurationMs = plan.duration_sec * 1000;

    const triggerHandSwap = (ev: CueEvent) => {
      const eng = engineRef.current;
      eng.phase = "swapping";
      eng.swapWaitingSpeech = true;
      eng.swapTotalMs = Math.max(3, ev.countdown_sec || plan.swap_countdown_sec) * 1000;
      eng.swapElapsedMs = 0;
      eng.lastSpokenCountdown = -1;

      setPhase("swapping");
      setSwapWaitingSpeech(true);
      setSwapSecondsRemaining(Math.round(eng.swapTotalMs / 1000));
      setSwapProgress(0);

      if (!eng.mutedFx) {
        soundFx.playSwapAlert(0.5);
      }

      // Faithfully speak "请换手" FIRST, then immediately start the exact 5-second countdown!
      const safetyRelease = setTimeout(() => {
        if (!eng.unmounted && eng.phase === "swapping" && eng.swapWaitingSpeech) {
          eng.swapWaitingSpeech = false;
          setSwapWaitingSpeech(false);
        }
      }, 1500);

      void speechManager.speak(ev.speak_text || "请换手", speakOptions()).finally(() => {
        clearTimeout(safetyRelease);
        if (!eng.unmounted && eng.phase === "swapping" && eng.swapWaitingSpeech) {
          eng.swapWaitingSpeech = false;
          setSwapWaitingSpeech(false);
        }
      });
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(100, now - lastTs);
      lastTs = now;

      const eng = engineRef.current;
      if (eng.finished || eng.unmounted) return;

      if (eng.phase === "playing") {
        eng.activeElapsedMs += dt;
        setActiveElapsedMs(eng.activeElapsedMs);

        // Fire scheduled events whose active timestamp has been reached
        while (
          eng.nextEventIdx < plan.events.length &&
          eng.activeElapsedMs >= plan.events[eng.nextEventIdx].at_ms
        ) {
          const ev = plan.events[eng.nextEventIdx];
          eng.nextEventIdx += 1;

          if (ev.kind === "hand_swap") {
            triggerHandSwap(ev);
            return; // Pause active clock immediately for swap countdown
          }

          // Item A or Item B voice cue
          eng.totalCues += 1;
          if (ev.kind === "item_a") {
            eng.itemACount += 1;
          } else {
            eng.itemBCount += 1;
          }

          setCounts({
            total: eng.totalCues,
            a: eng.itemACount,
            b: eng.itemBCount,
            swaps: eng.swapsCompleted,
          });
          setActiveCue({ seq: ev.seq, kind: ev.kind });
          setLastCueLabel(ev.label);
          setLastCueKind(ev.kind);
          setRecentCues((prev) => [ev, ...prev].slice(0, 8));

          if (!eng.mutedFx) {
            // Stereo pan aligns with which hand currently holds the announced object!
            const isItemInLeftHand =
              (ev.kind === "item_a" && !eng.isSwapped) ||
              (ev.kind === "item_b" && eng.isSwapped);
            const pan = settings.blind_mode ? 0 : isItemInLeftHand ? -0.55 : 0.55;
            soundFx.playCuePing(ev.kind, pan, 0.3);
          }

          void speechManager.speak(ev.speak_text, speakOptions());
        }

        if (eng.activeElapsedMs >= totalDurationMs) {
          finalizeSession(true);
        }
      } else if (eng.phase === "swapping") {
        if (eng.swapWaitingSpeech) {
          return;
        }

        eng.swapElapsedMs += dt;
        const progress = Math.min(1, eng.swapElapsedMs / eng.swapTotalMs);
        const remainingSec = Math.ceil((eng.swapTotalMs - eng.swapElapsedMs) / 1000);

        setSwapProgress(progress);
        setSwapSecondsRemaining(Math.max(1, remainingSec));

        // Announce each countdown integer 5, 4, 3, 2, 1 once
        if (remainingSec >= 1 && remainingSec !== eng.lastSpokenCountdown) {
          eng.lastSpokenCountdown = remainingSec;
          if (!eng.mutedFx) {
            soundFx.playCountdownTick(remainingSec, 0.48);
          }
          void speechManager.speak(String(remainingSec), {
            ...speakOptions(),
            rate: Math.max(1.05, settings.speech_rate),
          });
        }

        if (eng.swapElapsedMs >= eng.swapTotalMs) {
          // Hand swap finished! Flip tracked hands and resume active training!
          eng.isSwapped = !eng.isSwapped;
          eng.swapsCompleted += 1;
          eng.phase = "playing";

          setIsSwapped(eng.isSwapped);
          setCounts({
            total: eng.totalCues,
            a: eng.itemACount,
            b: eng.itemBCount,
            swaps: eng.swapsCompleted,
          });
          setPhase("playing");
          setSwapProgress(0);

          if (!eng.mutedFx) {
            soundFx.playResumeChime(0.5);
          }
          void speechManager.speak("继续", speakOptions());
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [plan, settings, speakOptions, finalizeSession]);

  const remainingSec = Math.max(0, plan.duration_sec - activeElapsedMs / 1000);
  const overallProgressPct = Math.min(100, (activeElapsedMs / (plan.duration_sec * 1000)) * 100);

  const currentLeftItem = isSwapped ? plan.item_b : plan.item_a;
  const currentRightItem = isSwapped ? plan.item_a : plan.item_b;
  const nextLeftItem = isSwapped ? plan.item_a : plan.item_b;
  const nextRightItem = isSwapped ? plan.item_b : plan.item_a;

  const leftActive =
    !settings.blind_mode &&
    phase === "playing" &&
    ((lastCueKind === "item_a" && !isSwapped) || (lastCueKind === "item_b" && isSwapped));
  const rightActive =
    !settings.blind_mode &&
    phase === "playing" &&
    ((lastCueKind === "item_b" && !isSwapped) || (lastCueKind === "item_a" && isSwapped));

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-[#060A13] select-none">
      {/* Fullscreen Three.js 3D Arena Background */}
      <div className="absolute inset-0 z-0">
        <Scene3DStage
          enabled={settings.enable_3d}
          phase={phase}
          isSwapped={isSwapped}
          swapProgress={swapProgress}
          blindMode={settings.blind_mode}
          activeCue={activeCue}
        />
      </div>

      {/* Subtle vignette for contrast */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(5,8,16,0.82)_100%)] pointer-events-none" />

      {/* Top HUD Bar */}
      <header className="relative z-20 px-6 pt-5 pb-3">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-950/75 backdrop-blur-xl px-5 py-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Timer & Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    phase === "playing"
                      ? "bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse"
                      : phase === "swapping"
                        ? "bg-amber-400 shadow-[0_0_12px_#fbbf24] animate-ping"
                        : "bg-slate-400"
                  }`}
                />
                <span className="text-3xl font-black tabular-nums tracking-tight text-white">
                  {formatClock(remainingSec)}
                </span>
              </div>

              <div className="h-6 w-px bg-slate-800" />

              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div>
                  已播报{" "}
                  <span className="text-cyan-300 font-bold tabular-nums">{counts.total}</span> 次
                </div>
                <div>
                  已换手{" "}
                  <span className="text-amber-300 font-bold tabular-nums">
                    {counts.swaps}/{plan.planned_swaps}
                  </span>
                </div>
                {settings.blind_mode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200">
                    <EyeOff className="w-3 h-3" />
                    纯盲听模式
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                title={mutedFx ? "开启提示音效" : "静音提示音效"}
                onClick={() => setMutedFx((v) => !v)}
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
              >
                {mutedFx ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {(phase === "playing" || phase === "paused") && (
                <PushButton variant="ghost" size="sm" onClick={togglePause}>
                  {phase === "paused" ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>继续</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>暂停</span>
                    </>
                  )}
                </PushButton>
              )}

              <PushButton variant="rose" size="sm" onClick={handleAbort}>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>结束训练</span>
              </PushButton>
            </div>
          </div>

          {/* Slim glowing progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-400 shadow-[0_0_12px_rgba(34,211,238,0.65)] transition-[width] duration-150"
              style={{ width: `${overallProgressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Center Stage Live Visual Cue & Hand Position Indicators */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 py-4">
        {/* Center Current Cue Readout */}
        <div className="mt-2 flex flex-col items-center text-center">
          {settings.blind_mode ? (
            <div className="flex flex-col items-center mt-8">
              <div className="w-24 h-24 rounded-full border-2 border-cyan-400/35 bg-cyan-500/10 flex items-center justify-center ui-ambient-breathe shadow-[0_0_45px_rgba(34,211,238,0.25)]">
                <EyeOff className="w-9 h-9 text-cyan-300/90" />
              </div>
              <div className="mt-4 text-lg font-bold text-slate-200">纯听觉专注进行中</div>
              <div className="text-xs text-slate-400 mt-1">
                请闭眼或保持平视，专注聆听语音指令与换手倒计时
              </div>
            </div>
          ) : (
            <div className="min-h-[112px] flex flex-col items-center justify-center">
              <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400 font-semibold mb-1.5">
                当前语音指令
              </span>
              <div
                key={activeCue?.seq ?? "init"}
                className={`text-5xl md:text-6xl font-black tracking-tight ui-cue-pop ${
                  lastCueKind === "item_a"
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-400 to-sky-400 drop-shadow-[0_0_28px_rgba(34,211,238,0.55)]"
                    : lastCueKind === "item_b"
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-400 to-rose-400 drop-shadow-[0_0_28px_rgba(249,115,22,0.55)]"
                      : "text-slate-400 text-2xl font-bold"
                }`}
              >
                {lastCueLabel}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Left/Right Hand Real-Time Holding Cards + Recent Cue Ribbon */}
        <div className="w-full max-w-4xl space-y-4 pb-3">
          <div className="grid grid-cols-2 gap-5">
            {/* Current Left Hand Card */}
            <div
              className={`rounded-2xl border px-5 py-4 backdrop-blur-xl transition-all duration-200 ${
                leftActive
                  ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_38px_-6px_rgba(34,211,238,0.7)] scale-[1.02]"
                  : "border-slate-800/80 bg-slate-950/70"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold">当前左手持有</span>
                {isSwapped && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                    <ArrowLeftRight className="w-2.5 h-2.5" />
                    已换手
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-2xl font-extrabold text-white truncate">
                {currentLeftItem}
              </div>
            </div>

            {/* Current Right Hand Card */}
            <div
              className={`rounded-2xl border px-5 py-4 backdrop-blur-xl transition-all duration-200 text-right ${
                rightActive
                  ? "border-orange-400 bg-orange-500/20 shadow-[0_0_38px_-6px_rgba(249,115,22,0.7)] scale-[1.02]"
                  : "border-slate-800/80 bg-slate-950/70"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                {isSwapped ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                    <ArrowLeftRight className="w-2.5 h-2.5" />
                    已换手
                  </span>
                ) : (
                  <span />
                )}
                <span className="font-semibold">当前右手持有</span>
              </div>
              <div className="mt-1.5 text-2xl font-extrabold text-white truncate">
                {currentRightItem}
              </div>
            </div>
          </div>

          {/* Recent cue ribbon (hidden in blind mode) */}
          {!settings.blind_mode && (
            <div className="flex items-center justify-center gap-2 min-h-[28px] overflow-hidden">
              {recentCues.map((ev, idx) => (
                <span
                  key={ev.seq}
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold border transition-opacity ${
                    ev.kind === "item_a"
                      ? "bg-cyan-500/15 border-cyan-400/35 text-cyan-200"
                      : "bg-orange-500/15 border-orange-400/35 text-orange-200"
                  }`}
                  style={{ opacity: Math.max(0.25, 1 - idx * 0.13) }}
                >
                  {ev.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Initial 3-2-1 Ready Overlay */}
      {phase === "ready" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 backdrop-blur-md">
          <div className="text-center px-8 py-10 rounded-3xl border border-cyan-400/30 bg-slate-900/90 shadow-2xl max-w-md w-[90%]">
            <div className="text-xs font-bold tracking-widest uppercase text-cyan-300 mb-3">
              准备就绪 · 握好手中物品
            </div>
            <div
              key={readyCount}
              className="text-8xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-300 to-sky-500 ui-cue-pop"
            >
              {readyCount}
            </div>
            <div className="mt-5 flex items-center justify-center gap-4 text-sm font-semibold">
              <span className="text-cyan-300">左手：{plan.item_a}</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-300">右手：{plan.item_b}</span>
            </div>
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {phase === "paused" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
          <div className="text-center px-10 py-8 rounded-3xl border border-slate-700/80 bg-slate-900/95 shadow-2xl space-y-5">
            <h3 className="text-2xl font-extrabold text-white">训练已暂停</h3>
            <p className="text-xs text-slate-400">
              当前手持：左手「{currentLeftItem}」 / 右手「{currentRightItem}」
            </p>
            <div className="flex items-center justify-center gap-3">
              <PushButton variant="cyan" size="md" onClick={togglePause}>
                <Play className="w-4 h-4 fill-current" />
                <span>继续训练 (Space)</span>
              </PushButton>
              <PushButton variant="rose" size="md" onClick={handleAbort}>
                <span>结束并结算</span>
              </PushButton>
            </div>
          </div>
        </div>
      )}

      {/* 5-Second Hand-Swap Countdown Overlay */}
      <CountdownOverlay
        visible={phase === "swapping"}
        secondsRemaining={swapWaitingSpeech ? plan.swap_countdown_sec : swapSecondsRemaining}
        totalCountdownSec={plan.swap_countdown_sec}
        progress={swapWaitingSpeech ? 0 : swapProgress}
        nextLeftItem={nextLeftItem}
        nextRightItem={nextRightItem}
      />
    </div>
  );
};
