#!/usr/bin/env python3
"""Verify the V2 pilot and write a shareable manifest."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "output" / "github-weekly-v2-pilot.mp4"
MANIFEST = ROOT / "output" / "v2-pilot-manifest.json"
TIMELINE = ROOT / "remotion" / "src" / "generated" / "pilot-timeline.json"


def main() -> None:
    if not VIDEO.exists():
        raise SystemExit(f"Missing {VIDEO}")
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
            "-of", "json", str(VIDEO),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    metadata = json.loads(probe.stdout)
    timeline = json.loads(TIMELINE.read_text(encoding="utf-8"))
    expected_duration = timeline["durationInFrames"] / timeline["fps"]
    duration = float(metadata["format"]["duration"])
    streams = metadata["streams"]
    video_stream = next(stream for stream in streams if stream["codec_type"] == "video")
    audio_stream = next(stream for stream in streams if stream["codec_type"] == "audio")
    if abs(duration - expected_duration) > 0.75:
        raise RuntimeError(
            f"duration {duration:.3f}s differs from timeline {expected_duration:.3f}s"
        )
    if (video_stream["width"], video_stream["height"]) != (1080, 1920):
        raise RuntimeError("unexpected resolution")
    if video_stream["codec_name"] != "h264":
        raise RuntimeError("unexpected video codec")
    if video_stream["r_frame_rate"] != "30/1":
        raise RuntimeError("unexpected frame rate")
    if audio_stream["codec_name"] != "aac":
        raise RuntimeError("unexpected audio codec")
    if audio_stream["sample_rate"] != "48000":
        raise RuntimeError("unexpected audio sample rate")
    decode = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(VIDEO), "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    if decode.returncode or decode.stderr.strip():
        raise RuntimeError(decode.stderr)

    result = {
        "video": str(VIDEO.relative_to(ROOT)).replace("\\", "/"),
        "duration_seconds": duration,
        "expected_duration_seconds": round(expected_duration, 4),
        "resolution": "1080x1920",
        "fps": 30,
        "video_codec": "h264",
        "audio_codec": "aac",
        "audio_sample_rate": 48000,
        "full_decode": "ok",
        "render_engine": "Remotion 4.0.489 + FFmpeg",
        "voice": {
            "current_pilot": f"Microsoft Edge {timeline['voice']}",
            "external_service": True,
            "api_key": False,
            "status": "user-selected female A; still a temporary online voice"
        },
        "generative_visual_model": False,
        "real_project_assets": [
            "pbakaus/impeccable before-after images",
            "ogulcancelik/herdr product demo"
        ],
        "scope": "V2 style pilot: hook + ranks 10 and 9"
    }
    MANIFEST.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
