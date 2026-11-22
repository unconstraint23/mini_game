import React, { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BookmarkPlus,
  Clock,
  EyeOff,
  Gauge,
  Play,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  Box,
} from "lucide-react";
import type { HealthResponse, ItemPreset, TtsEngineMode, UserSettings } from "../types/game";
import { Scene3DStage } from "../components/Scene3DStage";
import {
  GlowToggle,
  PushButton,
  SegmentedControl,
  TactileCard,
} from "../components/uiverse/UiverseControls";
import { speechManager } from "../services/speech";
import { soundFx } from "../services/soundFx";

interface Scene1SetupViewProps {
  settings: UserSettings;
  presets: ItemPreset[];
  health: HealthResponse | null;
  isStarting: boolean;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onStartTraining: () => void;
  onCreatePreset: (name: string, itemA: string, itemB: string) => Promise<void>;
  onSelectPreset: (preset: ItemPreset) => void;
  onDeletePreset: (presetId: number) => Promise<void>;
}

const DURATION_OPTIONS = [
  { value: 60, label: "1 分钟", hint: "快速热身" },
  { value: 120, label: "2 分钟", hint: "标准推荐" },
  { value: 180, label: "3 分钟", hint: "深度专注" },
  { value: 300, label: "5 分钟", hint: "耐力挑战" },
];

type PaceKey = "relaxed" | "standard" | "fast" | "custom";

const PACE_MAP: Record<Exclude<PaceKey, "custom">, { min: number; max: number }> = {
  relaxed: { min: 2200, max: 3500 },
  standard: { min: 1400, max: 2600 },
  fast: { min: 900, max: 1700 },
};

function detectPaceKey(minMs: number, maxMs: number): PaceKey {
  for (const [key, range] of Object.entries(PACE_MAP)) {
    if (range.min === minMs && range.max === maxMs) {
      return key as Exclude<PaceKey, "custom">;
    }
  }
  return "custom";
}

export const Scene1SetupView: React.FC<Scene1SetupViewProps> = ({
  settings,
  presets,
  health,
  isStarting,
  onUpdateSettings,
  onStartTraining,
  onCreatePreset,
  onSelectPreset,
  onDeletePreset,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => speechManager.getVoices());
  const [testingVoice, setTestingVoice] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState("");
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);

  useEffect(() => {
    const unsub = speechManager.subscribeVoices(() => {
      setVoices(speechManager.getVoices());
    });
    return unsub;
  }, []);

  const paceKey = detectPaceKey(settings.min_interval_ms, settings.max_interval_ms);
  const itemsValid =
    settings.item_a.trim().length > 0 &&
    settings.item_b.trim().length > 0 &&
    settings.item_a.trim() !== settings.item_b.trim();

  const handleTestVoice = async () => {
    setTestingVoice(true);
    soundFx.unlock();
    if (settings.sound_fx_enabled) {
      soundFx.playCuePing("item_a", -0.4, 0.35);
    }
    const sample = `${settings.item_a || "红球"}，${settings.item_b || "蓝球"}，请换手`;
    try {
      await speechManager.speak(sample, {
        rate: settings.speech_rate,
        volume: settings.speech_volume,
        engine: settings.tts_engine,
        voiceName: settings.voice_name,
        nativeAvailable: health?.native_tts_available,
      });
    } finally {
      setTestingVoice(false);
    }
  };

  const handleSwapInputs = () => {
    onUpdateSettings({
      item_a: settings.item_b,
      item_b: settings.item_a,
    });
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPresetError("");
    const cleanName = presetName.trim() || `${settings.item_a} / ${settings.item_b}`;
    try {
      await onCreatePreset(cleanName, settings.item_a.trim(), settings.item_b.trim());
      setPresetName("");
      setShowSavePreset(false);
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : "保存预设失败");
    }
  };

  const estimatedCues = Math.max(
    5,
    Math.round((settings.duration_sec * 1000) / ((settings.min_interval_ms + settings.max_interval_ms) / 2))
  );

  return (
    <div className="relative h-full w-full overflow-y-auto">
      {/* Subtle 3D Studio Preview Header Banner */}
      <div className="relative mx-auto max-w-5xl px-7 pt-7 pb-10 space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/95 via-[#0B1325]/95 to-slate-950/95 p-6 shadow-2xl">
          <div className="absolute inset-0 opacity-85">
            <Scene3DStage
              enabled={settings.enable_3d}
              phase="idle"
              isSwapped={false}
              swapProgress={0}
              blindMode={false}
              activeCue={null}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14]/90 via-[#070B14]/55 to-[#070B14]/85 pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-300 tracking-wide mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>场景 1 · 双物听觉反应与换手专注训练</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                握紧双手物品，听声即刻反应
              </h2>
              <p className="text-sm text-slate-300/85 mt-2 leading-relaxed">
                输入你左右手拿着的两种物品名称。系统将在设定时间内随机语音播报物品名，并在中途突袭播报
                <span className="text-amber-300 font-semibold">「请换手」</span>
                ，随后提供
                <span className="text-amber-300 font-semibold"> {settings.swap_countdown_sec} 秒倒计时</span>
                供你互换双手并重新聚焦。
              </p>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0">
              <PushButton
                variant="cyan"
                size="lg"
                disabled={!itemsValid || isStarting}
                onClick={onStartTraining}
                className="min-w-[210px]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{isStarting ? "正在准备语音..." : "开始反应训练"}</span>
              </PushButton>
              <div className="flex items-center justify-center sm:justify-end gap-3 text-[11px] text-slate-400">
                <span>预计播报 ~{estimatedCues} 次</span>
                <span>·</span>
                <span>中途换手 {settings.swap_count} 次</span>
                <span>·</span>
                <span>换手准备 {settings.swap_countdown_sec}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Dual Hand Items Card */}
        <TactileCard className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white">手持物品设定</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                自由输入任意两种物品，或直接点击下方常用组合一键填充
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestVoice}
                disabled={testingVoice || !itemsValid}
                className="ui-chip text-cyan-200 border-cyan-500/30"
              >
                <Volume2 className={`w-3.5 h-3.5 ${testingVoice ? "animate-pulse text-cyan-300" : ""}`} />
                <span>{testingVoice ? "播报中..." : "语音试听"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSavePreset((v) => !v)}
                disabled={!itemsValid}
                className="ui-chip"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-300" />
                <span>存为预设</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Left Hand Item A */}
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-cyan-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                  初始左手 · 物品 A
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {settings.item_a.length}/20
                </span>
              </label>
              <div className="ui-glow-input-wrap ui-glow-input-wrap--cyan">
                <input
                  type="text"
                  maxLength={20}
                  value={settings.item_a}
                  onChange={(e) => onUpdateSettings({ item_a: e.target.value })}
                  placeholder="例如：红球、水杯、手机..."
                  className="ui-glow-input px-4 py-3 text-base"
                />
              </div>
            </div>

            {/* Quick Swap Button */}
            <div className="flex justify-center md:pt-6">
              <button
                type="button"
                title="对调左右手物品"
                onClick={handleSwapInputs}
                className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-amber-400/60 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right Hand Item B */}
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-orange-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-[0_0_10px_#fb923c]" />
                  初始右手 · 物品 B
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {settings.item_b.length}/20
                </span>
              </label>
              <div className="ui-glow-input-wrap ui-glow-input-wrap--amber">
                <input
                  type="text"
                  maxLength={20}
                  value={settings.item_b}
                  onChange={(e) => onUpdateSettings({ item_b: e.target.value })}
                  placeholder="例如：蓝球、钥匙、钢笔..."
                  className="ui-glow-input px-4 py-3 text-base"
                />
              </div>
            </div>
          </div>

          {!itemsValid && (
            <div className="mt-3 text-xs text-rose-400 font-medium">
              请输入两个不为空且互不相同的物品名称，才能开始反应训练。
            </div>
          )}

          {/* Save Preset Inline Form */}
          {showSavePreset && (
            <form
              onSubmit={handleSavePreset}
              className="mt-4 flex flex-wrap items-center gap-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 p-3"
            >
              <input
                type="text"
                maxLength={24}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={`预设备注名（默认：${settings.item_a} / ${settings.item_b}）`}
                className="flex-1 min-w-[200px] rounded-xl bg-slate-900 border border-slate-700/80 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
              <PushButton type="submit" variant="amber" size="sm">
                保存到本地库
              </PushButton>
              {presetError && <span className="text-xs text-rose-400">{presetError}</span>}
            </form>
          )}

          {/* Preset Quick Chips */}
          <div className="mt-4 pt-4 border-t border-slate-800/70">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2.5">
              常用物品组合（本地 SQLite 同步）
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const isSelected =
                  preset.item_a === settings.item_a && preset.item_b === settings.item_b;
                return (
                  <div
                    key={preset.id}
                    className={`ui-chip group ${isSelected ? "ui-chip--active" : ""}`}
                    onClick={() => onSelectPreset(preset)}
                  >
                    <span className="font-medium text-cyan-200">{preset.item_a}</span>
                    <span className="text-slate-500">/</span>
                    <span className="font-medium text-orange-200">{preset.item_b}</span>
                    <span className="text-[10px] text-slate-400 ml-0.5">· {preset.name}</span>
                    {!preset.is_default && (
                      <button
                        type="button"
                        title="删除自定义预设"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePreset(preset.id);
                        }}
                        className="ml-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TactileCard>

        {/* Section 2: Duration, Pace & Hand-Swap Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Duration & Hand-Swap Rules */}
          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">训练时长与换手机制</h3>
                <p className="text-xs text-slate-400">支持自定义训练总时长与换手准备倒计时</p>
              </div>
            </div>

            {/* Duration presets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">训练总时长</span>
                <span className="text-cyan-300 font-bold tabular-nums">
                  {Math.floor(settings.duration_sec / 60)} 分{" "}
                  {settings.duration_sec % 60 > 0 ? `${settings.duration_sec % 60} 秒` : ""}
                  <span className="text-slate-500 font-normal ml-1">({settings.duration_sec}s)</span>
                </span>
              </div>

              <SegmentedControl
                options={DURATION_OPTIONS}
                value={settings.duration_sec}
                onChange={(v) => onUpdateSettings({ duration_sec: v })}
                className="w-full justify-between"
              />

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min={30}
                  max={600}
                  step={10}
                  value={Math.min(600, settings.duration_sec)}
                  onChange={(e) => onUpdateSettings({ duration_sec: Number(e.target.value) })}
                  className="np-slider flex-1"
                />
                <div className="flex items-center gap-1 rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5">
                  <input
                    type="number"
                    min={15}
                    max={1800}
                    value={settings.duration_sec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        onUpdateSettings({ duration_sec: Math.max(15, Math.min(1800, val)) });
                      }
                    }}
                    className="w-14 bg-transparent text-right text-xs font-bold tabular-nums text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-500">秒</span>
                </div>
              </div>
            </div>

            {/* Hand-swap count & countdown */}
            <div className="pt-4 border-t border-slate-800/70 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5">
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="text-slate-300 font-medium">中途换手次数</span>
                  <span className="text-amber-300 font-extrabold tabular-nums">
                    {settings.swap_count} 次
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={settings.swap_count}
                  onChange={(e) => onUpdateSettings({ swap_count: Number(e.target.value) })}
                  className="np-slider w-full"
                />
                <div className="text-[11px] text-slate-500 mt-2">
                  随机穿插在训练中段，避开首尾区间
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5">
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="text-slate-300 font-medium">换手准备倒计时</span>
                  <span className="text-amber-300 font-extrabold tabular-nums">
                    {settings.swap_countdown_sec} 秒
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={1}
                  value={settings.swap_countdown_sec}
                  onChange={(e) => onUpdateSettings({ swap_countdown_sec: Number(e.target.value) })}
                  className="np-slider w-full"
                />
                <div className="text-[11px] text-slate-500 mt-2">
                  播报「请换手」后立即倒数 {settings.swap_countdown_sec}→1
                </div>
              </div>
            </div>
          </TactileCard>

          {/* Pace, Audio & Immersion Settings */}
          <TactileCard className="p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-300 flex items-center justify-center">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">播报节奏与沉浸体验</h3>
                <p className="text-xs text-slate-400">随机间隔区间防止形成规律记忆，提升真实反应</p>
              </div>
            </div>

            {/* Pace Presets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">播报间隔节奏</span>
                <span className="text-orange-300 font-bold tabular-nums">
                  {(settings.min_interval_ms / 1000).toFixed(1)}s ~{" "}
                  {(settings.max_interval_ms / 1000).toFixed(1)}s
                </span>
              </div>

              <SegmentedControl<PaceKey>
                options={[
                  { value: "relaxed", label: "轻松节奏", hint: "2.2~3.5s" },
                  { value: "standard", label: "标准专注", hint: "1.4~2.6s" },
                  { value: "fast", label: "疾速反应", hint: "0.9~1.7s" },
                ]}
                value={paceKey}
                onChange={(key) => {
                  if (key !== "custom") {
                    const range = PACE_MAP[key];
                    onUpdateSettings({
                      min_interval_ms: range.min,
                      max_interval_ms: range.max,
                    });
                  }
                }}
                className="w-full justify-between"
              />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>最短间隔</span>
                    <span className="tabular-nums text-slate-200">
                      {(settings.min_interval_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={600}
                    max={4000}
                    step={100}
                    value={settings.min_interval_ms}
                    onChange={(e) => {
                      const nextMin = Number(e.target.value);
                      onUpdateSettings({
                        min_interval_ms: nextMin,
                        max_interval_ms: Math.max(nextMin + 300, settings.max_interval_ms),
                      });
                    }}
                    className="np-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>最长间隔</span>
                    <span className="tabular-nums text-slate-200">
                      {(settings.max_interval_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={6000}
                    step={100}
                    value={settings.max_interval_ms}
                    onChange={(e) => {
                      const nextMax = Number(e.target.value);
                      onUpdateSettings({
                        max_interval_ms: nextMax,
                        min_interval_ms: Math.min(settings.min_interval_ms, nextMax - 300),
                      });
                    }}
                    className="np-slider w-full"
                  />
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="pt-4 border-t border-slate-800/70 space-y-3.5">
              <GlowToggle
                checked={settings.blind_mode}
                onChange={(v) => onUpdateSettings({ blind_mode: v })}
                label="纯盲听专注模式"
                description="隐藏播报文字与 3D 高亮闪烁，强制仅靠听觉判断并动作"
              />
              <GlowToggle
                checked={settings.sound_fx_enabled}
                onChange={(v) => onUpdateSettings({ sound_fx_enabled: v })}
                label="立体声效与倒计时提示音"
                description="佩戴耳机时左右声道随当前手持位置自动同步"
              />
              <GlowToggle
                checked={settings.enable_3d}
                onChange={(v) => onUpdateSettings({ enable_3d: v })}
                label="Three.js 3D 交互舞台"
                description="实时渲染双物脉冲特效与换手 3D 轨道互换动画"
              />
            </div>

            {/* Collapsible Voice Settings */}
            <div className="pt-3 border-t border-slate-800/70">
              <button
                type="button"
                onClick={() => setShowAdvancedVoice((v) => !v)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5" />
                  语音播报参数（离线可用 · 语速 {settings.speech_rate.toFixed(2)}x）
                </span>
                <span className="text-[11px] text-slate-500">
                  {showAdvancedVoice ? "收起" : "展开调节"}
                </span>
              </button>

              {showAdvancedVoice && (
                <div className="mt-3.5 space-y-3 rounded-2xl bg-slate-950/75 border border-slate-800/80 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>播报语速</span>
                        <span className="tabular-nums text-cyan-300">
                          {settings.speech_rate.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.75}
                        max={1.6}
                        step={0.05}
                        value={settings.speech_rate}
                        onChange={(e) => onUpdateSettings({ speech_rate: Number(e.target.value) })}
                        className="np-slider w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>语音音量</span>
                        <span className="tabular-nums text-cyan-300">
                          {Math.round(settings.speech_volume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1.0}
                        step={0.05}
                        value={settings.speech_volume}
                        onChange={(e) => onUpdateSettings({ speech_volume: Number(e.target.value) })}
                        className="np-slider w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">语音合成引擎</label>
                      <select
                        value={settings.tts_engine}
                        onChange={(e) =>
                          onUpdateSettings({ tts_engine: e.target.value as TtsEngineMode })
                        }
                        className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                      >
                        <option value="auto">智能离线（推荐，自动选优）</option>
                        <option value="webspeech">系统浏览器语音 (WebSpeech)</option>
                        <option value="native" disabled={!health?.native_tts_available}>
                          Python 离线 WAV 合成引擎{" "}
                          {health?.native_tts_available ? "(已就绪)" : "(当前系统不可用)"}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        系统音色（WebSpeech）
                      </label>
                      <select
                        value={settings.voice_name}
                        onChange={(e) => onUpdateSettings({ voice_name: e.target.value })}
                        className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                      >
                        <option value="">自动匹配中文清晰音色</option>
                        {voices.map((v) => (
                          <option key={`${v.name}-${v.lang}`} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TactileCard>
        </div>

        {/* Bottom quick tips */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 pt-1">
          <span className="inline-flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            训练中按 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Space</kbd> 随时暂停/继续
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-slate-400" />
            所有配置与记录均自动保存在本地 SQLite，完全离线可用
          </span>
        </div>
      </div>
    </div>
  );
};
