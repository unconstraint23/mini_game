export type TtsEngineMode = "auto" | "webspeech" | "native";

export type SceneId =
  | "scene_1_dual_object"
  | "scene_2_stroop"
  | "scene_3_mot_3d"
  | "scene_4_gonogo";

export interface SceneMetaInfo {
  id: SceneId;
  shortTag: string;
  title: string;
  badgeClass: string;
}

export const SCENE_META: Record<SceneId, SceneMetaInfo> = {
  scene_1_dual_object: {
    id: "scene_1_dual_object",
    shortTag: "场景 1 · 双物反应",
    title: "双物听觉反应 + 换手训练",
    badgeClass: "bg-cyan-500/15 border-cyan-400/35 text-cyan-200",
  },
  scene_2_stroop: {
    id: "scene_2_stroop",
    shortTag: "场景 2 · Stroop",
    title: "Stroop 色词抗干扰挑战",
    badgeClass: "bg-fuchsia-500/15 border-fuchsia-400/35 text-fuchsia-200",
  },
  scene_3_mot_3d: {
    id: "scene_3_mot_3d",
    shortTag: "场景 3 · 3D追踪",
    title: "3D 多球视觉追踪 (MOT)",
    badgeClass: "bg-sky-500/15 border-sky-400/35 text-sky-200",
  },
  scene_4_gonogo: {
    id: "scene_4_gonogo",
    shortTag: "场景 4 · 急停反射",
    title: "听觉 Go / No-Go 急停反射",
    badgeClass: "bg-amber-500/15 border-amber-400/35 text-amber-200",
  },
};

export interface HealthResponse {
  status: string;
  version: string;
  platform: string;
  native_tts_available: boolean;
  db_path: string;
}

export interface ItemPreset {
  id: number;
  name: string;
  item_a: string;
  item_b: string;
  is_default: boolean;
  use_count: number;
  created_at: string;
}

export interface UserSettings {
  item_a: string;
  item_b: string;
  duration_sec: number;
  min_interval_ms: number;
  max_interval_ms: number;
  swap_count: number;
  swap_countdown_sec: number;
  speech_rate: number;
  speech_volume: number;
  tts_engine: TtsEngineMode;
  voice_name: string;
  sound_fx_enabled: boolean;
  blind_mode: boolean;
  enable_3d: boolean;
}

export type CueKind = "item_a" | "item_b" | "hand_swap";

export interface CueEvent {
  seq: number;
  at_ms: number;
  kind: CueKind;
  label: string;
  speak_text: string;
  countdown_sec: number;
}

export interface Scene1Plan {
  plan_id: string;
  item_a: string;
  item_b: string;
  duration_sec: number;
  swap_countdown_sec: number;
  expected_cues: number;
  planned_swaps: number;
  events: CueEvent[];
}

// Scene 2: Stroop
export type ColorKey = "red" | "blue" | "green" | "yellow";

export interface StroopTrial {
  seq: number;
  word_key: ColorKey;
  word_text: string;
  ink_key: ColorKey;
  rule: "ink" | "word";
  answer_key: ColorKey;
  is_conflict: boolean;
  distractor_speak: string;
}

export interface Scene2Plan {
  plan_id: string;
  mode: "ink" | "mixed";
  duration_sec: number;
  trials: StroopTrial[];
}

// Scene 4: Go / No-Go
export interface GoNoGoEvent {
  seq: number;
  at_ms: number;
  kind: "go" | "nogo";
  word: string;
  response_window_ms: number;
}

export interface Scene4Plan {
  plan_id: string;
  duration_sec: number;
  response_window_ms: number;
  go_count: number;
  nogo_count: number;
  events: GoNoGoEvent[];
}

export interface SessionPayload {
  scene_id: string;
  item_a: string;
  item_b: string;
  configured_duration_sec: number;
  actual_duration_sec: number;
  total_cues: number;
  item_a_count: number;
  item_b_count: number;
  swap_count_completed: number;
  swap_countdown_sec: number;
  min_interval_ms: number;
  max_interval_ms: number;
  blind_mode: boolean;
  completed: boolean;
  focus_score_override?: number;
  extra_metrics?: Record<string, number | string | boolean>;
  started_at: string;
  ended_at: string;
}

export interface TrainingSession extends SessionPayload {
  id: number;
  focus_score: number;
}

export interface DailyActivity {
  date: string;
  sessions: number;
  duration_sec: number;
  cues: number;
}

export interface StatsOverview {
  total_sessions: number;
  completed_sessions: number;
  total_focus_sec: number;
  total_cues: number;
  total_swaps: number;
  streak_days: number;
  today_sessions: number;
  today_focus_sec: number;
  recent_7_days: DailyActivity[];
}

export type AppView = "scene1" | "scene2" | "scene3" | "scene4" | "history" | "scenes";

export type PlayPhase = "idle" | "ready" | "playing" | "swapping" | "paused" | "completed";

export interface NeuroPulseDesktopBridge {
  apiBaseUrl: string;
  platform: string;
  appVersion: string;
  isDesktop: boolean;
  getBackendStatus: () => Promise<{ apiBaseUrl: string; ready: boolean }>;
  openDataFolder: () => Promise<void>;
}

declare global {
  interface Window {
    neuropulse?: NeuroPulseDesktopBridge;
  }
}

export const DEFAULT_SETTINGS: UserSettings = {
  item_a: "红球",
  item_b: "蓝球",
  duration_sec: 120,
  min_interval_ms: 1400,
  max_interval_ms: 2600,
  swap_count: 2,
  swap_countdown_sec: 5,
  speech_rate: 1.05,
  speech_volume: 1.0,
  tts_engine: "auto",
  voice_name: "",
  sound_fx_enabled: true,
  blind_mode: false,
  enable_3d: true,
};
