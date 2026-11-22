import type { TtsEngineMode } from "../types/game";
import { api } from "./api";

export interface SpeakOptions {
  rate: number;
  volume: number;
  engine: TtsEngineMode;
  voiceName?: string;
  nativeAvailable?: boolean;
}

class SpeechManager {
  private audioCache = new Map<string, string>(); // key -> blob URL
  private currentAudio: HTMLAudioElement | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.refreshVoices();
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        this.refreshVoices();
      });
    }
  }

  public refreshVoices(): SpeechSynthesisVoice[] {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return [];
    }
    const list = window.speechSynthesis.getVoices();
    // Sort Chinese voices first
    this.voices = [...list].sort((a, b) => {
      const aZh = a.lang.toLowerCase().startsWith("zh") ? 0 : 1;
      const bZh = b.lang.toLowerCase().startsWith("zh") ? 0 : 1;
      if (aZh !== bZh) return aZh - bZh;
      return a.name.localeCompare(b.name);
    });
    this.listeners.forEach((fn) => fn());
    return this.voices;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      this.refreshVoices();
    }
    return this.voices;
  }

  public subscribeVoices(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public hasChineseWebVoice(): boolean {
    return this.getVoices().some((v) => v.lang.toLowerCase().startsWith("zh"));
  }

  public pickBestWebVoice(preferredName?: string): SpeechSynthesisVoice | null {
    const all = this.getVoices();
    if (all.length === 0) return null;
    if (preferredName) {
      const exact = all.find((v) => v.name === preferredName);
      if (exact) return exact;
    }
    const preferredOrder = ["Tingting", "Ting-Ting", "Xiaoxiao", "Huihui", "Yaoyao", "Sinji", "Meijia"];
    for (const key of preferredOrder) {
      const hit = all.find(
        (v) => v.lang.toLowerCase().startsWith("zh") && v.name.toLowerCase().includes(key.toLowerCase())
      );
      if (hit) return hit;
    }
    return all.find((v) => v.lang.toLowerCase().startsWith("zh")) || all[0];
  }

  public stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
  }

  private cacheKey(text: string, rate: number): string {
    return `${text.trim()}|${rate.toFixed(2)}`;
  }

  public async prewarm(texts: string[], options: SpeakOptions): Promise<void> {
    const useNative =
      options.engine === "native" ||
      (options.engine === "auto" && !this.hasChineseWebVoice() && options.nativeAvailable);
    if (!useNative) return;

    const unique = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean)));
    try {
      await api.prewarmNativeTts(unique, options.rate);
      await Promise.all(
        unique.map(async (text) => {
          const key = this.cacheKey(text, options.rate);
          if (this.audioCache.has(key)) return;
          try {
            const buf = await api.synthesizeNativeTts(text, options.rate);
            const blob = new Blob([buf], { type: "audio/wav" });
            this.audioCache.set(key, URL.createObjectURL(blob));
          } catch {
            // ignore individual failures during prewarm
          }
        })
      );
    } catch {
      // backend prewarm optional
    }
  }

  public async speak(text: string, options: SpeakOptions): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    this.stop();

    const preferNative =
      options.engine === "native" ||
      (options.engine === "auto" && !this.hasChineseWebVoice() && Boolean(options.nativeAvailable));

    if (preferNative) {
      const ok = await this.speakViaNativeBackend(clean, options.rate, options.volume);
      if (ok) return;
      // Fallback to WebSpeech if backend failed
    }

    const webOk = await this.speakViaWebSpeech(clean, options);
    if (!webOk && options.nativeAvailable) {
      await this.speakViaNativeBackend(clean, options.rate, options.volume);
    }
  }

  private speakViaWebSpeech(text: string, options: SpeakOptions): Promise<boolean> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(guardTimer);
        resolve(ok);
      };

      // Guard against rare Chromium bug where onend does not fire
      const guardTimer = setTimeout(() => done(true), Math.max(2400, text.length * 420));

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "zh-CN";
        utterance.rate = Math.max(0.7, Math.min(1.8, options.rate));
        utterance.volume = Math.max(0.1, Math.min(1.0, options.volume));
        const voice = this.pickBestWebVoice(options.voiceName);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        utterance.onend = () => done(true);
        utterance.onerror = () => done(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        done(false);
      }
    });
  }

  private async speakViaNativeBackend(text: string, rate: number, volume: number): Promise<boolean> {
    try {
      const key = this.cacheKey(text, rate);
      let url = this.audioCache.get(key);
      if (!url) {
        const buf = await api.synthesizeNativeTts(text, rate);
        const blob = new Blob([buf], { type: "audio/wav" });
        url = URL.createObjectURL(blob);
        this.audioCache.set(key, url);
      }

      return await new Promise<boolean>((resolve) => {
        const audio = new Audio(url);
        audio.volume = Math.max(0.1, Math.min(1.0, volume));
        this.currentAudio = audio;
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          if (this.currentAudio === audio) this.currentAudio = null;
          resolve(ok);
        };
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        audio.play().catch(() => finish(false));
      });
    } catch {
      return false;
    }
  }
}

export const speechManager = new SpeechManager();
