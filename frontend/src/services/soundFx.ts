/**
 * Procedural Web Audio API sound effects engine — zero external assets, instant offline cues.
 * Includes gentle stereo panning matching the user's current Left/Right hand!
 */
class SoundFxEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.getContext();
  }

  /**
   * Subtle spatial ping when an object is announced.
   * pan: -0.55 (left hand) or +0.55 (right hand), 0 when blind mode neutral.
   */
  public playCuePing(kind: "item_a" | "item_b", pan = 0, volume = 0.25): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = "sine";
    const baseFreq = kind === "item_a" ? 587.33 : 493.88; // D5 vs B4
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.12, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.45, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
      osc.connect(gain).connect(panner).connect(ctx.destination);
    } else {
      osc.connect(gain).connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Rising dual-tone alert when "换手" triggers */
  public playSwapAlert(volume = 0.5): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5 crisp sweep
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.085;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume * 0.45, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /** Crisp countdown tick for 5, 4, 3, 2, 1 */
  public playCountdownTick(secRemaining: number, volume = 0.45): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const freq = secRemaining <= 1 ? 987.77 : secRemaining === 2 ? 830.6 : 698.46;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Bright resume / launch chord */
  public playResumeChime(volume = 0.45): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.05;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume * 0.42, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Uplifting studio completion fanfare */
  public playSessionComplete(volume = 0.5): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.09;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume * 0.38, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  /** Crisp positive confirmation ding (Stroop hit / Go hit / MOT correct) */
  public playSuccessHit(volume = 0.38): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.04;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume * 0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  /** Soft low thud on wrong answer / impulsive false alarm / timeout */
  public playErrorBuzz(volume = 0.42): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.18);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /** Subtle calm shimmer when successfully inhibiting a No-Go impulse */
  public playInhibitGood(volume = 0.28): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.32, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Sci-fi sonar pulse for 3D MOT target highlight / click */
  public playTargetLock(volume = 0.32): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.35, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}

export const soundFx = new SoundFxEngine();
