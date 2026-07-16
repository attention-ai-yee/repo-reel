#!/usr/bin/env python3
"""Fetch real project-owned visual assets used by the V2 style pilot."""

from __future__ import annotations

import json
from pathlib import Path
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "remotion" / "public" / "assets"

ASSETS = [
    {
        "path": "impeccable/logo.png",
        "url": "https://raw.githubusercontent.com/pbakaus/impeccable/main/site/public/assets/brand/impeccable-logo-on-dark.png",
        "repo": "https://github.com/pbakaus/impeccable",
        "license": "Apache-2.0",
    },
    {
        "path": "impeccable/dashboard-before.webp",
        "url": "https://raw.githubusercontent.com/pbakaus/impeccable/main/site/public/assets/dashboard.before.webp",
        "repo": "https://github.com/pbakaus/impeccable",
        "license": "Apache-2.0",
    },
    {
        "path": "impeccable/dashboard-after.webp",
        "url": "https://raw.githubusercontent.com/pbakaus/impeccable/main/site/public/assets/dashboard.after.webp",
        "repo": "https://github.com/pbakaus/impeccable",
        "license": "Apache-2.0",
    },
    {
        "path": "impeccable/landing-before.webp",
        "url": "https://raw.githubusercontent.com/pbakaus/impeccable/main/site/public/assets/landing.before.webp",
        "repo": "https://github.com/pbakaus/impeccable",
        "license": "Apache-2.0",
    },
    {
        "path": "impeccable/landing-after.webp",
        "url": "https://raw.githubusercontent.com/pbakaus/impeccable/main/site/public/assets/landing.after.webp",
        "repo": "https://github.com/pbakaus/impeccable",
        "license": "Apache-2.0",
    },
    {
        "path": "herdr/logo.png",
        "url": "https://raw.githubusercontent.com/ogulcancelik/herdr/master/assets/logo.png",
        "repo": "https://github.com/ogulcancelik/herdr",
        "license": "AGPL-3.0-or-later / commercial dual license",
    },
    {
        "path": "herdr/screenshot.png",
        "url": "https://raw.githubusercontent.com/ogulcancelik/herdr/master/assets/screenshot.png",
        "repo": "https://github.com/ogulcancelik/herdr",
        "license": "AGPL-3.0-or-later / commercial dual license",
    },
    {
        "path": "herdr/terminal-panes.png",
        "url": "https://raw.githubusercontent.com/ogulcancelik/herdr/master/website/assets/terminal-panes.png",
        "repo": "https://github.com/ogulcancelik/herdr",
        "license": "AGPL-3.0-or-later / commercial dual license",
    },
    {
        "path": "herdr/demo.mp4",
        "url": "https://raw.githubusercontent.com/ogulcancelik/herdr/master/website/assets/demo-v2.mp4",
        "repo": "https://github.com/ogulcancelik/herdr",
        "license": "AGPL-3.0-or-later / commercial dual license",
    },
    {
        "path": "ai-job-search/mascot.gif",
        "url": "https://raw.githubusercontent.com/MadsLorentzen/ai-job-search/master/assets/mascot/pip_flight_loop.gif",
        "repo": "https://github.com/MadsLorentzen/ai-job-search",
        "license": "MIT",
    },
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    request_headers = {"User-Agent": "video-flow-v2-pilot/0.2"}
    manifest = []
    for asset in ASSETS:
        target = OUT / asset["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.stat().st_size < 256:
            request = urllib.request.Request(asset["url"], headers=request_headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
        manifest.append({**asset, "bytes": target.stat().st_size})
        print(f"{asset['path']}: {target.stat().st_size:,} bytes")
    (OUT / "asset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
