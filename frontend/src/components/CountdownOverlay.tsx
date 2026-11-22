import React from "react";
import { ArrowLeftRight } from "lucide-react";

interface CountdownOverlayProps {
  visible: boolean;
  secondsRemaining: number;
  totalCountdownSec: number;
  progress: number; // 0..1
  nextLeftItem: string;
  nextRightItem: string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  visible,
  secondsRemaining,
  totalCountdownSec,
  progress,
  nextLeftItem,
  nextRightItem,
}) => {
  if (!visible) return null;

  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * Math.min(1, Math.max(0, progress));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 backdrop-blur-md">
      <div className="relative flex flex-col items-center px-10 py-9 rounded-3xl border border-amber-400/40 bg-slate-900/90 shadow-[0_0_80px_-15px_rgba(249,115,22,0.55)] max-w-lg w-[92%] text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-400/40 px-4 py-1.5 text-amber-300 text-xs font-bold tracking-widest uppercase mb-5">
          <ArrowLeftRight className="w-4 h-4 animate-pulse" />
          <span>换手准备阶段 · 倒计时 {totalCountdownSec} 秒</span>
        </div>

        {/* Concentric Uiverse Radar + SVG Ring */}
        <div className="relative flex items-center justify-center w-52 h-52 my-1">
          <div className="absolute inset-4 rounded-full border-2 border-amber-400/45 ui-swap-radar" />
          <div className="absolute inset-4 rounded-full border-2 border-orange-500/35 ui-swap-radar--delayed" />

          <svg className="w-52 h-52 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="rgba(148,163,184,0.16)"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="url(#swapGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 80ms linear" }}
            />
            <defs>
              <linearGradient id="swapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              key={secondsRemaining}
              className="text-7xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 drop-shadow-[0_0_24px_rgba(251,191,36,0.6)] ui-cue-pop"
            >
              {Math.max(1, secondsRemaining)}
            </span>
            <span className="text-xs font-medium text-amber-200/80 tracking-wider mt-1">
              请迅速互换手中物品
            </span>
          </div>
        </div>

        {/* Visual Hand Mapping Preview */}
        <div className="mt-6 w-full grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3.5">
          <div className="text-left">
            <div className="text-[11px] text-slate-400">换手后 · 左手持有</div>
            <div className="text-base font-bold text-cyan-300 truncate mt-0.5">{nextLeftItem}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">换手后 · 右手持有</div>
            <div className="text-base font-bold text-orange-300 truncate mt-0.5">{nextRightItem}</div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          倒计时结束后将语音播报「继续」并自动恢复反应训练，主计时器已自动暂停
        </p>
      </div>
    </div>
  );
};
