#!/usr/bin/env python3
"""Verify a RepoReel release ZIP without extracting it."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import PurePosixPath
import zipfile


REQUIRED = {
    "README.md",
    "VERSION",
    "video-flow.ps1",
    "requirements.txt",
    "scripts/run_weekly.ps1",
    "scripts/doctor.ps1",
    "scripts/setup.ps1",
    "remotion/package-lock.json",
    "remotion/src/v2-full.tsx",
    "data/full-v2.json",
    "output/github-weekly-v2-pilot.mp4",
    "remotion/src/generated/pilot-timeline.json",
    "PACKAGE_MANIFEST.json",
}

FORBIDDEN_PARTS = {
    ".git",
    ".codex",
    ".agents",
    "node_modules",
    "__pycache__",
    "work",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive")
    args = parser.parse_args()
    with zipfile.ZipFile(args.archive) as bundle:
        names = {name.rstrip("/") for name in bundle.namelist() if not name.endswith("/")}
        missing = sorted(REQUIRED - names)
        if missing:
            raise SystemExit(f"Missing required files: {missing}")
        forbidden = sorted(
            name
            for name in names
            if any(part in FORBIDDEN_PARTS for part in PurePosixPath(name).parts)
        )
        if forbidden:
            raise SystemExit(f"Forbidden paths in archive: {forbidden[:10]}")
        manifest = json.loads(bundle.read("PACKAGE_MANIFEST.json"))
        for item in manifest["files"]:
            name = item["path"]
            if name not in names:
                raise SystemExit(f"Manifest entry missing from ZIP: {name}")
            if digest(bundle.read(name)) != item["sha256"]:
                raise SystemExit(f"Hash mismatch: {name}")
    print(f"package_verify=ok files={len(names)} archive={args.archive}")


if __name__ == "__main__":
    main()
