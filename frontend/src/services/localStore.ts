import { Capacitor } from "@capacitor/core";
import {
  DEFAULT_SETTINGS,
  type ColorKey,
  type CueEvent,
  type DailyActivity,
  type GoNoGoEvent,
  type HealthResponse,
  type ItemPreset,
  type Scene1Plan,
  type Scene2Plan,
  type Scene4Plan,
  type SessionPayload,
  type StatsOverview,
  type StroopTrial,
  type TrainingSession,
  type UserSettings,
} from "../types/game";

const KEYS = {
  settings: "neuropulse_settings_v1",
  presets: "neuropulse_presets_v1",
  sessions: "neuropulse_sessions_v1",
} as const;

const DEFAULT_PRESETS_SEED: Array<[string, string, string]> = [
  ["经典反应双球", "红球", "蓝球"],
  ["桌面随手拿", "水杯", "手机"],
  ["办公专注组", "钢笔", "钥匙"],
  ["徒手零道具", "左手", "右手"],
  ["果香辨识组", "苹果", "橙子"],
];

const STROOP_COLORS: Array<[ColorKey, string]> = [
  ["red", "红"],
  ["blue", "蓝"],
  ["green", "绿"],
  ["yellow", "黄"],
];
const STROOP_TEXT: Record<ColorKey, string> = {
  red: "红",
  blue: "蓝",
  green: "绿",
  yellow: "黄",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ensurePresets(): ItemPreset[] {
  const existing = readJson<ItemPreset[] | null>(KEYS.presets, null);
  if (existing && Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  const now = new Date().toISOString();
  const seeded: ItemPreset[] = DEFAULT_PRESETS_SEED.map(([name, item_a, item_b], idx) => ({
    id: idx + 1,
    name,
    item_a,
    item_b,
    is_default: true,
    use_count: 0,
    created_at: now,
  }));
  writeJson(KEYS.presets, seeded);
  return seeded;
}

function readSessions(): TrainingSession[] {
  return readJson<TrainingSession[]>(KEYS.sessions, []);
}

export const localStore = {
  getHealth(): HealthResponse {
    const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web";
    return {
      status: "ok",
      version: "1.2.0",
      platform,
      native_tts_available: Capacitor.isNativePlatform(),
      db_path: "local-offline",
    };
  },

  getSettings(): UserSettings {
    const saved = readJson<Partial<UserSettings> | null>(KEYS.settings, null);
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  },

  saveSettings(settings: UserSettings): UserSettings {
    const clean: UserSettings = {
      ...settings,
      item_a: settings.item_a.trim() || DEFAULT_SETTINGS.item_a,
      item_b: settings.item_b.trim() || DEFAULT_SETTINGS.item_b,
      max_interval_ms: Math.max(settings.min_interval_ms + 200, settings.max_interval_ms),
    };
    writeJson(KEYS.settings, clean);
    return clean;
  },

  listPresets(): ItemPreset[] {
    const list = ensurePresets();
    return [...list].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? 1 : -1;
      if (a.use_count !== b.use_count) return b.use_count - a.use_count;
      return b.id - a.id;
    });
  },

  createPreset(payload: { name: string; item_a: string; item_b: string }): ItemPreset {
    const name = payload.name.trim();
    const item_a = payload.item_a.trim();
    const item_b = payload.item_b.trim();
    if (!item_a || !item_b) throw new Error("两种物品名称不能为空");
    if (item_a === item_b) throw new Error("两种物品名称不能相同");

    const list = ensurePresets();
    const nextId = list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const created: ItemPreset = {
      id: nextId,
      name: name || `${item_a} / ${item_b}`,
      item_a,
      item_b,
      is_default: false,
      use_count: 1,
      created_at: new Date().toISOString(),
    };
    writeJson(KEYS.presets, [created, ...list]);
    return created;
  },

  markPresetUsed(presetId: number): ItemPreset {
    const list = ensurePresets();
    let updated: ItemPreset | null = null;
    const next = list.map((p) => {
      if (p.id === presetId) {
        updated = { ...p, use_count: p.use_count + 1 };
        return updated;
      }
      return p;
    });
    if (!updated) throw new Error("预设不存在");
    writeJson(KEYS.presets, next);
    return updated;
  },

  deletePreset(presetId: number): { deleted: boolean } {
    const list = ensurePresets();
    writeJson(
      KEYS.presets,
      list.filter((p) => p.id !== presetId)
    );
    return { deleted: true };
  },

  createScene1Plan(payload: {
    item_a: string;
    item_b: string;
    duration_sec: number;
    min_interval_ms: number;
    max_interval_ms: number;
    swap_count: number;
    swap_countdown_sec: number;
  }): Scene1Plan {
    const totalMs = payload.duration_sec * 1000;
    const maxSaneSwaps = Math.max(0, Math.floor((payload.duration_sec - 12) / 18));
    const effectiveSwaps = Math.min(payload.swap_count, maxSaneSwaps);

    const swapTriggers: number[] = [];
    if (effectiveSwaps > 0) {
      const startW = Math.max(8000, Math.floor(totalMs * 0.18));
      const endW = Math.min(totalMs - 8000, Math.floor(totalMs * 0.82));
      if (endW > startW) {
        const slot = (endW - startW) / effectiveSwaps;
        for (let i = 0; i < effectiveSwaps; i++) {
          const center = startW + slot * (i + 0.5);
          const jitter = Math.min(slot * 0.28, 6000);
          const t = Math.round(center + (Math.random() * 2 - 1) * jitter);
          swapTriggers.push(Math.max(startW, Math.min(endW, t)));
        }
        swapTriggers.sort((a, b) => a - b);
      }
    }

    const events: CueEvent[] = [];
    let seq = 0;
    let cursor = 900;
    let swapIdx = 0;
    let countA = 0;
    let countB = 0;
    let lastKind: "item_a" | "item_b" | null = null;
    let streak = 0;

    while (cursor <= totalMs - 600) {
      if (swapIdx < swapTriggers.length && cursor >= swapTriggers[swapIdx]) {
        seq += 1;
        events.push({
          seq,
          at_ms: swapTriggers[swapIdx],
          kind: "hand_swap",
          label: "换手准备",
          speak_text: "请换手",
          countdown_sec: payload.swap_countdown_sec,
        });
        cursor = swapTriggers[swapIdx] + 1100;
        lastKind = null;
        streak = 0;
        swapIdx += 1;
        continue;
      }

      let chosen: "item_a" | "item_b";
      if (streak >= 3 && lastKind) {
        chosen = lastKind === "item_a" ? "item_b" : "item_a";
      } else {
        const diff = countA - countB;
        const probA = Math.max(0.28, Math.min(0.72, 0.5 - diff * 0.05));
        chosen = Math.random() < probA ? "item_a" : "item_b";
      }

      streak = chosen === lastKind ? streak + 1 : 1;
      lastKind = chosen;
      if (chosen === "item_a") countA += 1;
      else countB += 1;

      const label = chosen === "item_a" ? payload.item_a : payload.item_b;
      seq += 1;
      events.push({
        seq,
        at_ms: cursor,
        kind: chosen,
        label,
        speak_text: label,
        countdown_sec: 0,
      });

      const span = Math.max(200, payload.max_interval_ms - payload.min_interval_ms);
      cursor += payload.min_interval_ms + Math.round(Math.random() * span);
    }

    return {
      plan_id: `local-s1-${Date.now().toString(36)}`,
      item_a: payload.item_a,
      item_b: payload.item_b,
      duration_sec: payload.duration_sec,
      swap_countdown_sec: payload.swap_countdown_sec,
      expected_cues: countA + countB,
      planned_swaps: swapIdx,
      events,
    };
  },

  createScene2Plan(payload: {
    duration_sec: number;
    mode: "ink" | "mixed";
    conflict_ratio: number;
    trial_count?: number;
  }): Scene2Plan {
    const count = payload.trial_count ?? 160;
    const keys = STROOP_COLORS.map(([k]) => k);
    const trials: StroopTrial[] = [];
    let prev = "";

    for (let seq = 1; seq <= count; seq++) {
      const wantConflict = Math.random() < payload.conflict_ratio;
      let wordKey: ColorKey = keys[0];
      let inkKey: ColorKey = keys[0];
      for (let attempt = 0; attempt < 10; attempt++) {
        wordKey = keys[Math.floor(Math.random() * keys.length)];
        if (wantConflict) {
          const others = keys.filter((k) => k !== wordKey);
          inkKey = others[Math.floor(Math.random() * others.length)];
        } else {
          inkKey = wordKey;
        }
        if (`${wordKey}-${inkKey}` !== prev) break;
      }
      prev = `${wordKey}-${inkKey}`;
      const rule: "ink" | "word" =
        payload.mode === "ink" ? "ink" : Math.random() < 0.5 ? "ink" : "word";
      const answerKey = rule === "ink" ? inkKey : wordKey;
      const distractors = keys.filter((k) => k !== answerKey);
      const distractorKey = distractors[Math.floor(Math.random() * distractors.length)];

      trials.push({
        seq,
        word_key: wordKey,
        word_text: STROOP_TEXT[wordKey],
        ink_key: inkKey,
        rule,
        answer_key: answerKey,
        is_conflict: wordKey !== inkKey,
        distractor_speak: STROOP_TEXT[distractorKey],
      });
    }

    return {
      plan_id: `local-s2-${Date.now().toString(36)}`,
      mode: payload.mode,
      duration_sec: payload.duration_sec,
      trials,
    };
  },

  createScene4Plan(payload: {
    go_words: string[];
    nogo_words: string[];
    duration_sec: number;
    min_interval_ms: number;
    max_interval_ms: number;
    nogo_ratio: number;
    response_window_ms: number;
  }): Scene4Plan {
    const totalMs = payload.duration_sec * 1000;
    const events: GoNoGoEvent[] = [];
    let cursor = 900;
    let seq = 0;
    let goCount = 0;
    let nogoCount = 0;
    let nogoStreak = 0;
    let goStreak = 0;

    while (cursor <= totalMs - 800) {
      seq += 1;
      let kind: "go" | "nogo";
      if (seq <= 2 || nogoStreak >= 2) kind = "go";
      else if (goStreak >= 5) kind = "nogo";
      else kind = Math.random() < payload.nogo_ratio ? "nogo" : "go";

      if (kind === "go") {
        goCount += 1;
        goStreak += 1;
        nogoStreak = 0;
      } else {
        nogoCount += 1;
        nogoStreak += 1;
        goStreak = 0;
      }

      const pool = kind === "go" ? payload.go_words : payload.nogo_words;
      events.push({
        seq,
        at_ms: cursor,
        kind,
        word: pool[Math.floor(Math.random() * pool.length)],
        response_window_ms: payload.response_window_ms,
      });

      const effMin = Math.max(payload.min_interval_ms, payload.response_window_ms + 180);
      const effMax = Math.max(payload.max_interval_ms, effMin + 250);
      cursor += effMin + Math.round(Math.random() * (effMax - effMin));
    }

    return {
      plan_id: `local-s4-${Date.now().toString(36)}`,
      duration_sec: payload.duration_sec,
      response_window_ms: payload.response_window_ms,
      go_count: goCount,
      nogo_count: nogoCount,
      events,
    };
  },

  saveSession(payload: SessionPayload): TrainingSession {
    let focusScore: number;
    if (typeof payload.focus_score_override === "number") {
      focusScore = Math.min(100, Math.max(0, Math.round(payload.focus_score_override)));
    } else {
      const ratio = Math.min(1, payload.actual_duration_sec / Math.max(1, payload.configured_duration_sec));
      const base = Math.round(ratio * 85);
      const bonus = payload.completed ? 10 : 0;
      const blindBonus = payload.blind_mode && payload.completed ? 5 : 0;
      focusScore = Math.min(100, Math.max(10, base + bonus + blindBonus));
    }

    const existing = readSessions();
    const nextId = existing.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const saved: TrainingSession = {
      ...payload,
      id: nextId,
      focus_score: focusScore,
      extra_metrics: payload.extra_metrics ?? {},
    };
    writeJson(KEYS.sessions, [saved, ...existing].slice(0, 500));
    return saved;
  },

  listSessions(limit = 50, sceneId?: string): TrainingSession[] {
    const all = readSessions();
    const filtered = sceneId ? all.filter((s) => s.scene_id === sceneId) : all;
    return filtered.slice(0, Math.max(1, Math.min(200, limit)));
  },

  deleteSession(sessionId: number): { deleted: boolean } {
    const all = readSessions();
    writeJson(
      KEYS.sessions,
      all.filter((s) => s.id !== sessionId)
    );
    return { deleted: true };
  },

  getStats(): StatsOverview {
    const rows = readSessions();
    const total_sessions = rows.length;
    const completed_sessions = rows.filter((r) => r.completed).length;
    const total_focus_sec = rows.reduce((sum, r) => sum + r.actual_duration_sec, 0);
    const total_cues = rows.reduce((sum, r) => sum + r.total_cues, 0);
    const total_swaps = rows.reduce((sum, r) => sum + r.swap_count_completed, 0);

    const today = new Date();
    const todayStr = toLocalDateStr(today);
    const dailyMap = new Map<string, { sessions: number; duration_sec: number; cues: number }>();

    for (const r of rows) {
      const d = new Date(r.ended_at);
      const key = Number.isNaN(d.getTime()) ? todayStr : toLocalDateStr(d);
      const prev = dailyMap.get(key) ?? { sessions: 0, duration_sec: 0, cues: 0 };
      prev.sessions += 1;
      prev.duration_sec += r.actual_duration_sec;
      prev.cues += r.total_cues;
      dailyMap.set(key, prev);
    }

    let streak_days = 0;
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!dailyMap.has(toLocalDateStr(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (dailyMap.has(toLocalDateStr(cursor))) {
      streak_days += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const recent_7_days: DailyActivity[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const key = toLocalDateStr(d);
      const info = dailyMap.get(key) ?? { sessions: 0, duration_sec: 0, cues: 0 };
      recent_7_days.push({
        date: key,
        sessions: info.sessions,
        duration_sec: info.duration_sec,
        cues: info.cues,
      });
    }

    const todayInfo = dailyMap.get(todayStr) ?? { sessions: 0, duration_sec: 0, cues: 0 };
    return {
      total_sessions,
      completed_sessions,
      total_focus_sec,
      total_cues,
      total_swaps,
      streak_days,
      today_sessions: todayInfo.sessions,
      today_focus_sec: todayInfo.duration_sec,
      recent_7_days,
    };
  },
};
