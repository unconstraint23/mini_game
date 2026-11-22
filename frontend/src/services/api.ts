import { Capacitor } from "@capacitor/core";
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
import { localStore } from "./localStore";

let forceLocalOfflineMode = Capacitor.isNativePlatform();

function isElectronDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.neuropulse?.isDesktop);
}

function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.neuropulse?.apiBaseUrl) {
    return window.neuropulse.apiBaseUrl;
  }
  return import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:18765";
}

function useLocalOnly(): boolean {
  return forceLocalOfflineMode || Capacitor.isNativePlatform();
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
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
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  baseUrl: getBaseUrl,

  isLocalOfflineMode: () => useLocalOnly(),

  getHealth: async (): Promise<HealthResponse> => {
    if (useLocalOnly()) {
      return localStore.getHealth();
    }
    try {
      return await requestJson<HealthResponse>("/health", undefined, isElectronDesktop() ? 2500 : 900);
    } catch (err) {
      // On mobile web / standalone PWA (not Electron), gracefully switch to built-in offline engine
      if (!isElectronDesktop()) {
        forceLocalOfflineMode = true;
        return localStore.getHealth();
      }
      throw err;
    }
  },

  getSettings: async (): Promise<UserSettings> => {
    if (useLocalOnly()) return localStore.getSettings();
    return requestJson<UserSettings>("/api/settings");
  },

  saveSettings: async (settings: UserSettings): Promise<UserSettings> => {
    if (useLocalOnly()) return localStore.saveSettings(settings);
    return requestJson<UserSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  listPresets: async (): Promise<ItemPreset[]> => {
    if (useLocalOnly()) return localStore.listPresets();
    return requestJson<ItemPreset[]>("/api/presets");
  },

  createPreset: async (payload: { name: string; item_a: string; item_b: string }): Promise<ItemPreset> => {
    if (useLocalOnly()) return localStore.createPreset(payload);
    return requestJson<ItemPreset>("/api/presets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  markPresetUsed: async (presetId: number): Promise<ItemPreset> => {
    if (useLocalOnly()) return localStore.markPresetUsed(presetId);
    return requestJson<ItemPreset>(`/api/presets/${presetId}/use`, {
      method: "POST",
    });
  },

  deletePreset: async (presetId: number): Promise<{ deleted: boolean }> => {
    if (useLocalOnly()) return localStore.deletePreset(presetId);
    return requestJson<{ deleted: boolean }>(`/api/presets/${presetId}`, {
      method: "DELETE",
    });
  },

  createScene1Plan: async (payload: {
    item_a: string;
    item_b: string;
    duration_sec: number;
    min_interval_ms: number;
    max_interval_ms: number;
    swap_count: number;
    swap_countdown_sec: number;
  }): Promise<Scene1Plan> => {
    if (useLocalOnly()) return localStore.createScene1Plan(payload);
    return requestJson<Scene1Plan>("/api/scene1/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createScene2Plan: async (payload: {
    duration_sec: number;
    mode: "ink" | "mixed";
    conflict_ratio: number;
    trial_count?: number;
  }): Promise<Scene2Plan> => {
    if (useLocalOnly()) return localStore.createScene2Plan(payload);
    return requestJson<Scene2Plan>("/api/scene2/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createScene4Plan: async (payload: {
    go_words: string[];
    nogo_words: string[];
    duration_sec: number;
    min_interval_ms: number;
    max_interval_ms: number;
    nogo_ratio: number;
    response_window_ms: number;
  }): Promise<Scene4Plan> => {
    if (useLocalOnly()) return localStore.createScene4Plan(payload);
    return requestJson<Scene4Plan>("/api/scene4/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  saveSession: async (payload: SessionPayload): Promise<TrainingSession> => {
    if (useLocalOnly()) return localStore.saveSession(payload);
    return requestJson<TrainingSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listSessions: async (limit = 50, sceneId?: string): Promise<TrainingSession[]> => {
    if (useLocalOnly()) return localStore.listSessions(limit, sceneId);
    const query = sceneId
      ? `?limit=${limit}&scene_id=${encodeURIComponent(sceneId)}`
      : `?limit=${limit}`;
    return requestJson<TrainingSession[]>(`/api/sessions${query}`);
  },

  deleteSession: async (sessionId: number): Promise<{ deleted: boolean }> => {
    if (useLocalOnly()) return localStore.deleteSession(sessionId);
    return requestJson<{ deleted: boolean }>(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },

  getStats: async (): Promise<StatsOverview> => {
    if (useLocalOnly()) return localStore.getStats();
    return requestJson<StatsOverview>("/api/stats");
  },

  prewarmNativeTts: async (texts: string[], rate: number): Promise<{ available: boolean; warmed: number }> => {
    if (useLocalOnly()) return { available: Capacitor.isNativePlatform(), warmed: 0 };
    return requestJson<{ available: boolean; warmed: number }>("/api/tts/prewarm", {
      method: "POST",
      body: JSON.stringify({ texts, rate }),
    });
  },

  synthesizeNativeTts: async (text: string, rate: number): Promise<ArrayBuffer> => {
    if (useLocalOnly()) {
      throw new Error("Local mode uses native mobile TTS plugin or WebSpeech");
    }
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
