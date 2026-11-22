# NeuroPulse · 灵动反应训练（桌面端）

一款面向 **macOS** 与 **Windows 11** 的轻量级反应力与专注力训练桌面小游戏，内置 **4 大专业认知与反应训练场景**，采用 **下载即用、零环境依赖、全离线可用** 的独立桌面端架构（Electron + React + Three.js + Python FastAPI + SQLite）。

## 直接下载（点击即下）

> 所有安装包均通过 GitHub Releases 公开托管，点击下方固定链接即可始终下载最新版本：

| 平台 | 文件类型 | 一键直链下载 |
| --- | --- | --- |
| **Android (安卓手机/平板)** | 安装包 `.apk` | [下载 NeuroPulse-Android.apk](https://github.com/unconstraint23/mini_game/releases/latest/download/NeuroPulse-Android.apk) |
| **macOS (Apple Silicon)** | 安装镜像 `.dmg` | [下载 NeuroPulse-macOS-arm64.dmg](https://github.com/unconstraint23/mini_game/releases/latest/download/NeuroPulse-macOS-arm64.dmg) |
| **macOS (Apple Silicon)** | 绿色压缩包 `.zip` | [下载 NeuroPulse-macOS-arm64.zip](https://github.com/unconstraint23/mini_game/releases/latest/download/NeuroPulse-macOS-arm64.zip) |
| **Windows 11 (x64)** | 安装程序 `.exe` | [下载 NeuroPulse-Win11-Setup.exe](https://github.com/unconstraint23/mini_game/releases/latest/download/NeuroPulse-Win11-Setup.exe) |
| **Windows 11 (x64)** | 免安装便携版 `.exe` | [下载 NeuroPulse-Win11-Portable.exe](https://github.com/unconstraint23/mini_game/releases/latest/download/NeuroPulse-Win11-Portable.exe) |

- **iOS (iPhone / iPad)**：已内置 Capacitor 7 + Swift Package Manager 完整 Xcode 工程（[frontend/ios](file:///Volumes/person/person_code/tool_game/frontend/ios)），执行 `pnpm run mobile:ios` 在 Xcode 中打开即可真机安装或导出 IPA（同时兼容移动端 PWA 添加到主屏幕离线运行）。
- 发布页总览：[GitHub Releases (Latest)](https://github.com/unconstraint23/mini_game/releases/latest)
- **macOS 首次打开提示**：安装包已内置严格深度自签名；首次从浏览器下载打开若提示“无法验证开发者”，在「系统设置 → 隐私与安全性」点击 **「仍要打开」**（或在终端执行 `xattr -cr /Applications/NeuroPulse.app`）即可正常打开。

## 全部 4 大训练场景

| 场景 | 能力训练方向 | 核心玩法与交互 |
| --- | --- | --- |
| **场景 1 · 双物听觉反应** | 听觉辨识 + 双手协同 | 自定义左右手真实握持的两种物品（默认 `红球 / 蓝球`，支持收藏预设）；默认 2 分钟（15s~30min 可配）防连发随机语音播报；中途随机播报「请换手」后暂停主计时器并触发 **5 秒可视 + 听觉倒计时** 与 3D 物体交叉换位轨道动画；支持纯盲听模式与耳机左右声道联动。 |
| **场景 2 · Stroop 色词抗干扰** | 前额叶专注与冲动抑制 | 高速闪现字义与颜色冲突的色词卡；支持「经典认颜色」与「色词混合动态切换」双模式、冲突比例（60%/80%/100%）、单题限时（3.0s/2.2s/1.4s）以及可选**语音听觉干扰**；支持鼠标点击 Uiverse 3D 彩色按钮或键盘 `1-4` / `A S D F` 极速作答。 |
| **场景 3 · 3D 多球视觉追踪 (MOT)** | 三维空间注意广度 | 基于 Three.js 实时构建带深度网格的三维玻璃立方体；支持多球平滑三维弹性碰撞与防穿模排斥运动；完整包含「青色目标锁定 → 同色三维高速交错追踪 → 鼠标 3D Raycast 直接悬停点选 → 逐球揭晓」四阶段，支持动态镜头缓动视差与入门/标准/大师难度微调。 |
| **场景 4 · 听觉 Go / No-Go 急停** | 毫秒级反应与冲动急停 | 支持自定义「行动词（如拍手、出拳）」与「禁动干扰词（如停、别动）」词库及主题预设；听到行动词即刻拍击 Uiverse 大圆反应垫（或按 `Space`/`Enter`），听到禁动词必须瞬间急停；实时区分并统计行动命中、漏击超时、成功急停克制、冲动误触与平均反应时。 |

## 核心亮点

- **双引擎离线语音播报**：内置浏览器 Web Speech 与 Python 本地原生离线 WAV 合成引擎（macOS `say` / Windows 11 PowerShell SAPI）并带内存预热缓存，无需联网或配置任何 API Key。
- **Uiverse.io 风格拟物微交互 + Three.js 3D 舞台**：3D 物理按压按钮、发光输入框、弹性开关、毛玻璃卡片、换手雷达光环与 Web Audio API 实时合成提示音效。
- **本地 SQLite 专注档案**：零配置 WAL 模式数据库，自动持久化用户设置、物品预设以及全部 4 大场景的训练得分、反应速度、命中率、连续专注天数与近 7 天活跃图表，支持按场景筛选与历史配置复现。
- **跨平台桌面独立分发**：通过 PyInstaller 将 Python 后端打包为免环境 Sidecar 随 Electron 一起封装；启动时自动分配空闲本地端口、绕过系统代理直连 `127.0.0.1`，关闭时自动清理后台进程。

## 技术栈

| 层级 | 技术选型 |
| --- | --- |
| 桌面端与打包 | Electron 35 + electron-builder（macOS `.dmg`/`.zip` + Windows 11 NSIS `.exe`/便携版） |
| 前端界面 | React 19 + TypeScript 5 + Vite 6 + TailwindCSS v4 + Uiverse 风格 CSS 组件库 |
| 3D 引擎与音效 | Three.js（实时双核舞台 + 3D MOT 物理碰撞与 Raycaster 拾取）+ Web Audio API |
| 本地后端 | Python 3.13 + FastAPI + Uvicorn + Pydantic v2 + PyInstaller (`onedir` 极速启动 Sidecar) |
| 本地数据库 | SQLite3（内置零安装，支持无损在线表结构迁移，存放于系统 `userData` 目录） |

## 目录结构

```text
.
├── electron/                     # Electron 主进程（Python Sidecar 生命周期、动态端口）与 Preload 桥接
├── frontend/                     # React + TailwindCSS + Three.js 前端工程
│   └── src/
│       ├── components/           # Three.js 舞台、3D MOT 引擎、换手倒计时遮罩、Uiverse 控件与侧边栏
│       ├── services/             # Typed API 客户端、双引擎语音播报、Web Audio 音效合成
│       ├── styles/               # Tailwind 入口与 Uiverse 拟物微交互样式库
│       └── views/                # 场景 1~4 页面、训练场景库、结算弹窗与多场景统计档案
├── backend/                      # Python FastAPI + SQLite 本地服务
│   ├── app/                      # database.py / scheduler.py / tts_service.py / routes.py / schemas.py
│   ├── tests/                    # Pytest 自动化接口与规则测试
│   └── neuropulse_backend.spec   # PyInstaller 独立可执行文件打包配置
├── scripts/                      # 开发联调启动器 (dev.mjs) 与后端打包脚本 (build-backend.mjs)
├── build-resources/              # 应用图标与构建期生成的独立 Python Sidecar
├── electron-builder.yml          # macOS 与 Windows 11 桌面安装包配置
└── .github/workflows/release.yml # GitHub Actions 双端自动构建工作流
```

## 本地后端 REST API 概览

| 接口 | 说明 |
| --- | --- |
| `GET /health` | 健康检查、平台与离线原生语音状态 |
| `GET / PUT /api/settings` | 读取 / 保存场景 1 偏好与语音参数 |
| `GET / POST / DELETE /api/presets` | 管理自定义双物预设组合 |
| `POST /api/scene1/plan` | 生成场景 1 防连发随机播报与换手时间轴 |
| `POST /api/scene2/plan` | 生成场景 2 Stroop 色词冲突题库 |
| `POST /api/scene4/plan` | 生成场景 4 Go / No-Go 急停播报时间轴 |
| `GET / POST / DELETE /api/sessions` | 读取（支持 `scene_id` 筛选）、保存与删除训练记录 |
| `GET /api/stats` | 汇总连续专注天数、累计时长、事件总数与近 7 天活跃数据 |
| `POST /api/tts/synthesize` & `/api/tts/prewarm` | 原生离线 WAV 语音合成与批量缓存预热 |

## 开发、测试与打包

### 1. 环境初始化

```bash
# 安装根目录与前端依赖
pnpm run install:all

# 创建 Python 虚拟环境并安装依赖（推荐 Python 3.11 ~ 3.13）
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

### 2. 一键开发联调

```bash
# 同时启动 Python 后端 + Vite 热更新前端 + Electron 桌面窗口
pnpm run dev
```

### 3. 运行验证测试与编译检查

```bash
# Python 后端单元测试（7 项测试覆盖 4 大场景调度、SQLite 持久化与原生 TTS）
cd backend && .venv/bin/pytest -v

# 前端 TypeScript + Vite 构建 + Electron 主进程编译
pnpm run build
```

### 4. 打包独立桌面与移动端安装包（用户下载即用）

```bash
# macOS：构建前端 + Python Sidecar + 严格深度自签名 + 输出 release/NeuroPulse-macOS-arm64.dmg/.zip
pnpm run dist:mac

# Windows 11（在 Win11 环境执行）：输出 release/NeuroPulse-Win11-Setup.exe 与 Portable.exe
pnpm run dist:win

# 同步前端到 Android & iOS 原生 Capacitor 工程
pnpm run mobile:sync

# 在 Android Studio 中打开 Android 工程（或命令行在 frontend/android 执行 ./gradlew assembleRelease）
pnpm run mobile:android

# 在 Xcode 中打开 iOS SwiftPM 工程（无需 CocoaPods，直连 iPhone/iPad 真机或打包 IPA）
pnpm run mobile:ios
```

推送 `v*` 标签（如 `git tag v1.2.0 && git push origin v1.2.0`）或在 GitHub Actions 手动触发 [release.yml](file:///Volumes/person/person_code/tool_game/.github/workflows/release.yml) 即可自动同时构建并发布 **macOS `.dmg`/`.zip`、Windows 11 `.exe` 与 Android `.apk`** 至 GitHub Releases。

## 快捷键一览

- **场景 1（双物反应）**：`Space` 暂停 / 继续，`Esc` 提前结束并结算
- **场景 2（Stroop）**：`1 / 2 / 3 / 4` 或 `A / S / D / F` 快速选色，`Esc` 结束挑战
- **场景 3（3D 追踪）**：鼠标左键直接点选 3D 光球，`Enter` 确认锁定答案，`Esc` 结束追踪
- **场景 4（Go / No-Go）**：`Space` / `Enter` 或点击大圆按钮毫秒拍击，`Esc` 结束训练
