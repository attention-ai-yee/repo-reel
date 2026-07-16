# GitHub 周榜视频：每周运行手册

## 目标

每周生成一条约 170–180 秒、1080×1920、H.264 + AAC 的中文竖屏视频。机械步骤一键执行，但保留两个人工质量门：

1. Codex 编辑口播并核验事实；
2. 先看半分辨率预览，再允许正式渲染。

这两个门是为了避免 V1 出现的模板文案、假界面和机械节奏。

## 周一：准备数据

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Prepare `
  -Edition 2026-07-23
```

输出：

- `data/weekly-2026-07-23.json`：Trending 候选池内按 weekly stars 重排的 Top 10；
- `data/episode-2026-07-23.draft.json`：待编辑的口播、镜头和素材需求提纲。

若 GitHub 页面结构改变，采集器会在解析不到 10 个项目时直接失败，不会静默生成错误榜单。

## 编辑门

让 Codex基于 draft 完成以下工作：

1. 每项使用“具体痛点 → 功能证据 → 主播判断”；
2. 直接说明项目做什么，禁止“不是 A，而是 B”“不等于”“说白了”“真正”“本质上”等套话；
3. 总口播控制在约 880–930 个字符；
4. 不逐个朗读精确 Star；
5. 每个项目至少登记一个官方截图、GIF、MP4 或可核验 README 证据；
6. 规划中能力必须明确标成 roadmap，不能说成已完成；
7. 第 6 名后加入一次注意力重置；
8. 生成最终 `data/episode-日期.json` 和该期素材脚本/清单。

## 预览门

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Preview `
  -Edition 2026-07-23 `
  -Episode data\episode-2026-07-23.json
```

检查：

- 开头 8 秒是否立刻出现异常数字或冲突；
- 相邻项目是否使用了不同镜头结构；
- 项目真实界面是否占主要画面；
- 字幕是否最多两至三行且不挡核心 UI；
- 英文项目名、数字和停顿是否自然；
- 是否存在整屏黑帧、长时间静止或重复卡片。

## 正式渲染

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Full `
  -Edition 2026-07-23 `
  -Episode data\episode-2026-07-23.json
```

流水线依次执行：

1. 下载并预处理官方素材；
2. 生成旁白和句子级精确时间轴；
3. 生成不含排名切换提示音的原创配乐；
4. TypeScript 类型检查；
5. Remotion 1080×1920 渲染；
6. FFmpeg 调整到约 -16 LUFS；
7. 全程解码、分辨率、帧率、音频和黑帧检查；
8. 输出 MP4 与 QA manifest。

## 快速重跑

只有画面代码变化时：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Full `
  -Edition 2026-07-23 `
  -Episode data\episode-2026-07-23.json `
  -SkipAssets -SkipVoice -SkipInstall
```

文案发生变化时不要加 `-SkipVoice`，否则会错误复用旧旁白。

## 声音说明

当前 Edge 声线只用于验证流程。固定栏目声线的推荐步骤：

1. 准备 10–20 秒干净、自有版权、无背景音乐的参考录音及准确文字；
2. 用 GPT-SoVITS CPU 与 VoxCPM 本地生成同一段 15 秒盲听样本；
3. 只比较自然度、停顿、英文项目名和客服腔；
4. 通过后把本地提供器接入 `generate_voice.py` 的时间轴输出格式。
