import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Keyboard,
  Palette,
  Play,
  Sparkles,
  Square,
  Volume2,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  ColorKey,
  Scene2Plan,
  SessionPayload,
  StroopTrial,
  UserSettings,
} from "../types/game";
import { api } from "../services/api";
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
    const rule: "ink" | "word" = mode === "ink" ? "ink" : Math.random() < 0.65 ? "ink" : "word";
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
      const nextIdx = (st.trialIdx + 1) % currentPlan.trials.length;
      st.trialIdx = nextIdx;
      st.trialStartMs = performance.now();
      setTrialIdx(nextIdx);
      setTrialProgress(0);
      speakDistractor(currentPlan.trials[nextIdx]);
    },
    [speakDistractor]
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
      } else {
        st.wrong += 1;
        st.combo = 0;
        setWrong(st.wrong);
        setCombo(0);
        setFeedback({
          id: Date.now(),
          kind: "miss",
          text: `应选「${COLOR_STYLES[currentTrial.answer_key].label}」`,
        });
        if (settings.sound_fx_enabled) soundFx.playErrorBuzz(0.38);
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

    return (
      <div className="h-full w-full flex flex-col bg-[#060914] relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(192,132,252,0.14),transparent_55%)] pointer-events-none" />

        {/* Top HUD */}
        <header className="relative z-10 px-6 pt-5 pb-3">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="text-3xl font-black tabular-nums text-white">
                {String(Math.floor(remainingSec / 60)).padStart(2, "0")}:
                {String(Math.ceil(remainingSec) % 60).padStart(2, "0")}
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                  <Flame className="w-4 h-4" />
                  连击 x{combo}
                </span>
                <span className="text-emerald-300 font-bold tabular-nums">正确率 {acc}%</span>
                <span className="text-cyan-300 font-bold tabular-nums">
                  均速 {avgRtMs > 0 ? `${avgRtMs}ms` : "--"}
                </span>
                <span className="text-slate-400 tabular-nums">
                  最高连击 {maxCombo}
                </span>
              </div>
            </div>

            <PushButton variant="rose" size="sm" onClick={() => finishGame(false)}>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>结束挑战</span>
            </PushButton>
          </div>
        </header>

        {/* Center Word Stage */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          {/* Rule instruction badge */}
          <div
            className={`mb-5 inline-flex items-center gap-2 rounded-full px-5 py-1.5 text-xs font-extrabold tracking-wide border ${
              trial.rule === "ink"
                ? "bg-fuchsia-500/15 border-fuchsia-400/45 text-fuchsia-200"
                : "bg-cyan-500/15 border-cyan-400/45 text-cyan-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {trial.rule === "ink"
                ? "请选出【文字的实际颜色】（忽略字义！）"
                : "请选出【文字的字面含义】（忽略颜色！）"}
            </span>
          </div>

          {/* Dramatic Stroop Card */}
          <div
            key={`${trial.seq}-${feedback?.kind === "miss" ? feedback.id : "ok"}`}
            className={`relative w-full max-w-md rounded-3xl border bg-slate-900/90 backdrop-blur-xl px-8 py-12 text-center shadow-2xl ${
              feedback?.kind === "miss" || feedback?.kind === "timeout"
                ? "border-rose-500/60 ui-shake"
                : "border-slate-700/80"
            }`}
          >
            <div className={`text-[120px] leading-none font-black ui-cue-pop ${inkStyle.textClass}`}>
              {trial.word_text}
            </div>

            {/* Single-trial countdown fuse bar */}
            <div className="mt-8 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-cyan-400 to-amber-400 transition-[width] duration-75"
                style={{ width: `${Math.max(0, (1 - trialProgress) * 100)}%` }}
              />
            </div>

            {/* Instant micro feedback */}
            <div className="mt-4 h-5 flex items-center justify-center text-xs font-bold">
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

          {/* 4 Uiverse Tactile Color Push Buttons */}
          <div className="mt-8 w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <div className="flex flex-col items-center leading-tight py-0.5">
                    <span className="text-lg font-black">{info.label}</span>
                    <span className="text-[10px] opacity-80 font-mono mt-1">{info.shortcut}</span>
                  </div>
                </PushButton>
              );
            })}
          </div>

          <div className="mt-5 text-xs text-slate-500 flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5" />
            <span>支持键盘数字键 1-4 或 A / S / D / F 极速作答 · Esc 结束</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-7 pt-7 pb-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/35 via-[#0B1224] to-slate-950 p-6 shadow-2xl">
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
