import type {
  HealthResponse,
  ItemPreset,
  Scene1Plan,
  Scene2Plan,
  Scene4Plan,
  SessionPayload,
  StatsOverview,
  TrainingSession,
  UserSettings,
} from "../types/game";

function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.neuropulse?.apiBaseUrl) {
    return window.neuropulse.apiBaseUrl;
  }
  return import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:18765";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: getBaseUrl,

  getHealth: () => requestJson<HealthResponse>("/health"),

  getSettings: () => requestJson<UserSettings>("/api/settings"),

  saveSettings: (settings: UserSettings) =>
    requestJson<UserSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  listPresets: () => requestJson<ItemPreset[]>("/api/presets"),

  createPreset: (payload: { name: string; item_a: string; item_b: string }) =>
    requestJson<ItemPreset>("/api/presets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  markPresetUsed: (presetId: number) =>
    requestJson<ItemPreset>(`/api/presets/${presetId}/use`, {
      method: "POST",
    }),

  deletePreset: (presetId: number) =>
    requestJson<{ deleted: boolean }>(`/api/presets/${presetId}`, {
      method: "DELETE",
    }),

  createScene1Plan: (payload: {
    item_a: string;
    item_b: string;
    duration_sec: number;
    min_interval_ms: number;
    max_interval_ms: number;
    swap_count: number;
    swap_countdown_sec: number;
  }) =>
    requestJson<Scene1Plan>("/api/scene1/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createScene2Plan: (payload: {
    duration_sec: number;
    mode: "ink" | "mixed";
    conflict_ratio: number;
    trial_count?: number;
  }) =>
    requestJson<Scene2Plan>("/api/scene2/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createScene4Plan: (payload: {
    go_words: string[];
    nogo_words: string[];
    duration_sec: number;
    min_interval_ms: number;
    max_interval_ms: number;
    nogo_ratio: number;
    response_window_ms: number;
  }) =>
    requestJson<Scene4Plan>("/api/scene4/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  saveSession: (payload: SessionPayload) =>
    requestJson<TrainingSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (limit = 50, sceneId?: string) => {
    const query = sceneId
      ? `?limit=${limit}&scene_id=${encodeURIComponent(sceneId)}`
      : `?limit=${limit}`;
    return requestJson<TrainingSession[]>(`/api/sessions${query}`);
  },

  deleteSession: (sessionId: number) =>
    requestJson<{ deleted: boolean }>(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    }),

  getStats: () => requestJson<StatsOverview>("/api/stats"),

  prewarmNativeTts: (texts: string[], rate: number) =>
    requestJson<{ available: boolean; warmed: number }>("/api/tts/prewarm", {
      method: "POST",
      body: JSON.stringify({ texts, rate }),
    }),

  synthesizeNativeTts: async (text: string, rate: number): Promise<ArrayBuffer> => {
    const res = await fetch(`${getBaseUrl()}/api/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, rate }),
    });
    if (!res.ok) {
      throw new Error(`Native TTS failed (${res.status})`);
    }
    return await res.arrayBuffer();
  },
};
