import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";

class NativeBridge {
  private wakeLockSentinel: WakeLockSentinel | null = null;

  public isNativeMobile(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }

  public async initMobileChrome(): Promise<void> {
    if (!this.isNativeMobile()) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      if (Capacitor.getPlatform() === "android") {
        await StatusBar.setBackgroundColor({ color: "#070B14" });
      }
    } catch {
      // ignore if status bar plugin unavailable
    }
  }

  public async hapticTap(): Promise<void> {
    if (!this.isNativeMobile()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // ignore
    }
  }

  public async hapticMedium(): Promise<void> {
    if (!this.isNativeMobile()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // ignore
    }
  }

  public async hapticSuccess(): Promise<void> {
    if (!this.isNativeMobile()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // ignore
    }
  }

  public async hapticWarning(): Promise<void> {
    if (!this.isNativeMobile()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      // ignore
    }
  }

  public async hapticError(): Promise<void> {
    if (!this.isNativeMobile()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // ignore
    }
  }

  /** Keep phone/desktop screen awake during active training sessions */
  public async acquireWakeLock(): Promise<void> {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (this.wakeLockSentinel) return;
      this.wakeLockSentinel = await navigator.wakeLock.request("screen");
      this.wakeLockSentinel.addEventListener("release", () => {
        this.wakeLockSentinel = null;
      });
    } catch {
      // ignore wake lock errors (e.g. battery saver mode)
    }
  }

  public async releaseWakeLock(): Promise<void> {
    if (!this.wakeLockSentinel) return;
    try {
      await this.wakeLockSentinel.release();
    } catch {
      // ignore
    } finally {
      this.wakeLockSentinel = null;
    }
  }
}

export const nativeBridge = new NativeBridge();
