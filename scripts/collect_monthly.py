#!/usr/bin/env python3
"""Collect GitHub Trending monthly candidates and rank by stars this month."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path

from collect_weekly import (
    ROOT,
    fetch_trending_page,
    parse_articles,
)


TRENDING_URL = "https://github.com/trending?since=monthly"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--edition", default=datetime.now().strftime("%Y-%m"))
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    output = args.output or ROOT / "data" / f"monthly-{args.edition}.json"
    if not output.is_absolute():
        output = ROOT / output

    page = fetch_trending_page(url=TRENDING_URL, label="month")
    candidates = parse_articles(page, label="month")
    if len(candidates) < 10:
        raise RuntimeError(
            f"Only parsed {len(candidates)} repositories; GitHub markup may have changed"
        )
    candidates.sort(key=lambda item: item["stars_week"], reverse=True)
    top = candidates[:10]
    for index, repo in enumerate(top, 1):
        repo["rank"] = index
    result = {
        "edition": args.edition,
        "captured_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source_url": TRENDING_URL,
        "scope": "GitHub Trending monthly page candidates, re-ranked by displayed stars this month",
        "candidate_count": len(candidates),
        "repos": top,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"collected={len(candidates)} top10={output}")
    for repo in top:
        print(f"#{repo['rank']:02d} {repo['owner']}/{repo['name']} +{repo['stars_week']:,}")


if __name__ == "__main__":
    main()
