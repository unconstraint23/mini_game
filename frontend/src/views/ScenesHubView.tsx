import React from "react";
import { Activity, Eye, Palette, Sparkles, Timer } from "lucide-react";
import { PushButton, TactileCard } from "../components/uiverse/UiverseControls";

interface ScenesHubViewProps {
  onOpenScene1: () => void;
}

export const ScenesHubView: React.FC<ScenesHubViewProps> = ({ onOpenScene1 }) => {
  const upcoming = [
    {
      badge: "场景 2 · 规划中",
      title: "Stroop 色词抗干扰挑战",
      desc: "屏幕高速闪现“字义与颜色冲突”的视觉词卡，锻炼大脑前额叶的冲动抑制与选择性专注。",
      icon: <Palette className="w-5 h-5 text-fuchsia-300" />,
      accent: "from-fuchsia-500/20 to-purple-500/10 border-fuchsia-500/25",
    },
    {
      badge: "场景 3 · 规划中",
      title: "3D 多球视觉追踪 (MOT)",
      desc: "基于 Three.js 在三维空间追踪多个高速交错运动的目标光球，系统性提升空间注意力广度。",
      icon: <Eye className="w-5 h-5 text-sky-300" />,
      accent: "from-sky-500/20 to-cyan-500/10 border-sky-500/25",
    },
    {
      badge: "场景 4 · 规划中",
      title: "听觉 Go / No-Go 急停反射",
      desc: "高频随机播报动作词并混入“禁动干扰词”，训练毫秒级听觉辨识与肌肉急停控制力。",
      icon: <Timer className="w-5 h-5 text-amber-300" />,
      accent: "from-amber-500/20 to-orange-500/10 border-amber-500/25",
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto px-7 pt-7 pb-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">专注与反应力训练场景库</h2>
          <p className="text-xs text-slate-400 mt-1">
            模块化桌面端架构，方便持续扩充更多反应力与专注力训练小游戏
          </p>
        </div>

        {/* Active Scene 1 Hero Card */}
        <TactileCard className="p-6 border-cyan-400/35 bg-gradient-to-br from-cyan-950/35 via-slate-900/95 to-slate-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-3 py-1 text-[11px] font-bold text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>场景 1 · 已上线可用</span>
              </div>
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-cyan-300" />
                双物听觉反应 + 中途换手训练
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                自定义左右手两种真实物品，支持自定义训练时长（默认 2 分钟）、防连续随机语音播报、中途随机播报「请换手」并附带 5 秒可视 + 听觉倒计时，以及 Three.js 3D 联动与纯盲听模式。
              </p>
            </div>
            <PushButton variant="cyan" size="md" onClick={onOpenScene1} className="shrink-0">
              进入场景 1
            </PushButton>
          </div>
        </TactileCard>

        {/* Future extensible scenes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcoming.map((item) => (
            <div
              key={item.title}
              className={`rounded-2xl border bg-gradient-to-br p-5 flex flex-col justify-between ${item.accent}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-full border border-slate-800">
                    {item.badge}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">{item.title}</h4>
                <p className="text-xs text-slate-300/80 mt-2 leading-relaxed">{item.desc}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/10 text-[11px] text-slate-400">
                已预留后端 <code className="text-cyan-300/90 font-mono">scene_id</code> 数据结构与前端路由扩展位
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
