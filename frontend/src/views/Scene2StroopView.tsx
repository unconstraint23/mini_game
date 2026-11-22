import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Keyboard,
  Palette,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Type,
  Volume2,
  XCircle,
} from "lucide-react";
import type {
  ColorKey,
  Scene2Plan,
  SessionPayload,
  StroopTrial,
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

interface Scene2StroopViewProps {
  settings: UserSettings;
  nativeTtsAvailable: boolean;
  onPlayingChange: (playing: boolean) => void;
  onSessionComplete: (payload: SessionPayload) => void;
}

const COLOR_STYLES: Record<
  ColorKey,
  {
    label: string;
    shortcut: string;
    hex: string;
    textClass: string;
    btnVariant: "rose" | "cyan" | "emerald" | "gold";
  }
> = {
  red: {
    label: "红色",
    shortcut: "1 / A",
    hex: "#FB7185",
    textClass: "text-rose-400 drop-shadow-[0_0_32px_rgba(251,113,133,0.65)]",
    btnVariant: "rose",
  },
  blue: {
    label: "蓝色",
    shortcut: "2 / S",
    hex: "#38BDF8",
    textClass: "text-sky-400 drop-shadow-[0_0_32px_rgba(56,189,248,0.65)]",
    btnVariant: "cyan",
  },
  green: {
    label: "绿色",
    shortcut: "3 / D",
    hex: "#34D399",
    textClass: "text-emerald-400 drop-shadow-[0_0_32px_rgba(52,211,153,0.65)]",
    btnVariant: "emerald",
  },
  yellow: {
    label: "黄色",
    shortcut: "4 / F",
    hex: "#FACC15",
    textClass: "text-yellow-300 drop-shadow-[0_0_32px_rgba(250,204,21,0.65)]",
    btnVariant: "gold",
  },
};

const COLOR_ORDER: ColorKey[] = ["red", "blue", "green", "yellow"];
const COLOR_TEXT: Record<ColorKey, string> = {
  red: "红",
  blue: "蓝",
  green: "绿",
  yellow: "黄",
};

function buildFallbackStroopPlan(
  durationSec: number,
  mode: "ink" | "mixed",
  conflictRatio: number
): Scene2Plan {
  const trials: StroopTrial[] = [];
  let prev = "";
  for (let i = 1; i <= 150; i++) {
    const conflict = Math.random() < conflictRatio;
    let wordKey: ColorKey = COLOR_ORDER[Math.floor(Math.random() * 4)];
    let inkKey: ColorKey = wordKey;
    for (let retry = 0; retry < 8; retry++) {
      wordKey = COLOR_ORDER[Math.floor(Math.random() * 4)];
      if (conflict) {
        const others = COLOR_ORDER.filter((c) => c !== wordKey);
        inkKey = others[Math.floor(Math.random() * others.length)];
      } else {
        inkKey = wordKey;
      }
      if (`${wordKey}-${inkKey}` !== prev) break;
    }
    prev = `${wordKey}-${inkKey}`;
    const rule: "ink" | "word" = mode === "ink" ? "ink" : Math.random() < 0.5 ? "ink" : "word";
    const answerKey = rule === "ink" ? inkKey : wordKey;
    const distractors = COLOR_ORDER.filter((c) => c !== answerKey);
    const distractorKey = distractors[Math.floor(Math.random() * distractors.length)];
    trials.push({
      seq: i,
      word_key: wordKey,
      word_text: COLOR_TEXT[wordKey],
      ink_key: inkKey,
      rule,
      answer_key: answerKey,
      is_conflict: wordKey !== inkKey,
      distractor_speak: COLOR_TEXT[distractorKey],
    });
  }
  return { plan_id: `local-stroop-${Date.now()}`, mode, duration_sec: durationSec, trials };
}

export const Scene2StroopView: React.FC<Scene2StroopViewProps> = ({
  settings,
  nativeTtsAvailable,
  onPlayingChange,
  onSessionComplete,
}) => {
  // Setup config
  const [mode, setMode] = useState<"ink" | "mixed">("ink");
  const [durationSec, setDurationSec] = useState(60);
  const [conflictRatio, setConflictRatio] = useState(0.8);
  const [trialTimeoutMs, setTrialTimeoutMs] = useState(2200);
  const [voiceInterference, setVoiceInterference] = useState(false);

  // Runtime state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [plan, setPlan] = useState<Scene2Plan | null>(null);
  const [trialIdx, setTrialIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState(60);
  const [trialProgress, setTrialProgress] = useState(0); // 0..1

  // Live metrics
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [avgRtMs, setAvgRtMs] = useState(0);
  const [feedback, setFeedback] = useState<{
    id: number;
    kind: "hit" | "miss" | "timeout";
    text: string;
  } | null>(null);
  const [ruleJustSwitched, setRuleJustSwitched] = useState(false);

  const stateRef = useRef({
    playing: false,
    finished: false,
    startedAtIso: "",
    sessionStartMs: 0,
    trialStartMs: 0,
    trialIdx: 0,
    correct: 0,
    wrong: 0,
    combo: 0,
    maxCombo: 0,
    rtList: [] as number[],
  });

  useEffect(() => {
    onPlayingChange(isPlaying);
    return () => {
      onPlayingChange(false);
    };
  }, [isPlaying, onPlayingChange]);

  const speakDistractor = useCallback(
    (trial: StroopTrial) => {
      if (!voiceInterference) return;
      void speechManager.speak(`${trial.distractor_speak}色`, {
        rate: Math.min(1.4, settings.speech_rate + 0.1),
        volume: settings.speech_volume,
        engine: settings.tts_engine,
        voiceName: settings.voice_name,
        nativeAvailable: nativeTtsAvailable,
      });
    },
    [voiceInterference, settings, nativeTtsAvailable]
  );

  const finishGame = useCallback(
    (completed: boolean) => {
      const st = stateRef.current;
      if (st.finished || !st.playing) return;
      st.finished = true;
      st.playing = false;
      setIsPlaying(false);
      speechManager.stop();

      const elapsedSec = Math.min(
        durationSec,
        Math.max(1, Math.round((performance.now() - st.sessionStartMs) / 1000))
      );
      const total = st.correct + st.wrong;
      if (!completed && total === 0) {
        return;
      }
      const accuracyPct = total > 0 ? Math.round((st.correct / total) * 100) : 0;
      const avgRt =
        st.rtList.length > 0
          ? Math.round(st.rtList.reduce((a, b) => a + b, 0) / st.rtList.length)
          : 0;
      const speedBonus = avgRt > 0 ? Math.max(0, Math.min(20, Math.round((1300 - avgRt) / 35))) : 0;
      const score = Math.min(100, Math.max(10, Math.round(accuracyPct * 0.8 + speedBonus)));

      if (completed && settings.sound_fx_enabled) {
        soundFx.playSessionComplete(0.45);
      }

      onSessionComplete({
        scene_id: "scene_2_stroop",
        item_a: mode === "ink" ? "认颜色模式" : "色词混合模式",
        item_b: `冲突 ${Math.round(conflictRatio * 100)}%`,
        configured_duration_sec: durationSec,
        actual_duration_sec: elapsedSec,
        total_cues: total,
        item_a_count: st.correct,
        item_b_count: st.wrong,
        swap_count_completed: st.maxCombo,
        swap_countdown_sec: 0,
        min_interval_ms: trialTimeoutMs,
        max_interval_ms: trialTimeoutMs,
        blind_mode: voiceInterference,
        completed,
        focus_score_override: score,
        extra_metrics: {
          accuracy_pct: accuracyPct,
          avg_reaction_ms: avgRt,
          max_combo: st.maxCombo,
          correct_count: st.correct,
          wrong_count: st.wrong,
          mode,
          voice_interference: voiceInterference,
        },
        started_at: st.startedAtIso,
        ended_at: new Date().toISOString(),
      });
    },
    [
      conflictRatio,
      durationSec,
      mode,
      onSessionComplete,
      settings.sound_fx_enabled,
      trialTimeoutMs,
      voiceInterference,
    ]
  );

  const advanceTrial = useCallback(
    (currentPlan: Scene2Plan) => {
      const st = stateRef.current;
      const prevRule = currentPlan.trials[st.trialIdx]?.rule;
      const nextIdx = (st.trialIdx + 1) % currentPlan.trials.length;
      const nextTrial = currentPlan.trials[nextIdx];
      const switched = Boolean(prevRule && nextTrial && prevRule !== nextTrial.rule);

      st.trialIdx = nextIdx;
      st.trialStartMs = performance.now();
      setTrialIdx(nextIdx);
      setTrialProgress(0);
      setRuleJustSwitched(switched);

      if (switched && settings.sound_fx_enabled) {
        soundFx.playTargetLock(0.32);
      }
      speakDistractor(nextTrial);
    },
    [settings.sound_fx_enabled, speakDistractor]
  );

  const handleAnswer = useCallback(
    (chosen: ColorKey) => {
      const st = stateRef.current;
      if (!st.playing || st.finished || !plan) return;
      const currentTrial = plan.trials[st.trialIdx];
      if (!currentTrial) return;

      const rt = Math.max(80, Math.round(performance.now() - st.trialStartMs));
      if (chosen === currentTrial.answer_key) {
        st.correct += 1;
        st.combo += 1;
        st.maxCombo = Math.max(st.maxCombo, st.combo);
        st.rtList.push(rt);
        setCorrect(st.correct);
        setCombo(st.combo);
        setMaxCombo(st.maxCombo);
        setAvgRtMs(Math.round(st.rtList.reduce((a, b) => a + b, 0) / st.rtList.length));
        setFeedback({ id: Date.now(), kind: "hit", text: `命中 · ${rt}ms` });
        if (settings.sound_fx_enabled) soundFx.playSuccessHit(0.35);
        void nativeBridge.hapticTap();
      } else {
        st.wrong += 1;
        st.combo = 0;
        setWrong(st.wrong);
        setCombo(0);
        const ruleHint = currentTrial.rule === "ink" ? "看颜色" : "看字义";
        setFeedback({
          id: Date.now(),
          kind: "miss",
          text: `上题${ruleHint}，应选「${COLOR_STYLES[currentTrial.answer_key].label}」`,
        });
        if (settings.sound_fx_enabled) soundFx.playErrorBuzz(0.38);
        void nativeBridge.hapticError();
      }

      advanceTrial(plan);
    },
    [advanceTrial, plan, settings.sound_fx_enabled]
  );

  // Keyboard shortcuts during live play: 1/2/3/4 or A/S/D/F + Esc
  useEffect(() => {
    if (!isPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "1" || key === "a") handleAnswer("red");
      else if (key === "2" || key === "s") handleAnswer("blue");
      else if (key === "3" || key === "d") handleAnswer("green");
      else if (key === "4" || key === "f") handleAnswer("yellow");
      else if (key === "escape") finishGame(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying, handleAnswer, finishGame]);

  // Monotonic 60fps clock & single-trial timeout checker
  useEffect(() => {
    if (!isPlaying || !plan) return;
    let rafId = 0;
    const totalMs = durationSec * 1000;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const st = stateRef.current;
      if (!st.playing || st.finished) return;

      const elapsed = now - st.sessionStartMs;
      const remSec = Math.max(0, (totalMs - elapsed) / 1000);
      setRemainingSec(remSec);

      if (elapsed >= totalMs) {
        finishGame(true);
        return;
      }

      const trialElapsed = now - st.trialStartMs;
      setTrialProgress(Math.min(1, trialElapsed / trialTimeoutMs));
      if (trialElapsed >= trialTimeoutMs) {
        st.wrong += 1;
        st.combo = 0;
        setWrong(st.wrong);
        setCombo(0);
        setFeedback({ id: Date.now(), kind: "timeout", text: "响应超时" });
        if (settings.sound_fx_enabled) soundFx.playErrorBuzz(0.32);
        advanceTrial(plan);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, plan, durationSec, trialTimeoutMs, advanceTrial, finishGame, settings.sound_fx_enabled]);

  useEffect(() => {
    return () => {
      speechManager.stop();
    };
  }, []);

  const handleStart = async () => {
    setIsStarting(true);
    soundFx.unlock();
    try {
      let nextPlan: Scene2Plan;
      try {
        nextPlan = await api.createScene2Plan({
          duration_sec: durationSec,
          mode,
          conflict_ratio: conflictRatio,
          trial_count: 160,
        });
      } catch {
        nextPlan = buildFallbackStroopPlan(durationSec, mode, conflictRatio);
      }

      if (voiceInterference) {
        await speechManager.prewarm(["红色", "蓝色", "绿色", "黄色"], {
          rate: Math.min(1.4, settings.speech_rate + 0.1),
          volume: settings.speech_volume,
          engine: settings.tts_engine,
          voiceName: settings.voice_name,
          nativeAvailable: nativeTtsAvailable,
        });
      }

      const now = performance.now();
      stateRef.current = {
        playing: true,
        finished: false,
        startedAtIso: new Date().toISOString(),
        sessionStartMs: now,
        trialStartMs: now,
        trialIdx: 0,
        correct: 0,
        wrong: 0,
        combo: 0,
        maxCombo: 0,
        rtList: [],
      };

      setPlan(nextPlan);
      setTrialIdx(0);
      setRemainingSec(durationSec);
      setTrialProgress(0);
      setCorrect(0);
      setWrong(0);
      setCombo(0);
      setMaxCombo(0);
      setAvgRtMs(0);
      setFeedback(null);
      setRuleJustSwitched(false);
      setIsPlaying(true);

      if (settings.sound_fx_enabled) soundFx.playResumeChime(0.4);
      speakDistractor(nextPlan.trials[0]);
    } finally {
      setIsStarting(false);
    }
  };

  if (isPlaying && plan) {
    const trial = plan.trials[trialIdx];
    const totalAnswered = correct + wrong;
    const acc = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 100;
    const inkStyle = COLOR_STYLES[trial.ink_key];
    const isInkRule = trial.rule === "ink";

    return (
      <div className="h-full w-full flex flex-col bg-[#060914] relative overflow-hidden select-none">
        {/* Dynamic full-stage ambient glow shifts strongly between Ink (Fuchsia) & Word (Cyan) */}
        <div
          className={`absolute inset-0 pointer-events-none transition-all duration-300 ${
            isInkRule
              ? "bg-[radial-gradient(circle_at_50%_42%,rgba(217,70,239,0.22),transparent_58%)]"
              : "bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.22),transparent_58%)]"
          }`}
        />

        {/* Top HUD */}
        <header className="relative z-10 safe-top px-3.5 sm:px-6 pb-2 sm:pb-3">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-3.5 sm:px-5 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-white">
                {String(Math.floor(remainingSec / 60)).padStart(2, "0")}:
                {String(Math.ceil(remainingSec) % 60).padStart(2, "0")}
              </div>
              <div className="h-5 sm:h-6 w-px bg-slate-800" />
              <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] sm:text-xs">
                <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                  <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  x{combo}
                </span>
                <span className="text-emerald-300 font-bold tabular-nums">{acc}%</span>
                <span className="text-cyan-300 font-bold tabular-nums">
                  {avgRtMs > 0 ? `${avgRtMs}ms` : "--"}
                </span>
                <span className="hidden sm:inline text-slate-400 tabular-nums">最高连击 {maxCombo}</span>
              </div>
            </div>

            <PushButton variant="rose" size="sm" onClick={() => finishGame(false)}>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>结束</span>
            </PushButton>
          </div>
        </header>

        {/* Center Word Stage */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-4 safe-bottom">
          {/* High-contrast Dual Rule Indicator (instant peripheral vision cue in Mixed Mode!) */}
          {plan.mode === "mixed" && (
            <div className="mb-3 sm:mb-4 grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-md">
              <div
                className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border-2 font-black text-sm sm:text-base transition-all duration-150 ${
                  isInkRule
                    ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100 scale-[1.03] shadow-[0_0_28px_-4px_rgba(217,70,239,0.75)]"
                    : "bg-slate-900/50 border-slate-800 text-slate-600 opacity-45 scale-95"
                }`}
              >
                <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>看颜色</span>
              </div>
              <div
                className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border-2 font-black text-sm sm:text-base transition-all duration-150 ${
                  !isInkRule
                    ? "bg-cyan-500/25 border-cyan-400 text-cyan-100 scale-[1.03] shadow-[0_0_28px_-4px_rgba(34,211,238,0.75)]"
                    : "bg-slate-900/50 border-slate-800 text-slate-600 opacity-45 scale-95"
                }`}
              >
                <Type className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>看字义</span>
              </div>
            </div>
          )}

          {/* Dramatic Stroop Card with Integrated Prominent Rule Header */}
          <div
            key={`${trial.seq}-${feedback?.kind === "miss" ? feedback.id : "ok"}`}
            className={`relative w-full max-w-md rounded-3xl border-2 bg-slate-900/92 backdrop-blur-xl overflow-hidden text-center shadow-2xl transition-colors duration-150 ${
              feedback?.kind === "miss" || feedback?.kind === "timeout"
                ? "border-rose-500 ui-shake"
                : isInkRule
                  ? "border-fuchsia-400/75 shadow-[0_0_50px_-14px_rgba(217,70,239,0.55)]"
                  : "border-cyan-400/75 shadow-[0_0_50px_-14px_rgba(34,211,238,0.55)]"
            }`}
          >
            {/* Unmistakable Rule Banner built right into the card top */}
            <div
              key={`rule-${trial.seq}`}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between border-b ${
                isInkRule
                  ? "bg-gradient-to-r from-fuchsia-600/35 via-purple-600/30 to-fuchsia-600/35 border-fuchsia-400/35 text-fuchsia-100"
                  : "bg-gradient-to-r from-cyan-600/35 via-sky-600/30 to-cyan-600/35 border-cyan-400/35 text-cyan-100"
              }`}
            >
              <div className="flex items-center gap-2">
                {isInkRule ? (
                  <Palette className="w-5 h-5 text-fuchsia-300 shrink-0" />
                ) : (
                  <Type className="w-5 h-5 text-cyan-300 shrink-0" />
                )}
                <span className="text-base sm:text-lg font-black tracking-wide">
                  {isInkRule ? "选【文字颜色】" : "选【字面意思】"}
                </span>
              </div>

              {ruleJustSwitched ? (
                <span className="ui-cue-pop inline-flex items-center gap-1 rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[11px] font-black shadow-[0_0_14px_rgba(251,191,36,0.8)]">
                  <RefreshCw className="w-3 h-3" />
                  规则切换!
                </span>
              ) : (
                <span className="text-xs font-semibold opacity-80">
                  {isInkRule ? "忽略字义" : "忽略颜色"}
                </span>
              )}
            </div>

            <div className="px-6 sm:px-8 pt-6 pb-5 sm:pt-9 sm:pb-7">
              <div
                className={`text-[92px] sm:text-[124px] leading-none font-black ui-cue-pop ${inkStyle.textClass}`}
              >
                {trial.word_text}
              </div>

              {/* Single-trial countdown fuse bar */}
              <div className="mt-6 sm:mt-8 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-75 ${
                    isInkRule
                      ? "bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400"
                      : "bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                  }`}
                  style={{ width: `${Math.max(0, (1 - trialProgress) * 100)}%` }}
                />
              </div>

              {/* Instant micro feedback */}
              <div className="mt-3 sm:mt-4 h-5 flex items-center justify-center text-xs font-bold">
                {feedback && (
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      feedback.kind === "hit" ? "text-emerald-300" : "text-rose-400"
                    }`}
                  >
                    {feedback.kind === "hit" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {feedback.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4 Uiverse Tactile Color Push Buttons */}
          <div className="mt-5 sm:mt-7 w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {COLOR_ORDER.map((c) => {
              const info = COLOR_STYLES[c];
              return (
                <PushButton
                  key={c}
                  variant={info.btnVariant}
                  size="lg"
                  fullWidth
                  onClick={() => handleAnswer(c)}
                >
                  <div className="flex flex-col items-center leading-tight py-1 sm:py-0.5">
                    <span className="text-lg font-black">{info.label}</span>
                    <span className="hidden sm:inline text-[10px] opacity-80 font-mono mt-1">
                      {info.shortcut}
                    </span>
                  </div>
                </PushButton>
              );
            })}
          </div>

          <div className="hidden sm:flex mt-4 text-xs text-slate-500 items-center gap-2">
            <Keyboard className="w-3.5 h-3.5" />
            <span>支持键盘数字键 1-4 或 A / S / D / F 极速作答 · Esc 结束</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-4 sm:px-7 pt-4 sm:pt-7 pb-24 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/35 via-[#0B1224] to-slate-950 p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-bold text-fuchsia-200 mb-3">
                <Palette className="w-3.5 h-3.5" />
                <span>场景 2 · Stroop 色词抗干扰挑战</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                对抗阅读惯性，锻炼大脑前额叶专注抑制
              </h2>
              <p className="text-sm text-slate-300/85 mt-2 leading-relaxed">
                当屏幕上出现绿色的「<span className="text-emerald-400 font-black">红</span>」字时，快速克制字面直觉并点击真实颜色「绿色」。精准追踪毫秒级反应速度与连击准确率。
              </p>
            </div>
            <PushButton
              variant="violet"
              size="lg"
              disabled={isStarting}
              onClick={() => void handleStart()}
              className="min-w-[205px] shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{isStarting ? "准备题库中..." : "开始 Stroop 挑战"}</span>
            </PushButton>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
              <span>规则与时长设定</span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">挑战模式</div>
              <SegmentedControl<"ink" | "mixed">
                options={[
                  { value: "ink", label: "经典认颜色", hint: "始终选文字颜色" },
                  { value: "mixed", label: "高阶规则切换", hint: "随机切看色/看字" },
                ]}
                value={mode}
                onChange={setMode}
                className="w-full grid grid-cols-2"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">训练总时长</div>
              <SegmentedControl
                options={[
                  { value: 30, label: "30 秒", hint: "热身" },
                  { value: 60, label: "60 秒", hint: "标准" },
                  { value: 90, label: "90 秒", hint: "进阶" },
                  { value: 120, label: "2 分钟", hint: "高强度" },
                ]}
                value={durationSec}
                onChange={setDurationSec}
                className="w-full justify-between"
              />
            </div>
          </TactileCard>

          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Volume2 className="w-4 h-4 text-cyan-300" />
              <span>干扰强度与限时</span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">色词冲突比例</div>
              <SegmentedControl
                options={[
                  { value: 0.6, label: "60% 适中" },
                  { value: 0.8, label: "80% 推荐" },
                  { value: 1.0, label: "100% 全冲突" },
                ]}
                value={conflictRatio}
                onChange={setConflictRatio}
                className="w-full justify-between"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">单题反应限时</div>
              <SegmentedControl
                options={[
                  { value: 3000, label: "宽松 3.0s" },
                  { value: 2200, label: "标准 2.2s" },
                  { value: 1400, label: "极限 1.4s" },
                ]}
                value={trialTimeoutMs}
                onChange={setTrialTimeoutMs}
                className="w-full justify-between"
              />
            </div>

            <div className="pt-2 border-t border-slate-800/70">
              <GlowToggle
                checked={voiceInterference}
                onChange={setVoiceInterference}
                label="开启语音听觉干扰（双通道魔鬼难度）"
                description="出题时语音故意念出错误的颜色名称，双重考验抗干扰能力"
              />
            </div>
          </TactileCard>
        </div>
      </div>
    </div>
  );
};
