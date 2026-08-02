#!/usr/bin/env python3
"""Create a reviewed episode and download official assets with one command.

Codex is limited to the editorial decision: it receives a repository dossier
and returns schema-constrained JSON. Collection, validation, downloads, voice,
rendering, and QA remain deterministic scripts.
"""

from __future__ import annotations

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import hashlib
from http.client import IncompleteRead
import html
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
BANNED = (
    "不是",
    "而是",
    "不等于",
    "说白了",
    "真正",
    "本质上",
    "换句话说",
    "值得注意的是",
)
LAYOUTS = ("split", "cinematic", "signal", "terminal", "stack", "focus")
ACCENTS = ("#FFB84D", "#4DC7FF", "#C8FF36", "#E8E8E8", "#FF74B8", "#8B8CFF")
# URL words that mark an asset as a logo/icon/wordmark rather than a real
# screenshot. These render as a tiny emblem and look wrong full-frame.
LOGO_ASSET_WORDS = (
    "logo",
    "icon",
    "symbol",
    "wordmark",
    "avatar",
    "favicon",
    "skills.sh/b/",
    "readme-downloads",
)
IGNORE_ASSET_WORDS = (
    "badge",
    "shield",
    "star-history",
    "contrib.rocks",
    "github.com/actions",
    "coverage",
    "license",
    "discord",
    "twitter",
    "linkedin",
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporary.replace(path)


def github_token() -> str | None:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    gh = shutil.which("gh")
    if not gh:
        return None
    completed = subprocess.run(
        [gh, "auth", "token"], text=True, capture_output=True, timeout=20
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def fetch(
    url: str,
    *,
    accept: str = "*/*",
    token: str | None = None,
    attempts: int = 4,
    timeout: int = 45,
) -> tuple[bytes, str, str]:
    best = b""
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        headers = {
            "User-Agent": "RepoReel/0.4 one-command workflow",
            "Accept": accept,
            "Accept-Encoding": "identity",
            "Connection": "close",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = response.read()
                content_type = response.headers.get_content_type()
                final_url = response.geturl()
        except IncompleteRead as error:
            payload = error.partial
            content_type = "application/octet-stream"
            final_url = url
            last_error = error
        except Exception as error:
            payload = b""
            content_type = "application/octet-stream"
            final_url = url
            last_error = error
        if len(payload) > len(best):
            best = payload
        if len(payload) >= 256:
            return payload, content_type, final_url
        if attempt < attempts:
            time.sleep(attempt)
    if len(best) >= 256:
        return best, "application/octet-stream", url
    raise RuntimeError(f"Could not fetch {url}: {last_error}")


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(value).split())


def resolve_asset_url(url: str, repo: str, branch: str) -> str | None:
    url = html.unescape(url.strip().strip('"').strip("'"))
    if not url or url.startswith(("data:", "#", "mailto:")):
        return None
    if url.startswith("//"):
        url = f"https:{url}"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    url = url.split("#", 1)[0].split("?", 1)[0].lstrip("./")
    if not url:
        return None
    quoted = "/".join(urllib.parse.quote(part) for part in url.split("/"))
    return f"https://raw.githubusercontent.com/{repo}/{urllib.parse.quote(branch, safe='/')}/{quoted}"


def extract_asset_candidates(
    readme: str, repo: str, branch: str, limit: int, edition: str
) -> list[dict]:
    raw_urls: list[str] = []
    patterns = (
        r"!\[[^\]]*\]\(([^)\s]+)",
        r"<(?:img|source|video)[^>]+(?:src|srcset)=[\"']([^\"']+)",
        r"https://github\.com/user-attachments/assets/[A-Za-z0-9-]+",
    )
    for pattern in patterns:
        raw_urls.extend(re.findall(pattern, readme, flags=re.IGNORECASE))
    opengraph = {
        "url": f"https://opengraph.githubassets.com/reporeel-{edition}/{repo}",
        "kind": "image",
        "source": "GitHub OpenGraph fallback",
    }
    readme_render = {
        "url": f"https://github.com/{repo}",
        "kind": "image",
        "source": "GitHub README render",
    }
    candidates: list[dict] = []
    seen: set[str] = set()
    for raw in raw_urls:
        url = resolve_asset_url(raw, repo, branch)
        if not url or url in seen:
            continue
        lowered = url.lower()
        if any(word in lowered for word in IGNORE_ASSET_WORDS):
            continue
        if any(word in lowered for word in LOGO_ASSET_WORDS):
            continue
        parsed = urllib.parse.urlparse(url)
        suffix = Path(parsed.path).suffix.lower()
        if suffix not in {
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".gif",
            ".svg",
            ".mp4",
            ".webm",
            ".mov",
            "",
        }:
            continue
        seen.add(url)
        candidates.append(
            {
                "url": url,
                "kind": "video"
                if suffix in {".gif", ".mp4", ".webm", ".mov"}
                or "user-attachments" in lowered
                else "image",
                "source": "README",
            }
        )
        if len(candidates) >= limit - 2:
            break
    # Always keep the repo OpenGraph card (name + description + stats) and a
    # rendered-README page screenshot as guaranteed legible fallbacks.
    candidates.append(opengraph)
    candidates.append(readme_render)
    return candidates[:limit]


def enrich(weekly: dict, edition: str, candidate_limit: int) -> dict:
    token = github_token()
    indexed: dict[int, dict] = {}

    def enrich_one(index: int, repo: dict) -> tuple[int, dict]:
        full_name = f"{repo['owner']}/{repo['name']}"
        try:
            metadata_raw, _, _ = fetch(
                f"https://api.github.com/repos/{full_name}",
                accept="application/vnd.github+json",
                token=token,
            )
            metadata = json.loads(metadata_raw.decode("utf-8"))
        except Exception as error:
            print(
                f"warning=metadata_api_failed repo={full_name} "
                f"error={type(error).__name__}"
            )
            metadata = {
                "default_branch": "main",
                "description": repo.get("description", ""),
                "homepage": "",
                "license": None,
            }
        branch = metadata.get("default_branch") or "main"
        readme = ""
        try:
            readme_raw, _, _ = fetch(
                f"https://api.github.com/repos/{full_name}/readme",
                accept="application/vnd.github.raw+json",
                token=token,
            )
            readme = readme_raw.decode("utf-8", errors="replace")
            if readme.lstrip().startswith("{"):
                encoded = json.loads(readme).get("content", "")
                readme = base64.b64decode(encoded).decode("utf-8", errors="replace")
        except Exception as error:
            print(
                f"warning=readme_api_failed repo={full_name} "
                f"error={type(error).__name__}"
            )
            try:
                readme_raw, _, _ = fetch(
                    f"https://raw.githubusercontent.com/{full_name}/"
                    f"{urllib.parse.quote(branch, safe='/')}/README.md",
                    attempts=2,
                )
                readme = readme_raw.decode("utf-8", errors="replace")
            except Exception as fallback_error:
                print(
                    f"warning=readme_fetch_failed repo={full_name} "
                    f"error={type(fallback_error).__name__}"
                )
        candidates = extract_asset_candidates(
            readme, full_name, branch, candidate_limit, edition
        )
        dossier = {
            **repo,
            "full_name": full_name,
            "default_branch": branch,
            "description": metadata.get("description") or repo.get("description", ""),
            "homepage": metadata.get("homepage") or "",
            "license": (metadata.get("license") or {}).get("spdx_id"),
            "readme_excerpt": clean_text(readme)[:2500],
            "asset_candidates": candidates,
        }
        print(
            f"dossier={full_name} assets={len(candidates)} "
            f"readme_chars={len(readme)}"
        )
        return index, dossier

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [
            executor.submit(enrich_one, index, repo)
            for index, repo in enumerate(weekly["repos"])
        ]
        for future in as_completed(futures):
            index, dossier = future.result()
            indexed[index] = dossier
    dossiers = [indexed[index] for index in range(len(weekly["repos"]))]
    return {
        "edition": edition,
        "source_url": weekly["source_url"],
        "scope": weekly["scope"],
        "period": weekly.get("period", "weekly"),
        "repos": dossiers,
    }


def editorial_prompt(
    dossier: dict,
    minimum: int,
    maximum: int,
    feedback: list[str] | None = None,
) -> str:
    feedback_text = ""
    if feedback:
        feedback_text = (
            "\n上一版未通过机器检查，请逐条修正：\n- " + "\n- ".join(feedback) + "\n"
        )
    compact_repos = []
    for repo in dossier["repos"]:
        candidates = []
        for index, candidate in enumerate(repo["asset_candidates"]):
            url_path = urllib.parse.urlparse(candidate["url"]).path
            candidates.append(
                {
                    "index": index,
                    "kind": candidate["kind"],
                    "source": candidate["source"],
                    "hint": Path(url_path).name[-80:] or "asset",
                }
            )
        compact_repos.append(
            {
                "rank": repo["rank"],
                "full_name": repo["full_name"],
                "description": repo.get("description", ""),
                "license": repo.get("license"),
                "readme_excerpt": repo.get("readme_excerpt", "")[:1600],
                "asset_candidates": candidates,
            }
        )
    compact_dossier = json.dumps(
        {
            "edition": dossier["edition"],
            "scope": dossier["scope"],
            "repos": compact_repos,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return f"""你是 RepoReel 的中文短视频主编。
只根据下方事实包中的 GitHub 元数据与 README 摘要写本周 Top 10 口播。
不要联网，不要调用工具，不要读取或修改文件。最终答案严格符合给定 JSON Schema。

要求：
1. 项目按 rank 10 到 rank 1，每个 repo 恰好出现一次。
2. 直接说明项目做什么、证据与限制；语气像熟悉开源项目的中文主播。
3. 禁止使用：不是、而是、不等于、说白了、真正、本质上、换句话说、值得注意的是。
4. 不逐项朗读精确增星数；路线图、平台限制和已知缺口要明确。
5. 每项 spoken 写 70-76 个字符，写成两到三个完整短句，最后必须有句号；
   hook 50-60 个字符；mid_reset 40-50 个字符；outro 50-60 个字符；
   全部口播合计 {minimum}-{maximum} 个字符。宁可缩短句子，也不要截断项目名或半句话。
6. primary_asset 和 secondary_asset 是每个项目 asset_candidates 的零基索引。
   优先真实产品截图或演示；没有时选择 GitHub OpenGraph fallback。
7. 相邻项目尽量使用不同 layout；accent 保持高对比。
8. facts 每项只能是一个 3-24 字符的简短英文标签，只用字母、数字、空格及 +._/-，
   不得放入引号、逗号或多个标签。
9. 去 AI 腔：打破每条口播的统一节奏，不要每项都套「先说痛点，再『它把 A、B、C 变成 D』」的三段罗列；长短句交错，允许轻微不对称。
10. 不写口号式对仗收尾（如「从 X，到 Y」）、空洞拔高（如「系统性升级」）和框架套话（如「主线只有一条」「核心逻辑是」「一句话总结」）；多用具体动词和口语。但数字、项目名、许可证和事实关系一律照实保留，缺信息不编。
{feedback_text}
唯一事实包：
{compact_dossier}"""


def validate_editorial(editorial: dict, dossier: dict, minimum: int, maximum: int) -> list[str]:
    errors: list[str] = []
    expected = {item["full_name"] for item in dossier["repos"]}
    projects = editorial.get("projects", [])
    actual = {item.get("repo") for item in projects}
    if actual != expected:
        errors.append(
            f"repo 集合不匹配，missing={sorted(expected - actual)} "
            f"extra={sorted(actual - expected)}"
        )
    expected_order = [
        item["full_name"]
        for item in sorted(dossier["repos"], key=lambda item: item["rank"], reverse=True)
    ]
    actual_order = [item.get("repo") for item in projects]
    if actual_order != expected_order:
        errors.append("项目顺序必须严格按 rank 10 到 rank 1")
    texts = [
        editorial.get("hook", ""),
        editorial.get("mid_reset", ""),
        editorial.get("outro", ""),
        *[item.get("spoken", "") for item in editorial.get("projects", [])],
    ]
    character_count = sum(len(text) for text in texts)
    if not minimum <= character_count <= maximum:
        errors.append(
            f"spoken 总字符数为 {character_count}，要求 {minimum}-{maximum}"
        )
    named_texts = [
        ("hook", editorial.get("hook", "")),
        ("mid_reset", editorial.get("mid_reset", "")),
        ("outro", editorial.get("outro", "")),
    ]
    for item in projects:
        repo = item.get("repo", "unknown")
        named_texts.extend(
            [
                (f"{repo}.spoken", item.get("spoken", "")),
                (f"{repo}.headline", item.get("headline", "")),
                (f"{repo}.verdict", item.get("verdict", "")),
            ]
        )
    for name, text in named_texts:
        if not isinstance(text, str):
            errors.append(f"{name}: 必须是文本")
            continue
        if re.search(r'[\"{}\[\]]|\\",\\"|\\":', text):
            errors.append(f"{name}: 出现疑似 JSON 泄漏字符")
    ending_texts = [
        ("hook", editorial.get("hook", "")),
        ("mid_reset", editorial.get("mid_reset", "")),
        ("outro", editorial.get("outro", "")),
        *[
            (f"{item.get('repo')}.spoken", item.get("spoken", ""))
            for item in projects
        ],
        *[
            (f"{item.get('repo')}.verdict", item.get("verdict", ""))
            for item in projects
        ],
    ]
    for name, text in ending_texts:
        if isinstance(text, str) and text and text[-1] not in "。！？.!?":
            errors.append(f"{name}: 句子结尾不完整")
    for item in projects:
        spoken = item.get("spoken", "")
        if isinstance(spoken, str) and not 60 <= len(spoken) <= 100:
            errors.append(
                f"{item.get('repo')}.spoken 长度为 {len(spoken)}，要求 60-100"
            )
    for index, text in enumerate(texts):
        for phrase in BANNED:
            if phrase in text:
                errors.append(f"第 {index + 1} 段包含禁用词“{phrase}”")
    for item in projects:
        if item.get("layout") not in LAYOUTS:
            errors.append(f"{item.get('repo')}: layout 无效")
        for fact in item.get("facts", []):
            if not isinstance(fact, str) or not re.fullmatch(
                r"[A-Za-z0-9+._/ -]{3,24}", fact
            ):
                errors.append(f"{item.get('repo')}: facts 标签格式无效")
        dossier_item = next(
            (repo for repo in dossier["repos"] if repo["full_name"] == item.get("repo")),
            None,
        )
        if dossier_item:
            count = len(dossier_item["asset_candidates"])
            for field in ("primary_asset", "secondary_asset"):
                value = item.get(field)
                if value is not None and (not isinstance(value, int) or value >= count):
                    errors.append(f"{item.get('repo')}: {field}={value} 超出素材范围 0-{count - 1}")
    return errors


def invoke_codex(
    config: dict,
    dossier_path: Path,
    editorial_path: Path,
    schema_path: Path,
    minimum: int,
    maximum: int,
) -> dict:
    codex = shutil.which("codex")
    if not codex:
        raise RuntimeError("Codex CLI was not found. Install it or set editorial.provider=manual.")
    max_attempts = int(config["editorial"].get("max_attempts", 2))
    feedback: list[str] = []
    dossier = load_json(dossier_path)
    mcp_overrides: list[str] = []
    if config["editorial"].get("disable_mcp", True):
        service_tier = config["editorial"].get("service_tier", "fast").strip()
        listed = subprocess.run(
            [
                codex,
                "-c",
                f'service_tier="{service_tier}"',
                "mcp",
                "list",
                "--json",
            ],
            text=True,
            capture_output=True,
            timeout=60,
        )
        if listed.returncode == 0:
            try:
                for server in json.loads(listed.stdout):
                    name = server.get("name", "")
                    if re.fullmatch(r"[A-Za-z0-9_-]+", name):
                        mcp_overrides.extend(
                            ["-c", f"mcp_servers.{name}.enabled=false"]
                        )
            except json.JSONDecodeError:
                print("warning=codex_mcp_list_not_json")
    for attempt in range(1, max_attempts + 1):
        prompt = editorial_prompt(dossier, minimum, maximum, feedback)
        command = [
            codex,
            "exec",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "-C",
            str(ROOT),
            "--output-schema",
            str(schema_path),
            "-o",
            str(editorial_path),
        ]
        command.extend(mcp_overrides)
        model = config["editorial"].get("model", "").strip()
        if model:
            command.extend(["--model", model])
        effort = config["editorial"].get("reasoning_effort", "").strip()
        if effort:
            command.extend(["-c", f'model_reasoning_effort="{effort}"'])
        service_tier = config["editorial"].get("service_tier", "fast").strip()
        if service_tier:
            command.extend(["-c", f'service_tier="{service_tier}"'])
        command.append("-")
        print(
            f"editorial_attempt={attempt}/{max_attempts} "
            f"model={model or 'codex-config-default'}"
        )
        timeout_seconds = int(config["editorial"].get("timeout_seconds", 240))
        try:
            completed = subprocess.run(
                command,
                input=prompt.encode("utf-8"),
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            feedback = [f"Codex CLI 超过 {timeout_seconds} 秒仍未完成"]
            print("editorial_timeout=" + feedback[0])
            continue
        if completed.returncode:
            feedback = [f"Codex CLI 退出码为 {completed.returncode}"]
            continue
        editorial = load_json(editorial_path)
        feedback = validate_editorial(
            editorial, dossier, minimum=minimum, maximum=maximum
        )
        if not feedback:
            return editorial
        print("editorial_validation_failed=" + " | ".join(feedback))
    raise RuntimeError(
        "Editorial generation failed validation: " + " | ".join(feedback)
    )


def screenshot_page(url: str, target: Path) -> None:
    """Capture a repo's rendered README preview (not the code file list).

    GitHub's repo landing page shows the file browser on top and the README
    below the fold. We want the README markdown preview itself. We drive
    headless Chrome over the DevTools Protocol: load the page, locate the
    README <article> bounding box, then screenshot just that clip region.
    """
    chrome = shutil.which("chrome") or shutil.which("chrome.exe")
    if not chrome:
        for candidate in (
            Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        ):
            if candidate.exists():
                chrome = str(candidate)
                break
    if not chrome:
        raise RuntimeError("no headless browser found for page screenshot")
    _screenshot_readme_via_cdp(str(chrome), url, target)
    if not target.exists() or target.stat().st_size < 2048:
        raise RuntimeError("page screenshot came out empty")


def _free_port() -> int:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _screenshot_readme_via_cdp(chrome: str, url: str, target: Path) -> None:
    """Drive headless Chrome via CDP to clip the screenshot to the README."""
    import base64
    import json as _json
    import urllib.request as _urlreq

    try:
        import websocket  # type: ignore
    except Exception as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("websocket-client not installed") from exc

    debug_port = _free_port()
    proc = subprocess.Popen(
        [
            chrome,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            f"--remote-debugging-port={debug_port}",
            "--remote-allow-origins=*",
            "--window-size=1280,2000",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        ws_url = None
        for _ in range(50):
            try:
                with _urlreq.urlopen(
                    f"http://127.0.0.1:{debug_port}/json", timeout=1
                ) as resp:
                    tabs = _json.load(resp)
                page = next((t for t in tabs if t.get("type") == "page"), None)
                if page and page.get("webSocketDebuggerUrl"):
                    ws_url = page["webSocketDebuggerUrl"]
                    break
            except Exception:
                time.sleep(0.2)
        if not ws_url:
            raise RuntimeError("could not reach Chrome DevTools endpoint")

        ws = websocket.create_connection(ws_url, timeout=30)
        msg_id = 0

        def send(method: str, params: dict | None = None) -> dict:
            nonlocal msg_id
            msg_id += 1
            ws.send(_json.dumps({"id": msg_id, "method": method, "params": params or {}}))
            while True:
                reply = _json.loads(ws.recv())
                if reply.get("id") == msg_id:
                    return reply

        send("Page.enable")
        send("Runtime.enable")
        # Render at 2x so the README text stays crisp when the frame is scaled
        # up inside the video. The on-screen media window is ~840x550 (about
        # 1.53:1), so we capture the README at that aspect ratio instead of a
        # tall strip -- a tall strip gets center-cropped by objectFit=cover and
        # only ~30% of it shows, which is what made the content look tiny.
        send("Emulation.setDeviceMetricsOverride", {
            "width": 1280, "height": 2000, "deviceScaleFactor": 2, "mobile": False,
        })
        send("Page.navigate", {"url": url})
        # Wait for the README article to appear (client-side render).
        deadline = time.time() + 30
        box = None
        # Return the article's absolute document coordinates (not viewport).
        find_js = (
            "(()=>{const a=document.querySelector('article.markdown-body');"
            "if(!a)return null;const r=a.getBoundingClientRect();"
            "return {x:r.x+window.scrollX,y:r.y+window.scrollY,"
            "w:r.width,h:r.height};})()"
        )
        while time.time() < deadline:
            res = send("Runtime.evaluate", {"expression": find_js, "returnByValue": True})
            val = res.get("result", {}).get("result", {}).get("value")
            if val:
                box = val
                break
            time.sleep(0.4)
        if not box:
            raise RuntimeError("README article not found on page")

        # Wait for images inside the README to finish loading, otherwise the
        # article height is measured too short (lazy-loaded images haven't
        # expanded it yet) and the capture comes out as a thin strip.
        send("Runtime.evaluate", {
            "expression": (
                "Promise.all(Array.from(document.querySelectorAll("
                "'article.markdown-body img')).map(i=>i.complete?1:"
                "new Promise(r=>{i.onload=r;i.onerror=r;})))"
            ),
            "awaitPromise": True,
        })
        # Re-measure now that images have expanded the article.
        res = send("Runtime.evaluate", {"expression": find_js, "returnByValue": True})
        box = res["result"]["result"]["value"]

        # Capture the README region using absolute document coordinates. The
        # clip in Page.captureScreenshot is in page (document) space, so no
        # scrolling is needed. Match the media window's ~1.53:1 aspect ratio so
        # the whole captured region is visible (no center-crop), and cap the
        # height so very long READMEs still show their top section.
        #
        # The on-screen MediaContent applies a slow zoom animation
        # (scale up to ~1.06x). With objectFit=cover that zoom crops the left
        # and right edges, which was cutting off the first characters of each
        # line. Capture a wider region (horizontal padding around the article)
        # so the zoom crops into empty margin instead of the text.
        media_aspect = 840 / 550
        pad_x = box["w"] * 0.07
        clip_x = max(0, box["x"] - pad_x)
        clip_w = box["w"] + pad_x * 2
        clip_height = min(box["h"], clip_w / media_aspect)
        shot = send("Page.captureScreenshot", {
            "format": "png",
            "captureBeyondViewport": True,
            "clip": {
                "x": clip_x,
                "y": box["y"],
                "width": clip_w,
                "height": clip_height,
                "scale": 1,
            },
        })
        data = shot.get("result", {}).get("data")
        if not data:
            raise RuntimeError("CDP screenshot returned no data")
        target.write_bytes(base64.b64decode(data))
        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()



def extension_for(content_type: str, final_url: str, kind: str) -> str:
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "image/gif": ".gif",
    }
    if content_type in mapping:
        return mapping[content_type]
    suffix = Path(urllib.parse.urlparse(final_url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    guessed = mimetypes.guess_extension(content_type)
    return guessed if guessed in {".png", ".jpg", ".webp", ".svg"} else ".png"


def normalize_video(source: Path, target: Path) -> None:
    completed = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-t",
            "10",
            "-vf",
            "fps=30,scale='min(1280,iw)':-2:flags=lanczos",
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
        ],
        text=True,
        capture_output=True,
    )
    if completed.returncode:
        raise RuntimeError(completed.stderr)


def materialize_asset(
    candidate: dict,
    fallback: dict,
    target_stem: Path,
    repo: str,
) -> tuple[dict, dict]:
    selected = candidate
    def hashed_stem(item: dict) -> Path:
        digest = hashlib.sha1(item["url"].encode("utf-8")).hexdigest()[:10]
        return target_stem.with_name(f"{target_stem.name}-{digest}")

    def existing_target(stem: Path) -> Path | None:
        for suffix in (".mp4", ".png", ".jpg", ".webp", ".svg", ".gif"):
            path = stem.with_suffix(suffix)
            if path.exists() and path.stat().st_size >= 256:
                return path
        return None

    selected_stem = hashed_stem(selected)
    cached = existing_target(selected_stem)
    fallback_stem = hashed_stem(fallback)
    fallback_cached = existing_target(fallback_stem)
    payload: bytes | None = None
    content_type = ""
    final_url = selected["url"]
    target: Path
    if cached:
        target = cached
        detected_video = target.suffix.lower() == ".mp4"
    elif fallback_cached:
        selected = fallback
        selected_stem = fallback_stem
        target = fallback_cached
        detected_video = target.suffix.lower() == ".mp4"
    else:
        if selected.get("source") == "GitHub README render":
            try:
                target = selected_stem.with_suffix(".png")
                screenshot_page(selected["url"], target)
                detected_video = False
            except Exception as error:
                print(
                    f"warning=readme_render_failed repo={repo} "
                    f"error={type(error).__name__}"
                )
                selected = fallback
                selected_stem = hashed_stem(selected)
                cached = existing_target(selected_stem)
                if cached:
                    target = cached
                    detected_video = target.suffix.lower() == ".mp4"
                else:
                    try:
                        payload, content_type, final_url = fetch(
                            selected["url"], attempts=2, timeout=20
                        )
                    except Exception as fallback_error:
                        print(
                            f"warning=asset_placeholder repo={repo} "
                            f"error={type(fallback_error).__name__}"
                        )
                        selected = {
                            "url": f"https://github.com/{repo}",
                            "source": "generated fallback",
                            "kind": "image",
                        }
                        selected_stem = hashed_stem(selected)
                        target = selected_stem.with_suffix(".svg")
                        owner, name = repo.split("/", 1)
                        target.write_text(
                            (
                                '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">'
                                '<rect width="1280" height="720" fill="#0b1020"/>'
                                '<circle cx="112" cy="112" r="36" fill="#7dd3fc"/>'
                                '<text x="80" y="340" fill="#f8fafc" '
                                'font-family="Arial,sans-serif" font-size="70" font-weight="700">'
                                f"{html.escape(name)}</text>"
                                '<text x="82" y="420" fill="#94a3b8" '
                                'font-family="Arial,sans-serif" font-size="36">'
                                f"github.com/{html.escape(owner)}</text></svg>"
                            ),
                            encoding="utf-8",
                        )
                        detected_video = False
        else:
            try:
                payload, content_type, final_url = fetch(
                    selected["url"], attempts=2, timeout=20
                )
            except Exception as error:
                print(
                    f"warning=asset_fallback repo={repo} error={type(error).__name__}"
                )
                selected = fallback
                selected_stem = hashed_stem(selected)
                cached = existing_target(selected_stem)
                if cached:
                    target = cached
                    detected_video = target.suffix.lower() == ".mp4"
                else:
                    try:
                        payload, content_type, final_url = fetch(
                            selected["url"], attempts=2, timeout=20
                        )
                    except Exception as fallback_error:
                        print(
                            f"warning=asset_placeholder repo={repo} "
                            f"error={type(fallback_error).__name__}"
                        )
                        selected = {
                            "url": f"https://github.com/{repo}",
                            "source": "generated fallback",
                            "kind": "image",
                        }
                        selected_stem = hashed_stem(selected)
                        target = selected_stem.with_suffix(".svg")
                        owner, name = repo.split("/", 1)
                        target.write_text(
                            (
                                '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">'
                                '<rect width="1280" height="720" fill="#0b1020"/>'
                                '<circle cx="112" cy="112" r="36" fill="#7dd3fc"/>'
                                '<text x="80" y="340" fill="#f8fafc" '
                                'font-family="Arial,sans-serif" font-size="70" font-weight="700">'
                                f"{html.escape(name)}</text>"
                                '<text x="82" y="420" fill="#94a3b8" '
                                'font-family="Arial,sans-serif" font-size="36">'
                                f"github.com/{html.escape(owner)}</text></svg>"
                            ),
                            encoding="utf-8",
                        )
                        detected_video = False
    if payload is not None:
        detected_video = selected["kind"] == "video" or content_type.startswith("video/")
        if content_type == "image/gif":
            detected_video = True
        if detected_video:
            raw = selected_stem.with_suffix(".source")
            raw.write_bytes(payload)
            target = selected_stem.with_suffix(".mp4")
            normalize_video(raw, target)
            raw.unlink(missing_ok=True)
        else:
            extension = extension_for(content_type, final_url, "image")
            target = selected_stem.with_suffix(extension)
            target.write_bytes(payload)
    visual_type = "video" if detected_video else "image"
    relative = target.relative_to(ROOT / "remotion" / "public").as_posix()
    is_readme_render = selected["source"] == "GitHub README render"
    visual = {
        "type": visual_type,
        "path": relative,
        "label": (
            "OFFICIAL README ASSET"
            if selected["source"] == "README"
            else "GITHUB REPOSITORY"
            if selected["source"] == "GitHub OpenGraph fallback"
            else "RENDERED README"
            if is_readme_render
            else "REPOSITORY PLACEHOLDER"
        ),
        "fit": "cover" if visual_type == "video" or is_readme_render else "contain",
    }
    manifest = {
        "repo": repo,
        "url": selected["url"],
        "source": selected["source"],
        "path": relative,
        "type": visual_type,
        "bytes": target.stat().st_size,
    }
    return visual, manifest


def build_episode_and_assets(
    config: dict,
    dossier: dict,
    editorial: dict,
    episode_path: Path,
    manifest_path: Path,
) -> dict:
    edition = dossier["edition"]
    period = dossier.get("period", "weekly")
    period_word = "MONTHLY" if period == "monthly" else "WEEKLY"
    period_days = "30" if period == "monthly" else "7"
    public_root = ROOT / "remotion" / "public"
    asset_root = public_root / "assets" / f"weekly-{edition}"
    editorial_by_name = {item["repo"]: item for item in editorial["projects"]}
    manifest: list[dict] = []
    segments: list[dict] = [
        {
            "id": "hook",
            "kind": "spoken",
            "spoken": editorial["hook"],
            "onscreen": [f"GITHUB {period_word}", "TOP 10"],
            "chart": [
                {"name": item["name"].upper(), "stars": item["stars_week"]}
                for item in sorted(dossier["repos"], key=lambda row: row["rank"])[:5]
            ],
            "tail_seconds": 0.45,
        },
        {
            "id": "scope",
            "kind": "silent",
            "fixed_seconds": 1.8,
            "onscreen": [
                "GITHUB TRENDING",
                f"{period_word} CANDIDATES",
                f"CAPTURED {edition}",
                f"PERIOD {period_word}",
                f"DAYS {period_days}",
            ],
        },
    ]
    ordered_projects = sorted(
        dossier["repos"], key=lambda row: row["rank"], reverse=True
    )

    def prepare_project_assets(project: dict) -> tuple[str, dict, dict | None, list[dict]]:
        full_name = project["full_name"]
        edit = editorial_by_name[full_name]
        candidates = project["asset_candidates"]
        fallback = candidates[-1]
        # Every project shows its rendered README landing page as the primary
        # visual, so no project ever falls back to a bare logo or a broken image.
        readme_render = next(
            (c for c in candidates if c.get("source") == "GitHub README render"),
            fallback,
        )
        primary_candidate = readme_render
        secondary_index = edit.get("secondary_asset")
        slug = re.sub(r"[^a-z0-9-]+", "-", project["name"].lower()).strip("-")
        directory = asset_root / slug
        directory.mkdir(parents=True, exist_ok=True)
        primary, primary_manifest = materialize_asset(
            primary_candidate, fallback, directory / "primary", full_name
        )
        project_manifest = [primary_manifest]
        secondary = None
        if secondary_index is not None and secondary_index != edit["primary_asset"]:
            secondary, secondary_manifest = materialize_asset(
                candidates[secondary_index],
                fallback,
                directory / "secondary",
                full_name,
            )
            project_manifest.append(secondary_manifest)
        layout = edit["layout"]
        if layout == "split" and not secondary:
            layout = "cinematic"
        return full_name, primary, secondary, project_manifest

    prepared_assets: dict[str, tuple[dict, dict | None]] = {}
    workers = min(5, max(1, len(ordered_projects)))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(prepare_project_assets, project)
            for project in ordered_projects
        ]
        for future in as_completed(futures):
            full_name, primary, secondary, project_manifest = future.result()
            prepared_assets[full_name] = (primary, secondary)
            manifest.extend(project_manifest)

    for project in ordered_projects:
        full_name = project["full_name"]
        edit = editorial_by_name[full_name]
        primary, secondary = prepared_assets[full_name]
        layout = edit["layout"]
        if layout == "split" and not secondary:
            layout = "cinematic"
        segment = {
            "id": f"rank_{project['rank']:02d}",
            "kind": "spoken",
            "layout": layout,
            "accent": edit["accent"],
            "spoken": edit["spoken"],
            "headline": edit["headline"],
            "verdict": edit["verdict"],
            "facts": edit["facts"],
            "project": {
                "rank": project["rank"],
                "owner": project["owner"],
                "name": project["name"],
                "url": project["url"],
                "stars_week": project["stars_week"],
            },
            "visual": primary,
            "onscreen": [
                f"#{project['rank']:02d}",
                project["name"].upper(),
                f"+{project['stars_week']:,}",
            ],
            "tail_seconds": 0.3,
        }
        if secondary:
            segment["secondary_visual"] = secondary
        segments.append(segment)
        if project["rank"] == 6 and editorial.get("mid_reset"):
            segments.append(
                {
                    "id": "mid_reset",
                    "kind": "spoken",
                    "spoken": editorial["mid_reset"],
                    "onscreen": ["TOP 5"],
                    "tail_seconds": 0.35,
                }
            )
    segments.append(
        {
            "id": "outro",
            "kind": "spoken",
            "spoken": editorial["outro"],
            "onscreen": ["10 PROJECTS", "ONE WEEK", "NEXT · REAL TEST"],
            "tail_seconds": 0.8,
        }
    )
    result = {
        "edition": edition,
        "status": "auto_reviewed",
        "source": f"data/weekly-{edition}.json",
        "dossier": f"data/dossier-{edition}.json",
        "editorial": f"data/editorial-{edition}.json",
        "fps": 30,
        "target_duration_seconds": config["episode"]["target_duration_seconds"],
        "voice": config["voice"],
        "segments": segments,
    }
    write_json(episode_path, result)
    write_json(
        manifest_path,
        {
            "edition": edition,
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "assets": manifest,
        },
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--edition", required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--weekly", type=Path, required=True)
    parser.add_argument("--episode-output", type=Path, required=True)
    parser.add_argument("--reuse-editorial", action="store_true")
    parser.add_argument("--dossier-only", action="store_true")
    args = parser.parse_args()

    config_path = args.config if args.config.is_absolute() else ROOT / args.config
    weekly_path = args.weekly if args.weekly.is_absolute() else ROOT / args.weekly
    episode_path = (
        args.episode_output
        if args.episode_output.is_absolute()
        else ROOT / args.episode_output
    )
    config = load_json(config_path)
    weekly = load_json(weekly_path)
    candidate_limit = int(config["assets"].get("candidates_per_repo", 8))
    dossier = enrich(weekly, args.edition, candidate_limit)
    dossier_path = ROOT / "data" / f"dossier-{args.edition}.json"
    editorial_path = ROOT / "data" / f"editorial-{args.edition}.json"
    manifest_path = (
        ROOT
        / "remotion"
        / "public"
        / "assets"
        / f"weekly-{args.edition}"
        / "asset-manifest.json"
    )
    write_json(dossier_path, dossier)
    if args.dossier_only:
        print(f"dossier={dossier_path}")
        return

    minimum = int(config["episode"]["spoken_characters_min"])
    maximum = int(config["episode"]["spoken_characters_max"])
    if args.reuse_editorial:
        if not editorial_path.exists():
            raise FileNotFoundError(f"Missing editorial file: {editorial_path}")
        editorial = load_json(editorial_path)
        errors = validate_editorial(editorial, dossier, minimum, maximum)
        if errors:
            raise RuntimeError("Existing editorial failed validation: " + " | ".join(errors))
    elif config["editorial"]["provider"] == "manual":
        if not editorial_path.exists():
            raise FileNotFoundError(
                "editorial.provider=manual requires a pre-authored editorial file: "
                f"{editorial_path}. Write it with any tool (no Codex needed); it must "
                "match schemas/editorial-plan.schema.json and the collected dossier."
            )
        editorial = load_json(editorial_path)
        errors = validate_editorial(editorial, dossier, minimum, maximum)
        if errors:
            raise RuntimeError("Manual editorial failed validation: " + " | ".join(errors))
    else:
        provider = config["editorial"]["provider"]
        if provider != "codex_cli":
            raise RuntimeError(
                f"Unsupported editorial provider '{provider}'. Use codex_cli, manual, "
                "or provide a validated editorial file with --reuse-editorial."
            )
        editorial = invoke_codex(
            config,
            dossier_path,
            editorial_path,
            ROOT / "schemas" / "editorial-plan.schema.json",
            minimum,
            maximum,
        )
    episode = build_episode_and_assets(
        config, dossier, editorial, episode_path, manifest_path
    )
    spoken_characters = sum(
        len(segment.get("spoken", "")) for segment in episode["segments"]
    )
    print(
        f"episode={episode_path} assets={manifest_path} "
        f"spoken_characters={spoken_characters}"
    )


if __name__ == "__main__":
    main()
