export type TtsEngineMode = "auto" | "webspeech" | "native";

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

export type AppView = "scene1" | "history" | "scenes";

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
