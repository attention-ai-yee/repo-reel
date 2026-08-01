#!/usr/bin/env python3
"""Collect GitHub Trending weekly candidates and rank by stars this week."""

from __future__ import annotations

import argparse
from datetime import datetime
import html
from http.client import IncompleteRead
import json
from pathlib import Path
import re
import time
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
TRENDING_URL = "https://github.com/trending?since=weekly"


def clean(fragment: str) -> str:
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return " ".join(html.unescape(fragment).split())


def parse_number(value: str) -> int:
    return int(value.replace(",", "").strip())


def parse_articles(page: str, label: str = "week") -> list[dict]:
    articles = re.findall(
        r'<article[^>]+class="[^"]*\bBox-row\b[^"]*"[^>]*>(.*?)</article>',
        page,
        flags=re.DOTALL | re.IGNORECASE,
    )
    repos: list[dict] = []
    for article in articles:
        repo_match = re.search(
            r'<h2[^>]*>.*?<a[^>]+href="(/[^"/]+/[^"/]+)"',
            article,
            flags=re.DOTALL | re.IGNORECASE,
        )
        week_match = re.search(
            rf"([\d,]+)\s+stars?\s+this\s+{label}",
            clean(article),
            flags=re.IGNORECASE,
        )
        if not repo_match or not week_match:
            continue
        owner, name = repo_match.group(1).strip("/").split("/", 1)
        description_match = re.search(
            r'<p[^>]+class="[^"]*col-9[^"]*"[^>]*>(.*?)</p>',
            article,
            flags=re.DOTALL | re.IGNORECASE,
        )
        language_match = re.search(
            r'<span[^>]+itemprop="programmingLanguage"[^>]*>(.*?)</span>',
            article,
            flags=re.DOTALL | re.IGNORECASE,
        )
        total_match = re.search(
            rf'href="/{re.escape(owner)}/{re.escape(name)}/stargazers"[^>]*>.*?</svg>\s*([\d,]+)',
            article,
            flags=re.DOTALL | re.IGNORECASE,
        )
        repos.append(
            {
                "owner": owner,
                "name": name,
                "url": f"https://github.com/{owner}/{name}",
                "language": clean(language_match.group(1)) if language_match else None,
                "description": clean(description_match.group(1))
                if description_match
                else "",
                "stars_total": parse_number(total_match.group(1))
                if total_match
                else None,
                "stars_week": parse_number(week_match.group(1)),
            }
        )
    return repos


def fetch_trending_page(
    attempts: int = 4, url: str = TRENDING_URL, label: str = "week"
) -> str:
    """Fetch Trending defensively.

    GitHub occasionally closes a chunked response after the useful HTML has
    arrived. Keep a parseable partial response as a fallback, but prefer a
    clean retry so a truncated candidate list never silently becomes a chart.
    """
    best_page = ""
    best_count = 0
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "RepoReel-weekly-collector/0.3",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Encoding": "identity",
                "Accept-Language": "en-US,en;q=0.8",
                "Connection": "close",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
        except IncompleteRead as error:
            payload = error.partial
            print(
                f"warning=incomplete_response attempt={attempt}/{attempts} "
                f"bytes={len(payload)}"
            )
        except Exception as error:
            payload = b""
            print(
                f"warning=trending_fetch_failed attempt={attempt}/{attempts} "
                f"error={type(error).__name__}"
            )
        page = payload.decode("utf-8", errors="replace")
        parsed_count = len(parse_articles(page, label=label))
        if parsed_count > best_count:
            best_page = page
            best_count = parsed_count
        if parsed_count >= 10 and "</html>" in page.lower():
            return page
        if attempt < attempts:
            time.sleep(attempt)
    if best_count >= 10:
        print(f"warning=using_parseable_partial_response repositories={best_count}")
        return best_page
    raise RuntimeError(
        f"Only parsed {best_count} repositories after {attempts} attempts; "
        "GitHub markup or network delivery may have changed"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--edition", default=datetime.now().strftime("%Y-%m-%d"))
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    output = args.output or ROOT / "data" / f"weekly-{args.edition}.json"
    if not output.is_absolute():
        output = ROOT / output

    page = fetch_trending_page()
    candidates = parse_articles(page)
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
        "scope": "GitHub Trending weekly page candidates, re-ranked by displayed stars this week",
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
