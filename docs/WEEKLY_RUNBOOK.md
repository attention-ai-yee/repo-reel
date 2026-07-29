# GitHub 周榜视频：一键运行手册

## 每周只跑这一条

```powershell
.\video-flow.ps1 weekly
```

默认使用当天日期，完整输出约 170–190 秒、1080×1920、H.264 + AAC 的中文竖屏视频：

```text
output/github-weekly-日期-v2.mp4
```

首次运行前执行一次：

```powershell
.\video-flow.ps1 setup
```

## 配置模型、声音和渲染

长期默认值在 `config/weekly.json`：

- `editorial.model`：Codex CLI 用来写编辑方案的模型；
- `editorial.reasoning_effort`：编辑推理强度；
- `editorial.timeout_seconds`、`max_attempts`：单次超时与自动重试次数；
- `voice.name`、`rate`、`pitch`：Edge TTS 声线；
- `render.concurrency`：Remotion 并发数。

单次覆盖不用改文件：

```powershell
.\video-flow.ps1 weekly -Model gpt-5.4
.\video-flow.ps1 weekly -Voice zh-CN-XiaoyiNeural
.\video-flow.ps1 weekly -Concurrency 4
```

模型名必须受本机 Codex CLI 版本支持。当前项目默认固定为 `gpt-5.4`，升级 CLI 后可直接在配置或命令行更换。

## 自动执行的阶段

1. `doctor.ps1` 检查 Python、Node、FFmpeg、Chromium 和依赖；
2. `collect_weekly.py` 抓取 GitHub Trending weekly 候选并重排；
3. `auto_prepare.py` 并行读取十个仓库的元数据、README 和官方素材线索；
4. Codex CLI 在 JSON Schema 下生成口播、标题、判断、布局和素材索引；
5. 机器规则检查项目集合、倒序、总字数、禁用 AI 句式、句尾和异常 JSON 字符；
6. 并行下载素材，失败时依次回退到 GitHub 仓库封面和本地占位图；
7. Edge TTS 生成旁白与句子级时间轴；
8. Remotion 渲染，FFmpeg 做最终响度与 fast-start；
9. `verify_full.py` 解码并检查时长、分辨率、帧率、音轨、黑帧和静音。

视频不是由 Codex 内置视频模型直接生成。Codex 只做第 4 步的编辑决策；视觉、音频与编码全部由仓库里的可重复脚本完成。

## 常用模式

先出半分辨率预览：

```powershell
.\video-flow.ps1 weekly -PreviewOnly
```

保留已审核的编辑稿，重新配音和渲染：

```powershell
.\video-flow.ps1 weekly -Edition 2026-07-29 -ReuseEditorial
```

只验证榜单和仓库事实包，不调用模型、不渲染：

```powershell
.\video-flow.ps1 weekly -DossierOnly
```

## 每期可审计产物

- `output/work/weekly-日期/effective-config.json`：本次实际使用的配置；
- `data/weekly-日期.json`：榜单快照；
- `data/dossier-日期.json`：元数据、README 摘要和素材候选；
- `data/editorial-日期.json`：Codex 结构化编辑结果；
- `data/episode-日期.json`：配音与镜头的最终输入；
- `remotion/public/assets/weekly-日期/asset-manifest.json`：实际素材来源；
- `remotion/src/generated/full-timeline.json`：音频和字幕时间轴；
- `output/github-weekly-日期-v2-manifest.json`：成片 QA。

同一期重新调用模型会有措辞差异。需要固定文案时保留 `editorial` 并加 `-ReuseEditorial`；需要逐帧重现时还要保留实际素材、旁白音频、时间轴、依赖锁文件和有效配置。

## 网络故障策略

- GitHub Trending 临时失败：自动重试；若同日期快照已经存在，会明确告警并使用缓存；
- 某个仓库 API 失败：退回榜单描述和 raw README；
- README 图片或视频超时：退回仓库封面；
- 仓库封面也失败：生成本地占位图；
- Codex 输出不合格：带机器检查结果自动重试；
- Codex 超时：在 `timeout_seconds` 后终止本次尝试，不会无限等待。

## 数据口径

当前榜单来自 GitHub Trending weekly 页面候选，再按页面显示的 `stars this week` 重排。它表示 Trending 候选池内的周热度，不是全 GitHub 严格意义上的七日增星排行。若要升级为严格榜单，需要每天保存候选仓库 Star 总数，并计算当天与七日前的差值。
