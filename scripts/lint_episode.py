#!/usr/bin/env python3
"""Reject mechanical AI-style phrasing before voice generation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]

BANNED = [
    (re.compile(r"不是"), "避免“不是 A，是/而是 B”的反转句，直接陈述事实"),
    (re.compile(r"而是"), "避免“不是 A，而是 B”的反转句"),
    (re.compile(r"不等于"), "避免口号式对比，直接说明项目能力或限制"),
    (re.compile(r"说白了"), "删除解释腔，直接给结论"),
    (re.compile(r"真正"), "删除泛化强调词，改成具体事实"),
    (re.compile(r"本质上"), "删除抽象总结词，改成具体动作"),
    (re.compile(r"换句话说"), "删除二次解释，保留更直接的一句"),
    (re.compile(r"值得注意的是"), "直接写需要注意的事实"),
    (re.compile(r"最[^，。；]{0,14}的不是"), "避免“最……的不是……”句式"),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args()
    path = args.input if args.input.is_absolute() else ROOT / args.input
    episode = json.loads(path.read_text(encoding="utf-8"))
    failures: list[str] = []
    spoken_characters = 0
    for segment in episode["segments"]:
        text = segment.get("spoken", "")
        spoken_characters += len(text)
        for pattern, guidance in BANNED:
            match = pattern.search(text)
            if match:
                failures.append(
                    f"{segment['id']}: banned phrase '{match.group(0)}' — {guidance}"
                )
    if failures:
        raise SystemExit("\n".join(failures))
    print(
        f"episode_lint=ok segments={len(episode['segments'])} "
        f"spoken_characters={spoken_characters}"
    )


if __name__ == "__main__":
    main()
