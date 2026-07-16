# RepoReel

> Turn trending repositories into polished short-form videos.

一个面向小红书、抖音和视频号的 GitHub 周榜竖屏视频流水线。V2 使用 Remotion + FFmpeg、项目官方截图/演示素材、句子级字幕时间轴和原创本地配乐，输出约 3 分钟的 1080×1920 MP4。

V1 的卡片式画面与 Windows SAPI 旁白只保留作技术验证，不再作为成片方案。

## 当前产物

- 41 秒风格样段：`output/github-weekly-v2-pilot.mp4`
- 约 3 分钟完整成片：`output/github-weekly-2026-07-15-v2.mp4`（本地生成，不提交进 Git）
- 完整片配置：`data/full-v2.json`
- 素材来源清单：`remotion/public/assets/full-asset-manifest.json`
- 成片 QA：`output/github-weekly-2026-07-15-v2-manifest.json`

## 每周工作流

统一入口：

```powershell
.\video-flow.ps1 doctor
.\video-flow.ps1 setup
.\video-flow.ps1 prepare -Edition 2026-07-23
.\video-flow.ps1 preview -Edition 2026-07-23 -Episode data\episode-2026-07-23.json
.\video-flow.ps1 full -Edition 2026-07-23 -Episode data\episode-2026-07-23.json
.\video-flow.ps1 publish
```

### 1. 自动采集榜单并生成编辑提纲

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Prepare `
  -Edition 2026-07-23
```

这会生成：

- `data/weekly-2026-07-23.json`
- `data/episode-2026-07-23.draft.json`

提纲故意不自动填满最终口播。每周仍保留一次 Codex 编辑、素材映射和事实核查门，避免重新产生模板腔文案和虚假产品画面。当前 Remotion 场景是本期项目专属设计，新一期需要让 Codex 根据 draft 更新 `v2-pilot.tsx`、`v2-full.tsx` 和素材脚本；它不是无人值守的通用模板引擎。

### 2. 渲染半分辨率预览

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Preview `
  -Edition 2026-07-23 `
  -Episode data\episode-2026-07-23.json
```

### 3. 渲染正式成片并自动 QA

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_weekly.ps1 `
  -Phase Full `
  -Edition 2026-07-23 `
  -Episode data\episode-2026-07-23.json
```

已有素材、声音和依赖时可加：

```powershell
-SkipAssets -SkipVoice -SkipInstall
```

详细步骤与质量门见 [`docs/WEEKLY_RUNBOOK.md`](docs/WEEKLY_RUNBOOK.md) 和 [`docs/V2_QUALITY_PIPELINE.md`](docs/V2_QUALITY_PIPELINE.md)。

## 环境

- Windows
- Python 3.11+
- Node.js / npm
- FFmpeg / FFprobe
- Chromium

安装依赖：

```powershell
.\video-flow.ps1 setup
```

当前完整片按用户选择使用女声 A：`zh-CN-XiaoxiaoNeural`。它是联网、免 API Key 的 Edge TTS，正式周更仍建议在确认 10–20 秒自有参考录音后切换到本地 GPT-SoVITS 或 VoxCPM。

## 数据口径

`scripts/collect_weekly.py` 抓取 GitHub Trending 的 weekly 页面，并按页面显示的 `stars this week` 重排候选项目。它反映 Trending 候选池内的周热度，不等同于全 GitHub 的严格七日增星榜。若要升级为严格榜单，应每日保存候选仓库总 Star 快照并计算 `T - 7 天` 差值。

## 发布源码包

```powershell
.\video-flow.ps1 package
```

输出 `dist/repo-reel-0.3.0-source.zip`。加入本期最终 MP4：

```powershell
.\video-flow.ps1 package -IncludeFinalVideo
```

发布包使用文件白名单，不包含 `.git`、`node_modules`、下载缓存、临时帧或工作日志。第三方素材与依赖说明见 [`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md)。

## 首次发布到 GitHub

登录 GitHub CLI 后，在项目根目录运行：

```powershell
.\video-flow.ps1 publish
```

该命令只适用于空的 `attention-ai-yee/repo-reel` 仓库。它会：

1. 使用 GitHub noreply 邮箱配置本仓库的提交身份；
2. 将分支命名为 `main`；
3. 只暂存 RepoReel V2 的发布白名单；
4. 创建首次提交并推送；
5. 设置仓库简介和 topics。
