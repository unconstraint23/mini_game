import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  EyeOff,
  Hand,
  Play,
  ShieldAlert,
  ShieldCheck,
  Square,
  Timer,
  Volume2,
  Zap,
} from "lucide-react";
import type {
  GoNoGoEvent,
  Scene4Plan,
  SessionPayload,
  UserSettings,
} from "../types/game";
import { api } from "../services/api";
import { nativeBridge } from "../services/native";
import { soundFx } from "../services/soundFx";
import { speechManager } from "../services/speech";
import {
  GlowToggle,
  PushButton,
  SegmentedControl,
  TactileCard,
} from "../components/uiverse/UiverseControls";

interface Scene4GoNoGoViewProps {
  settings: UserSettings;
  nativeTtsAvailable: boolean;
  onPlayingChange: (playing: boolean) => void;
  onSessionComplete: (payload: SessionPayload) => void;
}

const WORD_THEMES = [
  { name: "动作急停组", go: "拍手, 出拳", nogo: "停, 别动" },
  { name: "体能反射组", go: "起跳, 挥手", nogo: "立定, 静止" },
  { name: "极简数字组", go: "一, 三", nogo: "零, 停" },
];

function splitWords(raw: string): string[] {
  return raw
    .split(/[,，、/\s]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function buildFallbackGoNoGoPlan(
  goWords: string[],
  nogoWords: string[],
  durationSec: number,
  minMs: number,
  maxMs: number,
  nogoRatio: number,
  responseWindowMs: number
): Scene4Plan {
  const totalMs = durationSec * 1000;
  const events: GoNoGoEvent[] = [];
  let cursor = 900;
  let seq = 0;
  let goCount = 0;
  let nogoCount = 0;
  let nogoStreak = 0;
  let goStreak = 0;

  while (cursor <= totalMs - 800) {
    seq += 1;
    let kind: "go" | "nogo" = "go";
    if (seq <= 2 || nogoStreak >= 2) kind = "go";
    else if (goStreak >= 5) kind = "nogo";
    else kind = Math.random() < nogoRatio ? "nogo" : "go";

    if (kind === "go") {
      goCount += 1;
      goStreak += 1;
      nogoStreak = 0;
    } else {
      nogoCount += 1;
      nogoStreak += 1;
      goStreak = 0;
    }

    const pool = kind === "go" ? goWords : nogoWords;
    events.push({
      seq,
      at_ms: cursor,
      kind,
      word: pool[Math.floor(Math.random() * pool.length)],
      response_window_ms: responseWindowMs,
    });
    const effMin = Math.max(minMs, responseWindowMs + 180);
    const effMax = Math.max(maxMs, effMin + 250);
    cursor += effMin + Math.round(Math.random() * (effMax - effMin));
  }

  return {
    plan_id: `local-gonogo-${Date.now()}`,
    duration_sec: durationSec,
    response_window_ms: responseWindowMs,
    go_count: goCount,
    nogo_count: nogoCount,
    events,
  };
}

export const Scene4GoNoGoView: React.FC<Scene4GoNoGoViewProps> = ({
  settings,
  nativeTtsAvailable,
  onPlayingChange,
  onSessionComplete,
}) => {
  // Setup config
  const [goInput, setGoInput] = useState("拍手, 出拳");
  const [nogoInput, setNogoInput] = useState("停, 别动");
  const [durationSec, setDurationSec] = useState(60);
  const [nogoRatio, setNogoRatio] = useState(0.3);
  const [pace, setPace] = useState<"standard" | "fast" | "extreme">("standard");
  const [responseWindowMs, setResponseWindowMs] = useState(1200);
  const [blindAudio, setBlindAudio] = useState(false);

  // Runtime state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [plan, setPlan] = useState<Scene4Plan | null>(null);
  const [remainingSec, setRemainingSec] = useState(60);
  const [currentEvent, setCurrentEvent] = useState<GoNoGoEvent | null>(null);
  const [padPressed, setPadPressed] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    id: number;
    tone: "good" | "inhibit" | "bad";
    text: string;
  } | null>(null);

  const [metrics, setMetrics] = useState({
    goHits: 0,
    goMisses: 0,
    nogoInhibits: 0,
    falseAlarms: 0,
    avgRt: 0,
  });

  const engineRef = useRef({
    playing: false,
    finished: false,
    startedAtIso: "",
    startPerfMs: 0,
    nextIdx: 0,
    activeEvent: null as GoNoGoEvent | null,
    activeEventStartPerfMs: 0,
    activeEventResolved: false,
    goHits: 0,
    goMisses: 0,
    nogoInhibits: 0,
    falseAlarms: 0,
    rtList: [] as number[],
  });

  useEffect(() => {
    onPlayingChange(isPlaying);
    return () => onPlayingChange(false);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    return () => speechManager.stop();
  }, []);

  const syncMetrics = useCallback(() => {
    const e = engineRef.current;
    const avgRt =
      e.rtList.length > 0
        ? Math.round(e.rtList.reduce((a, b) => a + b, 0) / e.rtList.length)
        : 0;
    setMetrics({
      goHits: e.goHits,
      goMisses: e.goMisses,
      nogoInhibits: e.nogoInhibits,
      falseAlarms: e.falseAlarms,
      avgRt,
    });
  }, []);

  const finishGame = useCallback(
    (completed: boolean) => {
      const e = engineRef.current;
      if (e.finished || !e.playing) return;
      e.finished = true;
      e.playing = false;
      setIsPlaying(false);
      speechManager.stop();

      const elapsedSec = Math.min(
        durationSec,
        Math.max(1, Math.round((performance.now() - e.startPerfMs) / 1000))
      );
      const totalTrials = e.goHits + e.goMisses + e.nogoInhibits + e.falseAlarms;
      if (!completed && totalTrials === 0) {
        return;
      }
      const successes = e.goHits + e.nogoInhibits;
      const accuracyPct = totalTrials > 0 ? Math.round((successes / totalTrials) * 100) : 0;
      const avgRt =
        e.rtList.length > 0
          ? Math.round(e.rtList.reduce((a, b) => a + b, 0) / e.rtList.length)
          : 0;
      const bestRt = e.rtList.length > 0 ? Math.min(...e.rtList) : 0;

      // Penalize impulsive false alarms gently & reward crisp inhibition + speed
      const speedBonus = avgRt > 0 ? Math.max(0, Math.min(15, Math.round((950 - avgRt) / 35))) : 0;
      const score = Math.min(100, Math.max(10, Math.round(accuracyPct * 0.85 + speedBonus)));

      if (completed && settings.sound_fx_enabled) {
        soundFx.playSessionComplete(0.45);
      }

      onSessionComplete({
        scene_id: "scene_4_gonogo",
        item_a: splitWords(goInput).join("/"),
        item_b: splitWords(nogoInput).join("/"),
        configured_duration_sec: durationSec,
        actual_duration_sec: elapsedSec,
        total_cues: totalTrials,
        item_a_count: e.goHits,
        item_b_count: e.nogoInhibits,
        swap_count_completed: e.falseAlarms,
        swap_countdown_sec: 0,
        min_interval_ms: responseWindowMs,
        max_interval_ms: responseWindowMs,
        blind_mode: blindAudio,
        completed,
        focus_score_override: score,
        extra_metrics: {
          accuracy_pct: accuracyPct,
          avg_reaction_ms: avgRt,
          best_reaction_ms: bestRt,
          go_hits: e.goHits,
          go_misses: e.goMisses,
          nogo_inhibits: e.nogoInhibits,
          false_alarms: e.falseAlarms,
        },
        started_at: e.startedAtIso,
        ended_at: new Date().toISOString(),
      });
    },
    [
      blindAudio,
      durationSec,
      goInput,
      nogoInput,
      onSessionComplete,
      responseWindowMs,
      settings.sound_fx_enabled,
    ]
  );

  const handlePadTrigger = useCallback(() => {
    const e = engineRef.current;
    if (!e.playing || e.finished) return;

    setPadPressed(true);
    window.setTimeout(() => setPadPressed(false), 120);

    if (!e.activeEvent || e.activeEventResolved) {
      return;
    }

    const rt = Math.max(60, Math.round(performance.now() - e.activeEventStartPerfMs));
    e.activeEventResolved = true;

    if (e.activeEvent.kind === "go") {
      e.goHits += 1;
      e.rtList.push(rt);
      syncMetrics();
      setStatusFeedback({
        id: Date.now(),
        tone: "good",
        text: `命中行动指令！反应时 ${rt}ms`,
      });
      if (settings.sound_fx_enabled) soundFx.playSuccessHit(0.38);
      void nativeBridge.hapticMedium();
    } else {
      e.falseAlarms += 1;
      syncMetrics();
      setStatusFeedback({
        id: Date.now(),
        tone: "bad",
        text: `冲动误触！「${e.activeEvent.word}」需立刻急停`,
      });
      if (settings.sound_fx_enabled) soundFx.playErrorBuzz(0.45);
      void nativeBridge.hapticError();
    }
  }, [settings.sound_fx_enabled, syncMetrics]);

  // Keyboard support: Space / Enter hits the reaction pad, Esc finishes
  useEffect(() => {
    if (!isPlaying) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === "Space" || ev.code === "Enter") {
        ev.preventDefault();
        if (!ev.repeat) handlePadTrigger();
      } else if (ev.code === "Escape") {
        ev.preventDefault();
        finishGame(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishGame, handlePadTrigger, isPlaying]);

  // Main 60fps scheduler & response window evaluator
  useEffect(() => {
    if (!isPlaying || !plan) return;
    let rafId = 0;
    const totalMs = plan.duration_sec * 1000;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const e = engineRef.current;
      if (!e.playing || e.finished) return;

      const elapsed = now - e.startPerfMs;
      setRemainingSec(Math.max(0, (totalMs - elapsed) / 1000));

      // Evaluate expiration of current event response window
      if (e.activeEvent && !e.activeEventResolved) {
        const sinceCue = now - e.activeEventStartPerfMs;
        if (sinceCue >= e.activeEvent.response_window_ms) {
          e.activeEventResolved = true;
          if (e.activeEvent.kind === "go") {
            e.goMisses += 1;
            syncMetrics();
            setStatusFeedback({
              id: Date.now(),
              tone: "bad",
              text: `漏击超时（「${e.activeEvent.word}」未及时拍击）`,
            });
            if (settings.sound_fx_enabled) soundFx.playErrorBuzz(0.3);
          } else {
            e.nogoInhibits += 1;
            syncMetrics();
            setStatusFeedback({
              id: Date.now(),
              tone: "inhibit",
              text: `成功急停克制 ✓（「${e.activeEvent.word}」）`,
            });
            if (settings.sound_fx_enabled) soundFx.playInhibitGood(0.32);
          }
        }
      }

      // Fire next scheduled auditory cue
      if (e.nextIdx < plan.events.length && elapsed >= plan.events[e.nextIdx].at_ms) {
        const nextEv = plan.events[e.nextIdx];
        e.nextIdx += 1;
        e.activeEvent = nextEv;
        e.activeEventStartPerfMs = now;
        e.activeEventResolved = false;
        setCurrentEvent(nextEv);

        void speechManager.speak(nextEv.word, {
          rate: Math.max(1.05, settings.speech_rate),
          volume: settings.speech_volume,
          engine: settings.tts_engine,
          voiceName: settings.voice_name,
          nativeAvailable: nativeTtsAvailable,
        });
      }

      if (elapsed >= totalMs) {
        finishGame(true);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [finishGame, isPlaying, nativeTtsAvailable, plan, settings, syncMetrics]);

  const goWords = splitWords(goInput);
  const nogoWords = splitWords(nogoInput);
  const validConfig = goWords.length > 0 && nogoWords.length > 0;

  const handleStart = async () => {
    if (!validConfig) return;
    setIsStarting(true);
    soundFx.unlock();

    const paceRange =
      pace === "standard"
        ? { min: 1500, max: 2300 }
        : pace === "fast"
          ? { min: 1150, max: 1750 }
          : { min: 900, max: 1450 };

    try {
      let nextPlan: Scene4Plan;
      try {
        nextPlan = await api.createScene4Plan({
          go_words: goWords,
          nogo_words: nogoWords,
          duration_sec: durationSec,
          min_interval_ms: paceRange.min,
          max_interval_ms: paceRange.max,
          nogo_ratio: nogoRatio,
          response_window_ms: responseWindowMs,
        });
      } catch {
        nextPlan = buildFallbackGoNoGoPlan(
          goWords,
          nogoWords,
          durationSec,
          paceRange.min,
          paceRange.max,
          nogoRatio,
          responseWindowMs
        );
      }

      await speechManager.prewarm([...goWords, ...nogoWords], {
        rate: Math.max(1.05, settings.speech_rate),
        volume: settings.speech_volume,
        engine: settings.tts_engine,
        voiceName: settings.voice_name,
        nativeAvailable: nativeTtsAvailable,
      });

      engineRef.current = {
        playing: true,
        finished: false,
        startedAtIso: new Date().toISOString(),
        startPerfMs: performance.now(),
        nextIdx: 0,
        activeEvent: null,
        activeEventStartPerfMs: 0,
        activeEventResolved: false,
        goHits: 0,
        goMisses: 0,
        nogoInhibits: 0,
        falseAlarms: 0,
        rtList: [],
      };

      setPlan(nextPlan);
      setRemainingSec(durationSec);
      setCurrentEvent(null);
      setStatusFeedback(null);
      setMetrics({ goHits: 0, goMisses: 0, nogoInhibits: 0, falseAlarms: 0, avgRt: 0 });
      setIsPlaying(true);

      if (settings.sound_fx_enabled) soundFx.playResumeChime(0.45);
    } finally {
      setIsStarting(false);
    }
  };

  if (isPlaying && plan) {
    return (
      <div className="h-full w-full flex flex-col bg-[#060912] relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.12),transparent_58%)] pointer-events-none" />

        {/* HUD */}
        <header className="relative z-10 safe-top px-3.5 sm:px-6 pb-2">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-3.5 sm:px-5 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-white">
                {String(Math.floor(remainingSec / 60)).padStart(2, "0")}:
                {String(Math.ceil(remainingSec) % 60).padStart(2, "0")}
              </div>
              <div className="h-5 sm:h-6 w-px bg-slate-800" />
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-[11px] sm:text-xs tabular-nums">
                <span className="text-emerald-300 font-bold">命中 {metrics.goHits}</span>
                <span className="text-cyan-300 font-bold">急停 {metrics.nogoInhibits}</span>
                <span className="text-rose-400 font-bold">
                  误/漏 {metrics.falseAlarms}/{metrics.goMisses}
                </span>
                <span className="hidden sm:inline text-amber-300 font-bold">
                  均速 {metrics.avgRt > 0 ? `${metrics.avgRt}ms` : "--"}
                </span>
              </div>
            </div>

            <PushButton variant="rose" size="sm" onClick={() => finishGame(false)}>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>结束</span>
            </PushButton>
          </div>
        </header>

        {/* Center Arena */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-4 safe-bottom gap-5 sm:gap-7">
          {/* Cue Word / Blind Audio Display */}
          <div className="text-center min-h-[115px] flex flex-col items-center justify-center">
            {blindAudio ? (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-2 border-amber-400/40 bg-amber-500/10 flex items-center justify-center ui-ambient-breathe">
                  <EyeOff className="w-8 h-8 text-amber-300" />
                </div>
                <span className="text-xs text-slate-400 mt-3">
                  纯听觉模式 · 听到行动词即刻拍击，听到禁动词立刻忍住
                </span>
              </div>
            ) : currentEvent ? (
              <div key={currentEvent.seq} className="ui-cue-pop flex flex-col items-center">
                <span
                  className={`text-[11px] font-bold tracking-widest uppercase mb-1.5 px-3 py-0.5 rounded-full border ${
                    currentEvent.kind === "go"
                      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                      : "bg-rose-500/15 border-rose-400/40 text-rose-300"
                  }`}
                >
                  {currentEvent.kind === "go" ? "GO · 立即拍击！" : "NO-GO · 千万别动！"}
                </span>
                <div
                  className={`text-6xl font-black tracking-tight ${
                    currentEvent.kind === "go"
                      ? "text-emerald-300 drop-shadow-[0_0_28px_rgba(52,211,153,0.6)]"
                      : "text-rose-400 drop-shadow-[0_0_28px_rgba(251,113,133,0.6)]"
                  }`}
                >
                  {currentEvent.word}
                </div>
              </div>
            ) : (
              <div className="text-lg font-bold text-slate-400">准备聆听首个指令...</div>
            )}
          </div>

          {/* Oversized Uiverse Tactile Circular Reaction Pad (instant pointerdown trigger for zero mobile delay) */}
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-4 rounded-full border border-amber-400/20 ui-ambient-breathe pointer-events-none" />
            <button
              type="button"
              data-pressed={padPressed}
              onPointerDown={(e) => {
                e.preventDefault();
                handlePadTrigger();
              }}
              className="ui-reaction-pad w-44 h-44 sm:w-52 sm:h-52 touch-none bg-gradient-to-br from-amber-300 via-orange-500 to-rose-600 p-[3px] shadow-[0_14px_0_#7c2d12,0_25px_60px_-10px_rgba(249,115,22,0.55)]"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600 flex flex-col items-center justify-center text-slate-950 shadow-[inset_0_3px_0_rgba(255,255,255,0.45)]">
                <Hand className="w-10 h-10 sm:w-12 sm:h-12 mb-1 sm:mb-1.5 stroke-[2.4]" />
                <span className="text-lg sm:text-xl font-black tracking-wide">拍击响应</span>
                <span className="text-[11px] font-bold opacity-80 mt-0.5 font-mono">
                  轻触 / Space
                </span>
              </div>
            </button>
          </div>

          {/* Live Feedback Banner */}
          <div className="h-8 flex items-center justify-center">
            {statusFeedback && (
              <div
                key={statusFeedback.id}
                className={`ui-cue-pop inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold border ${
                  statusFeedback.tone === "good"
                    ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                    : statusFeedback.tone === "inhibit"
                      ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-200"
                      : "bg-rose-500/15 border-rose-400/40 text-rose-200"
                }`}
              >
                {statusFeedback.tone === "good" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : statusFeedback.tone === "inhibit" ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                <span>{statusFeedback.text}</span>
              </div>
            )}
          </div>

          {/* Quick rule reminder */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400">
            <span>
              <strong className="text-emerald-300">行动词 (按)：</strong>
              {goWords.join(" / ")}
            </span>
            <span>·</span>
            <span>
              <strong className="text-rose-300">禁动词 (停)：</strong>
              {nogoWords.join(" / ")}
            </span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-4 sm:px-7 pt-4 sm:pt-7 pb-24 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/35 via-[#13101E] to-slate-950 p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-200 mb-3">
                <Timer className="w-3.5 h-3.5" />
                <span>场景 4 · 听觉 Go / No-Go 急停反射训练</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                极速出击与瞬间急停，锤炼冲动控制力
              </h2>
              <p className="text-sm text-slate-300/85 mt-2 leading-relaxed">
                系统高频随机语音播报「行动词」并混入「禁动词」。听到行动词立即按空格键/拍击按钮；听到禁动词必须在毫秒间刹住手指、严禁误触！
              </p>
            </div>
            <PushButton
              variant="amber"
              size="lg"
              disabled={!validConfig || isStarting}
              onClick={() => void handleStart()}
              className="min-w-[205px] shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{isStarting ? "准备语音中..." : "开始急停训练"}</span>
            </PushButton>
          </div>
        </div>

        {/* Word Configuration */}
        <TactileCard className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Volume2 className="w-4 h-4 text-amber-300" />
              <span>自定义语音词库（逗号分隔，最多 6 个）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {WORD_THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setGoInput(t.go);
                    setNogoInput(t.nogo);
                  }}
                  className="ui-chip text-xs"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-300 mb-2">
                行动指令词（GO — 听到后立即拍击）
              </label>
              <div className="ui-glow-input-wrap ui-glow-input-wrap--cyan">
                <input
                  type="text"
                  value={goInput}
                  onChange={(e) => setGoInput(e.target.value)}
                  placeholder="例如：拍手, 出拳"
                  className="ui-glow-input px-4 py-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-2">
                禁动干扰词（NO-GO — 听到后必须忍住不按）
              </label>
              <div className="ui-glow-input-wrap ui-glow-input-wrap--amber">
                <input
                  type="text"
                  value={nogoInput}
                  onChange={(e) => setNogoInput(e.target.value)}
                  placeholder="例如：停, 别动"
                  className="ui-glow-input px-4 py-3 text-sm"
                />
              </div>
            </div>
          </div>
        </TactileCard>

        {/* Pace & Window */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Zap className="w-4 h-4 text-amber-300" />
              <span>时长与禁动词比例</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">训练总时长</div>
              <SegmentedControl
                options={[
                  { value: 30, label: "30 秒" },
                  { value: 60, label: "60 秒" },
                  { value: 90, label: "90 秒" },
                  { value: 120, label: "2 分钟" },
                ]}
                value={durationSec}
                onChange={setDurationSec}
                className="w-full justify-between"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">禁动干扰词出现概率</div>
              <SegmentedControl
                options={[
                  { value: 0.2, label: "20% 突袭" },
                  { value: 0.3, label: "30% 标准" },
                  { value: 0.4, label: "40% 高压" },
                ]}
                value={nogoRatio}
                onChange={setNogoRatio}
                className="w-full justify-between"
              />
            </div>
          </TactileCard>

          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Timer className="w-4 h-4 text-cyan-300" />
              <span>播报速度与听觉专注</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">播报节奏</div>
              <SegmentedControl<"standard" | "fast" | "extreme">
                options={[
                  { value: "standard", label: "标准节奏" },
                  { value: "fast", label: "疾速节奏" },
                  { value: "extreme", label: "极限脉冲" },
                ]}
                value={pace}
                onChange={setPace}
                className="w-full justify-between"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">允许响应时间窗口</div>
              <SegmentedControl
                options={[
                  { value: 900, label: "900ms 闪电" },
                  { value: 1200, label: "1200ms 标准" },
                  { value: 1600, label: "1600ms 宽松" },
                ]}
                value={responseWindowMs}
                onChange={setResponseWindowMs}
                className="w-full justify-between"
              />
            </div>
            <div className="pt-2 border-t border-slate-800/70">
              <GlowToggle
                checked={blindAudio}
                onChange={setBlindAudio}
                label="纯盲听急停模式"
                description="隐藏屏幕指令词提示，完全依赖听觉触发或抑制动作"
              />
            </div>
          </TactileCard>
        </div>
      </div>
    </div>
  );
};
