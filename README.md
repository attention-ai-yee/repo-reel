# RepoReel

> Turn trending repositories into polished short-form videos.

一个面向小红书、抖音和视频号的 GitHub 周榜竖屏视频流水线。V2 使用 Remotion + FFmpeg、项目官方截图/演示素材、句子级字幕时间轴和原创本地配乐，输出约 3 分钟的 1080×1920 MP4。

正式模板采用抖音移动端中央安全区：顶部、底部和右侧互动栏均预留界面遮挡空间，项目名和字幕不会再贴边。仓库同时提供 `GitHubWeeklyV2MobileSafe` QA Composition，用于在发布前叠加模拟遮挡层检查关键帧。

V1 的卡片式画面与 Windows SAPI 旁白只保留作技术验证，不再作为成片方案。

## 当前产物

- 41 秒风格样段：`output/github-weekly-v2-pilot.mp4`
- 约 3 分钟完整成片：`output/github-weekly-2026-07-29-v2.mp4`（本地生成，不提交进 Git）
- 本期编辑方案：`data/editorial-2026-07-29.json`
- 本期完整配置：`data/episode-2026-07-29.json`
- 素材来源清单：`remotion/public/assets/weekly-2026-07-29/asset-manifest.json`
- 成片 QA：`output/github-weekly-2026-07-29-v2-manifest.json`

## 每周工作流

完整周更只有一个入口：

```powershell
.\video-flow.ps1 weekly
```

它会依次完成环境检查、榜单采集、README/元数据整理、Codex 结构化编辑、官方素材下载、女声配音、Remotion 渲染、FFmpeg 响度处理和成片 QA。中间不需要手动修改代码或 JSON。首次使用先运行：

```powershell
.\video-flow.ps1 setup
```

只想先看低分辨率预览：

```powershell
.\video-flow.ps1 weekly -PreviewOnly
```

更换编辑模型或女声：

```powershell
.\video-flow.ps1 weekly -Model gpt-5.4
.\video-flow.ps1 weekly -Voice zh-CN-XiaoyiNeural
```

默认值统一放在 [`config/weekly.json`](config/weekly.json)。Codex CLI 只承担“根据事实包写口播、选镜头和填结构化编辑方案”；它不渲染视频，也不生成配音。画面由 Remotion 在本机逐帧渲染，FFmpeg 负责编码与响度，Edge TTS 生成当前女声。

脚本会自动拒绝禁用句式、项目缺失、顺序错误、半句截断、异常 JSON 字符和超长口播。README 素材下载失败时会切换到 GitHub 仓库封面；封面也失败时使用本地仓库占位图，不会让整期无限等待。

### 可复现重跑

保留同一期 `data/weekly-*`、`data/dossier-*`、`data/editorial-*`、`data/episode-*`、素材目录、音频和时间轴后，Remotion/FFmpeg 层可确定性重跑。想保留已审核文案、重新做配音和画面：

```powershell
.\video-flow.ps1 weekly -Edition 2026-07-29 -ReuseEditorial
```

只检查采集与事实包：

```powershell
.\video-flow.ps1 weekly -DossierOnly
```

编辑模型本身有采样差异，因此重新生成 editorial 不承诺逐字一致；使用 `-ReuseEditorial` 才会固定文案。完整 1080×1920 本地编码仍需数分钟到十几分钟，但执行过程不再要求人工介入。详细产物和故障策略见 [`docs/WEEKLY_RUNBOOK.md`](docs/WEEKLY_RUNBOOK.md)。

### 不依赖 Codex：任意工具生成口播（provider=manual）

Codex 只负责“写口播”这一步，其余采集、素材、配音、渲染、响度、QA 全是确定性脚本。想让任意工具（手写、其他大模型、你自己的脚本）来产出文案、完全不装 Codex，把 [`config/weekly.json`](config/weekly.json) 的 `editorial.provider` 改成 `manual`：

```jsonc
"editorial": { "provider": "manual", ... }
```

然后用任意工具产出本期编辑方案 `data/editorial-<edition>.json`，它必须符合 [`schemas/editorial-plan.schema.json`](schemas/editorial-plan.schema.json)（10 个项目、rank 10→1、字数区间、禁用句式等；校验规则见 `scripts/auto_prepare.py` 的 `validate_editorial`）。再照常运行：

```powershell
.\video-flow.ps1 weekly -Edition 2026-07-31
```

流水线会采集榜单、校验你的编辑方案、下载素材、配音、渲染并做 QA，全程不调用 Codex。`provider=manual` 时 `doctor` 也不再把 Codex CLI 和登录当作必需项。若编辑方案已存在且想直接复用，用 `-ReuseEditorial` 亦可（与 provider 无关）。

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

输出 `dist/repo-reel-0.4.0-source.zip`。加入本期最终 MP4：

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
