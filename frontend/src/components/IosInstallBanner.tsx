import React, { useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "neuropulse_ios_pwa_tip_dismissed_v1";

/**
 * Lightweight, dismissible installation tip shown only in mobile iOS Safari
 * when the user hasn't yet added NeuroPulse to their Home Screen.
 */
export const IosInstallBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const shouldShow = useMemo(() => {
    if (dismissed || typeof window === "undefined") return false;
    if (Capacitor.isNativePlatform() || window.neuropulse?.isDesktop) return false;
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    return isIos && !isStandalone;
  }, [dismissed]);

  if (!shouldShow) return null;

  const handleClose = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="md:hidden shrink-0 mx-3 mt-2 rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-cyan-950/75 via-slate-900/95 to-slate-900/95 px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs shadow-lg">
      <div className="flex items-center gap-2 min-w-0 text-slate-200 leading-snug">
        <span className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
          <Share className="w-3.5 h-3.5" />
        </span>
        <span>
          点底部 <strong className="text-cyan-300">分享</strong> →{" "}
          <strong className="text-white">添加到主屏幕</strong>，可像原生 App 离线全屏使用
        </span>
      </div>
      <button
        type="button"
        aria-label="关闭安装提示"
        onClick={handleClose}
        className="text-slate-400 hover:text-white p-1 shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
