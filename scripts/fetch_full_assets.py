#!/usr/bin/env python3
"""Fetch and normalize official project-owned assets for the full V2 episode."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "remotion" / "public" / "assets"
RAW = ROOT / "output" / "work" / "full-assets"

ASSETS = [
    {
        "path": "awesome-llm-apps/banner.png",
        "url": "https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/docs/banner/unwind_black.png",
        "repo": "https://github.com/Shubhamsaboo/awesome-llm-apps",
        "license": "Apache-2.0",
    },
    {
        "path": "awesome-llm-apps/project-graveyard.png",
        "url": "https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/docs/gallery/project-graveyard.png",
        "repo": "https://github.com/Shubhamsaboo/awesome-llm-apps",
        "license": "Apache-2.0",
    },
    {
        "path": "awesome-llm-apps/insurance-claim.png",
        "url": "https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/docs/gallery/insurance-claim-live-team.png",
        "repo": "https://github.com/Shubhamsaboo/awesome-llm-apps",
        "license": "Apache-2.0",
    },
    {
        "path": "awesome-llm-apps/fraud-investigation.png",
        "url": "https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/docs/gallery/ai-fraud-investigation.png",
        "repo": "https://github.com/Shubhamsaboo/awesome-llm-apps",
        "license": "Apache-2.0",
    },
    {
        "path": "_raw/vibe-trading-frontend.mp4",
        "url": "https://raw.githubusercontent.com/HKUDS/Vibe-Trading/main/assets/Frontend.mp4",
        "repo": "https://github.com/HKUDS/Vibe-Trading",
        "license": "MIT",
    },
    {
        "path": "vibe-trading/backtest.png",
        "url": "https://raw.githubusercontent.com/HKUDS/Vibe-Trading/main/assets/feature-cross-market-data-backtesting.png",
        "repo": "https://github.com/HKUDS/Vibe-Trading",
        "license": "MIT",
    },
    {
        "path": "omniroute/dashboard.png",
        "url": "https://raw.githubusercontent.com/diegosouzapw/OmniRoute/release/v3.8.49/docs/screenshots/MainOmniRoute.png",
        "repo": "https://github.com/diegosouzapw/OmniRoute",
        "license": "MIT",
    },
    {
        "path": "omniroute/analytics.png",
        "url": "https://raw.githubusercontent.com/diegosouzapw/OmniRoute/release/v3.8.49/docs/screenshots/03-analytics.png",
        "repo": "https://github.com/diegosouzapw/OmniRoute",
        "license": "MIT",
    },
    {
        "path": "omniroute/health.png",
        "url": "https://raw.githubusercontent.com/diegosouzapw/OmniRoute/release/v3.8.49/docs/screenshots/04-health.png",
        "repo": "https://github.com/diegosouzapw/OmniRoute",
        "license": "MIT",
    },
    {
        "path": "_raw/meetily-demo.gif",
        "url": "https://raw.githubusercontent.com/Zackriya-Solutions/meetily/main/docs/meetily_demo.gif",
        "repo": "https://github.com/Zackriya-Solutions/meetily",
        "license": "MIT",
    },
    {
        "path": "meetily/summary.png",
        "url": "https://raw.githubusercontent.com/Zackriya-Solutions/meetily/main/docs/summary.png",
        "repo": "https://github.com/Zackriya-Solutions/meetily",
        "license": "MIT",
    },
    {
        "path": "orca/hero.jpg",
        "url": "https://raw.githubusercontent.com/stablyai/orca/main/docs/assets/readme-hero.jpg",
        "repo": "https://github.com/stablyai/orca",
        "license": "MIT",
    },
    {
        "path": "_raw/orca-worktrees.gif",
        "url": "https://raw.githubusercontent.com/stablyai/orca/main/docs/assets/feature-wall/parallel-worktrees.gif",
        "repo": "https://github.com/stablyai/orca",
        "license": "MIT",
    },
    {
        "path": "officecli/ppt-process.webp",
        "url": "https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/assets/ppt-process.webp",
        "repo": "https://github.com/iOfficeAI/OfficeCLI",
        "license": "Apache-2.0",
    },
    {
        "path": "_raw/office-word.gif",
        "url": "https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/assets/showcase/word1.gif",
        "repo": "https://github.com/iOfficeAI/OfficeCLI",
        "license": "Apache-2.0",
    },
    {
        "path": "_raw/office-excel.gif",
        "url": "https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/assets/showcase/excel1.gif",
        "repo": "https://github.com/iOfficeAI/OfficeCLI",
        "license": "Apache-2.0",
    },
    {
        "path": "_raw/ai-job-mascot.gif",
        "url": "https://raw.githubusercontent.com/MadsLorentzen/ai-job-search/master/assets/mascot/pip_flight_loop.gif",
        "repo": "https://github.com/MadsLorentzen/ai-job-search",
        "license": "MIT",
    },
]


def run_ffmpeg(*args: str) -> None:
    completed = subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args],
        text=True,
        capture_output=True,
    )
    if completed.returncode:
        raise RuntimeError(completed.stderr)


def download() -> list[dict]:
    request_headers = {"User-Agent": "video-flow-v2-full/0.3"}
    manifest: list[dict] = []
    for asset in ASSETS:
        relative = Path(asset["path"])
        target = (
            RAW / relative.relative_to("_raw")
            if relative.parts and relative.parts[0] == "_raw"
            else OUT / relative
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.stat().st_size < 256:
            request = urllib.request.Request(asset["url"], headers=request_headers)
            with urllib.request.urlopen(request, timeout=90) as response:
                target.write_bytes(response.read())
        manifest.append({**asset, "bytes": target.stat().st_size})
        print(f"{asset['path']}: {target.stat().st_size:,} bytes")
    return manifest


def normalize() -> None:
    transcodes = [
        (RAW / "vibe-trading-frontend.mp4", OUT / "vibe-trading" / "frontend.mp4", 8),
        (RAW / "meetily-demo.gif", OUT / "meetily" / "demo.mp4", 8),
        (RAW / "orca-worktrees.gif", OUT / "orca" / "worktrees.mp4", 7),
        (RAW / "office-word.gif", OUT / "officecli" / "word.mp4", 6),
        (RAW / "office-excel.gif", OUT / "officecli" / "excel.mp4", 6),
    ]
    for source, target, seconds in transcodes:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
            continue
        run_ffmpeg(
            "-i",
            str(source),
            "-t",
            str(seconds),
            "-vf",
            "fps=30,scale='min(1080,iw)':-2:flags=lanczos",
            "-an",
            "-c:v",
            "libx264",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(target),
        )

    mascot = OUT / "ai-job-search" / "mascot.png"
    mascot.parent.mkdir(parents=True, exist_ok=True)
    if not mascot.exists():
        run_ffmpeg(
            "-i",
            str(RAW / "ai-job-mascot.gif"),
            "-frames:v",
            "1",
            str(mascot),
        )

    excel_poster = OUT / "officecli" / "excel.png"
    if not excel_poster.exists():
        run_ffmpeg(
            "-i",
            str(RAW / "office-excel.gif"),
            "-vf",
            "select=eq(n\\,50),scale=900:-2:flags=lanczos",
            "-frames:v",
            "1",
            str(excel_poster),
        )

    pilot_source = ROOT / "output" / "github-weekly-v2-pilot.mp4"
    pilot_target = OUT / "pilot-v2.mp4"
    if not pilot_source.exists():
        raise FileNotFoundError(f"Render the V2 pilot first: {pilot_source}")
    if not pilot_target.exists() or pilot_target.stat().st_mtime < pilot_source.stat().st_mtime:
        shutil.copy2(pilot_source, pilot_target)

    captured_opencut = ROOT / "output" / "playwright" / "opencut-editor-clean.png"
    seeded_opencut = ROOT / "assets" / "seed" / "opencut-editor-clean.png"
    opencut_source = captured_opencut if captured_opencut.exists() else seeded_opencut
    opencut_target = OUT / "opencut" / "editor.png"
    if not opencut_source.exists():
        raise FileNotFoundError(
            "Missing official OpenCut screenshot. Expected either "
            f"{captured_opencut} or {seeded_opencut}"
        )
    opencut_target.parent.mkdir(parents=True, exist_ok=True)
    if not opencut_target.exists() or opencut_target.stat().st_mtime < opencut_source.stat().st_mtime:
        shutil.copy2(opencut_source, opencut_target)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = download()
    normalize()
    manifest.extend(
        [
            {
                "path": "opencut/editor.png",
                "source": "official opencut.app editor captured with Playwright",
                "repo": "https://github.com/OpenCut-app/OpenCut",
                "license": "MIT",
                "bytes": (OUT / "opencut" / "editor.png").stat().st_size,
            },
            {
                "path": "pilot-v2.mp4",
                "source": "local V2 quality-gate render",
                "bytes": (OUT / "pilot-v2.mp4").stat().st_size,
            },
        ]
    )
    (OUT / "full-asset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
