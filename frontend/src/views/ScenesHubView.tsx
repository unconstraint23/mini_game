import React from "react";
import { Activity, Eye, Palette, Sparkles, Timer } from "lucide-react";
import type { AppView } from "../types/game";
import { PushButton, TactileCard } from "../components/uiverse/UiverseControls";

interface ScenesHubViewProps {
  onSelectScene: (view: AppView) => void;
}

export const ScenesHubView: React.FC<ScenesHubViewProps> = ({ onSelectScene }) => {
  const scenes: {
    view: AppView;
    badge: string;
    title: string;
    subtitle: string;
    desc: string;
    tags: string[];
    icon: React.ReactNode;
    accent: string;
    btnVariant: "cyan" | "violet" | "amber";
  }[] = [
    {
      view: "scene1",
      badge: "场景 1 · 核心听觉",
      title: "双物听觉反应 + 中途换手训练",
      subtitle: "手持实物听声辨位 · 5 秒换手倒计时",
      desc: "自定义左右手两种真实物品，支持自定义训练时长（默认 2 分钟）、防连发随机语音播报、中途播报「请换手」并触发 5 秒可视 + 听觉倒计时，支持 Three.js 3D 轨道换手与纯盲听模式。",
      tags: ["自定义双物品", "5秒换手倒计时", "Three.js 3D", "离线语音"],
      icon: <Activity className="w-5 h-5 text-cyan-300" />,
      accent: "from-cyan-950/35 via-slate-900/95 to-slate-950 border-cyan-400/35",
      btnVariant: "cyan",
    },
    {
      view: "scene2",
      badge: "场景 2 · 前额叶抗干扰",
      title: "Stroop 色词抗干扰挑战",
      subtitle: "经典心理学专注力与冲动抑制训练",
      desc: "高速闪现字义与字体颜色冲突的色词卡，支持「经典认颜色」与「色词混合切换」双模式，可选语音听觉干扰升级双通道难度，实时统计毫秒反应时与连击准确率。",
      tags: ["色词冲突", "规则动态切换", "语音干扰", "键盘极速作答"],
      icon: <Palette className="w-5 h-5 text-fuchsia-300" />,
      accent: "from-fuchsia-950/35 via-slate-900/95 to-slate-950 border-fuchsia-400/35",
      btnVariant: "violet",
    },
    {
      view: "scene3",
      badge: "场景 3 · 3D 空间追踪",
      title: "3D 多球视觉追踪 (MOT)",
      subtitle: "Three.js 三维物理碰撞与余光注意广度",
      desc: "在三维透视玻璃立方体内同时锁定多颗发光目标球，所有球变同色并高速弹性碰撞交错后，用鼠标在 3D 空间直接点选出目标球，全面提升多目标动态注意力。",
      tags: ["Three.js 3D 物理", "鼠标 3D 拾取", "动态镜头视差", "多档难度"],
      icon: <Eye className="w-5 h-5 text-sky-300" />,
      accent: "from-sky-950/35 via-slate-900/95 to-slate-950 border-sky-400/35",
      btnVariant: "cyan",
    },
    {
      view: "scene4",
      badge: "场景 4 · 急停反射",
      title: "听觉 Go / No-Go 急停反射",
      subtitle: "毫秒级行动触发与冲动急停控制",
      desc: "高频随机播报自定义「行动词」并突袭混入「禁动干扰词」。听到行动词立即拍击大圆反应垫（或按 Space），听到禁动词必须立刻刹住手指，精准衡量响应速度与克制率。",
      tags: ["自定义词库", "毫秒响应窗", "大圆反应垫", "纯盲听模式"],
      icon: <Timer className="w-5 h-5 text-amber-300" />,
      accent: "from-amber-950/35 via-slate-900/95 to-slate-950 border-amber-400/35",
      btnVariant: "amber",
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto px-4 sm:px-7 pt-4 sm:pt-7 pb-24 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              专注与反应力训练场景库
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              覆盖听觉辨识、前额叶抗干扰、3D 视觉追踪与急停冲动抑制，全部 4 大场景均已上线并接入 SQLite 统计档案
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-3 py-1 text-xs font-bold text-emerald-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>4 / 4 场景已就绪</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {scenes.map((item) => (
            <TactileCard
              key={item.view}
              className={`p-6 bg-gradient-to-br flex flex-col justify-between gap-5 ${item.accent}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-950/85 border border-slate-800 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                    {item.badge} · 可用
                  </span>
                </div>

                <h3 className="text-lg font-extrabold text-white">{item.title}</h3>
                <p className="text-xs text-cyan-200/80 font-medium mt-0.5">{item.subtitle}</p>
                <p className="text-xs text-slate-300/85 mt-3 leading-relaxed">{item.desc}</p>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-slate-950/75 border border-slate-800 px-2.5 py-0.5 text-[10px] text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <PushButton
                  variant={item.btnVariant}
                  size="sm"
                  onClick={() => onSelectScene(item.view)}
                >
                  立即进入训练 →
                </PushButton>
              </div>
            </TactileCard>
          ))}
        </div>
      </div>
    </div>
  );
};
