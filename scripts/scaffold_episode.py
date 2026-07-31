#!/usr/bin/env python3
"""Create an editorial scaffold from a collected weekly ranking.

This intentionally does not fabricate finished narration. The editorial pass is
kept as a quality gate because fully templated copy recreates the mechanical V1
problem.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAYOUTS = [
    "before-after",
    "terminal-demo",
    "case-mosaic",
    "data-pipeline",
    "routing-map",
    "privacy-transcript",
    "parallel-worktrees",
    "document-triptych",
    "editor-timeline",
    "workflow-funnel",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source = args.input if args.input.is_absolute() else ROOT / args.input
    output = args.output if args.output.is_absolute() else ROOT / args.output
    weekly = json.loads(source.read_text(encoding="utf-8"))
    repos = sorted(weekly["repos"], key=lambda item: item["rank"], reverse=True)

    segments = [
        {
            "id": "hook",
            "kind": "spoken",
            "spoken": "",
            "editorial_prompt": "Use the strongest anomaly in the ranking as an 8-12 second cold open.",
            "onscreen": [],
        },
        {
            "id": "scope",
            "kind": "silent",
            "fixed_seconds": 1.8,
            "onscreen": ["GitHub Trending", "THIS WEEK"],
        },
    ]
    for index, repo in enumerate(repos):
        segments.append(
            {
                "id": f"rank_{repo['rank']:02d}",
                "kind": "spoken",
                "project": repo,
                "layout": LAYOUTS[index],
                "spoken": "",
                "headline": "",
                "verdict": "",
                "onscreen": [
                    f"#{repo['rank']:02d}",
                    repo["name"].upper(),
                    f"+{repo['stars_week']:,}",
                ],
                "asset_requirements": [
                    "one official product screenshot, GIF or MP4",
                    "one backup official asset",
                    "repository license and source URL",
                ],
                "editorial_prompt": "Write pain -> evidence -> judgment. Do not read the README or exact stars aloud.",
                "tail_seconds": 0.3,
            }
        )
        if repo["rank"] == 6:
            segments.append(
                {
                    "id": "mid_reset",
                    "kind": "spoken",
                    "spoken": "",
                    "editorial_prompt": "Reset attention and state the week's emerging pattern in one short judgment.",
                    "onscreen": ["TOP 5"],
                    "tail_seconds": 0.35,
                }
            )
    segments.append(
        {
            "id": "outro",
            "kind": "spoken",
            "spoken": "",
            "editorial_prompt": "Conclude with one specific trend and promise a real test next week.",
            "onscreen": ["NEXT WEEK · REAL TEST"],
            "tail_seconds": 0.8,
        }
    )
    result = {
        "edition": weekly["edition"],
        "status": "needs_editorial_and_asset_review",
        "source": str(source.relative_to(ROOT)).replace("\\", "/"),
        "fps": 30,
        "target_duration_seconds": [170, 180],
        "voice": {
            "provider": "edge",
            "name": "zh-CN-XiaoxiaoNeural",
            "rate": "+4%",
            "pitch": "+0Hz",
            "status": "temporary; replace with approved local brand voice",
        },
        "quality_gates": [
            "880-930 spoken characters maximum",
            "real product evidence for every repository",
            "no repeated sentence openings",
            "no 不是 A 而是 B, 不等于, 说白了, 真正, 本质上 phrasing",
            "vary rhythm: avoid the uniform 痛点 + 它把A、B、C变成D tricolon on every item",
            "no slogan-style 从X到Y endings or 主线只有一条 framing; keep all numbers/names/licenses",
            "one mid-video attention reset",
            "preview approval before full render",
        ],
        "segments": segments,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"scaffold={output}")


if __name__ == "__main__":
    main()
