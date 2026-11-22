import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type AppView,
  type CueEvent,
  type HealthResponse,
  type ItemPreset,
  type Scene1Plan,
  type SessionPayload,
  type StatsOverview,
  type TrainingSession,
  type UserSettings,
} from "./types/game";
import { api } from "./services/api";
import { speechManager } from "./services/speech";
import { soundFx } from "./services/soundFx";
import { SidebarNav } from "./components/SidebarNav";
import { Scene1SetupView } from "./views/Scene1SetupView";
import { Scene1PlayView } from "./views/Scene1PlayView";
import { Scene2StroopView } from "./views/Scene2StroopView";
import { Scene3MotView } from "./views/Scene3MotView";
import { Scene4GoNoGoView } from "./views/Scene4GoNoGoView";
import { SessionSummaryModal } from "./views/SessionSummaryModal";
import { HistoryView } from "./views/HistoryView";
import { ScenesHubView } from "./views/ScenesHubView";

/** Client-side fallback plan generator for Scene 1 */
function buildFallbackPlan(s: UserSettings): Scene1Plan {
  const totalMs = s.duration_sec * 1000;
  const maxSaneSwaps = Math.max(0, Math.floor((s.duration_sec - 12) / 18));
  const swaps = Math.min(s.swap_count, maxSaneSwaps);
  const swapPoints: number[] = [];
  if (swaps > 0) {
    const startW = Math.max(8000, totalMs * 0.18);
    const endW = Math.min(totalMs - 8000, totalMs * 0.82);
    const slot = (endW - startW) / swaps;
    for (let i = 0; i < swaps; i++) {
      swapPoints.push(Math.round(startW + slot * (i + 0.5)));
    }
  }

  const events: CueEvent[] = [];
  let seq = 0;
  let cursor = 900;
  let swapIdx = 0;
  let lastKind: "item_a" | "item_b" | null = null;
  let streak = 0;
  let cues = 0;

  while (cursor <= totalMs - 600) {
    if (swapIdx < swapPoints.length && cursor >= swapPoints[swapIdx]) {
      seq += 1;
      events.push({
        seq,
        at_ms: swapPoints[swapIdx],
        kind: "hand_swap",
        label: "换手准备",
        speak_text: "请换手",
        countdown_sec: s.swap_countdown_sec,
      });
      cursor = swapPoints[swapIdx] + 1100;
      swapIdx += 1;
      lastKind = null;
      streak = 0;
      continue;
    }

    let kind: "item_a" | "item_b" = Math.random() < 0.5 ? "item_a" : "item_b";
    if (streak >= 3 && lastKind) {
      kind = lastKind === "item_a" ? "item_b" : "item_a";
    }
    streak = kind === lastKind ? streak + 1 : 1;
    lastKind = kind;
    cues += 1;
    seq += 1;
    const label = kind === "item_a" ? s.item_a : s.item_b;
    events.push({
      seq,
      at_ms: cursor,
      kind,
      label,
      speak_text: label,
      countdown_sec: 0,
    });
    cursor +=
      s.min_interval_ms +
      Math.round(Math.random() * Math.max(200, s.max_interval_ms - s.min_interval_ms));
  }

  return {
    plan_id: `local-${Date.now()}`,
    item_a: s.item_a,
    item_b: s.item_b,
    duration_sec: s.duration_sec,
    swap_countdown_sec: s.swap_countdown_sec,
    expected_cues: cues,
    planned_swaps: swapIdx,
    events,
  };
}

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>("scene1");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [presets, setPresets] = useState<ItemPreset[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);

  const [activePlan, setActivePlan] = useState<Scene1Plan | null>(null);
  const [subScenePlaying, setSubScenePlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [summarySession, setSummarySession] = useState<TrainingSession | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [h, s, p, st, list] = await Promise.all([
        api.getHealth(),
        api.getSettings(),
        api.listPresets(),
        api.getStats(),
        api.listSessions(60),
      ]);
      setHealth(h);
      setSettings(s);
      setPresets(p);
      setStats(st);
      setSessions(list);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let attempts = 0;

    const bootstrap = async () => {
      while (active && attempts < 15) {
        attempts += 1;
        const ok = await refreshData();
        if (ok) return;
        await new Promise((r) => setTimeout(r, 400));
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [refreshData]);

  const handleUpdateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        if (next.item_a.trim() && next.item_b.trim()) {
          void api.saveSettings(next).catch(() => {});
        }
      }, 320);
      return next;
    });
  }, []);

  const handleCreatePreset = useCallback(
    async (name: string, itemA: string, itemB: string) => {
      const created = await api.createPreset({ name, item_a: itemA, item_b: itemB });
      setPresets((prev) => [created, ...prev]);
      showToast(`已保存预设「${created.name}」到 SQLite`);
    },
    [showToast]
  );

  const handleSelectPreset = useCallback(
    (preset: ItemPreset) => {
      handleUpdateSettings({ item_a: preset.item_a, item_b: preset.item_b });
      void api
        .markPresetUsed(preset.id)
        .then((updated) => {
          setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        })
        .catch(() => {});
    },
    [handleUpdateSettings]
  );

  const handleDeletePreset = useCallback(
    async (presetId: number) => {
      await api.deletePreset(presetId);
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      showToast("已删除预设");
    },
    [showToast]
  );

  const startScene1Training = useCallback(
    async (overrideSettings?: UserSettings) => {
      const cfg = overrideSettings ?? settings;
      const itemA = cfg.item_a.trim();
      const itemB = cfg.item_b.trim();
      if (!itemA || !itemB || itemA === itemB) {
        showToast("请输入两种互不相同的物品名称");
        return;
      }

      setIsStarting(true);
      setSummarySession(null);
      soundFx.unlock();

      try {
        let plan: Scene1Plan;
        try {
          await api.saveSettings(cfg);
          plan = await api.createScene1Plan({
            item_a: itemA,
            item_b: itemB,
            duration_sec: cfg.duration_sec,
            min_interval_ms: cfg.min_interval_ms,
            max_interval_ms: cfg.max_interval_ms,
            swap_count: cfg.swap_count,
            swap_countdown_sec: cfg.swap_countdown_sec,
          });
        } catch {
          plan = buildFallbackPlan(cfg);
        }

        const countdownWords = Array.from(
          { length: cfg.swap_countdown_sec },
          (_, i) => String(i + 1)
        );
        await speechManager.prewarm(
          [itemA, itemB, "开始", "请换手", "继续", "训练完成，干得漂亮", ...countdownWords],
          {
            rate: cfg.speech_rate,
            volume: cfg.speech_volume,
            engine: cfg.tts_engine,
            voiceName: cfg.voice_name,
            nativeAvailable: health?.native_tts_available,
          }
        );

        setActiveView("scene1");
        setActivePlan(plan);
      } finally {
        setIsStarting(false);
      }
    },
    [settings, health, showToast]
  );

  const handleFinishAnySession = useCallback(async (payload: SessionPayload) => {
    setActivePlan(null);
    setSubScenePlaying(false);
    try {
      const saved = await api.saveSession(payload);
      setSummarySession(saved);
      const [st, list] = await Promise.all([api.getStats(), api.listSessions(60)]);
      setStats(st);
      setSessions(list);
    } catch {
      setSummarySession({
        ...payload,
        id: Date.now(),
        focus_score: payload.focus_score_override ?? (payload.completed ? 95 : 75),
      });
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      await api.deleteSession(sessionId);
      const [st, list] = await Promise.all([api.getStats(), api.listSessions(60)]);
      setStats(st);
      setSessions(list);
      showToast("已删除该条训练记录");
    },
    [showToast]
  );

  const handleReplayHistoryConfig = useCallback(
    (s: TrainingSession) => {
      const next: UserSettings = {
        ...settings,
        item_a: s.item_a,
        item_b: s.item_b,
        duration_sec: s.configured_duration_sec,
        min_interval_ms: s.min_interval_ms,
        max_interval_ms: s.max_interval_ms,
        swap_countdown_sec: s.swap_countdown_sec,
        blind_mode: s.blind_mode,
      };
      setSettings(next);
      void api.saveSettings(next).catch(() => {});
      setActiveView("scene1");
      showToast(`已载入「${s.item_a} / ${s.item_b}」历史配置`);
    },
    [settings, showToast]
  );

  const isPlayingAny = Boolean(activePlan) || subScenePlaying;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070B14] text-slate-100">
      {!isPlayingAny && (
        <SidebarNav
          activeView={activeView}
          onSelectView={(v) => {
            setSummarySession(null);
            setActiveView(v);
          }}
          disabled={isPlayingAny}
          health={health}
          stats={stats}
        />
      )}

      <main className="relative flex-1 h-full overflow-hidden">
        {activePlan ? (
          <Scene1PlayView
            plan={activePlan}
            settings={settings}
            nativeTtsAvailable={Boolean(health?.native_tts_available)}
            onFinish={handleFinishAnySession}
            onCancel={() => setActivePlan(null)}
          />
        ) : activeView === "scene1" ? (
          <Scene1SetupView
            settings={settings}
            presets={presets}
            health={health}
            isStarting={isStarting}
            onUpdateSettings={handleUpdateSettings}
            onStartTraining={() => void startScene1Training()}
            onCreatePreset={handleCreatePreset}
            onSelectPreset={handleSelectPreset}
            onDeletePreset={handleDeletePreset}
          />
        ) : activeView === "scene2" ? (
          <Scene2StroopView
            settings={settings}
            nativeTtsAvailable={Boolean(health?.native_tts_available)}
            onPlayingChange={setSubScenePlaying}
            onSessionComplete={handleFinishAnySession}
          />
        ) : activeView === "scene3" ? (
          <Scene3MotView
            settings={settings}
            onPlayingChange={setSubScenePlaying}
            onSessionComplete={handleFinishAnySession}
          />
        ) : activeView === "scene4" ? (
          <Scene4GoNoGoView
            settings={settings}
            nativeTtsAvailable={Boolean(health?.native_tts_available)}
            onPlayingChange={setSubScenePlaying}
            onSessionComplete={handleFinishAnySession}
          />
        ) : activeView === "history" ? (
          <HistoryView
            stats={stats}
            sessions={sessions}
            onReplayConfig={handleReplayHistoryConfig}
            onJumpScene={setActiveView}
            onDeleteSession={handleDeleteSession}
          />
        ) : (
          <ScenesHubView onSelectScene={setActiveView} />
        )}
      </main>

      <SessionSummaryModal
        session={summarySession}
        onReplay={() => void startScene1Training()}
        onBackToSetup={() => setSummarySession(null)}
        onViewHistory={() => {
          setSummarySession(null);
          setActiveView("history");
        }}
      />

      {toast && (
        <div className="fixed bottom-5 right-6 z-50 rounded-2xl border border-cyan-400/40 bg-slate-900/95 px-4 py-2.5 text-xs font-semibold text-cyan-200 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.75)] backdrop-blur-md">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;
