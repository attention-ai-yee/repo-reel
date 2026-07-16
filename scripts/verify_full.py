#!/usr/bin/env python3
"""Verify a full weekly episode and write a machine-readable manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=check, capture_output=True, text=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--video",
        type=Path,
        default=ROOT / "output" / "github-weekly-2026-07-15-v2.mp4",
    )
    parser.add_argument(
        "--timeline",
        type=Path,
        default=ROOT / "remotion" / "src" / "generated" / "full-timeline.json",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "output" / "v2-full-manifest.json",
    )
    args = parser.parse_args()
    video = args.video if args.video.is_absolute() else ROOT / args.video
    timeline_path = (
        args.timeline if args.timeline.is_absolute() else ROOT / args.timeline
    )
    manifest_path = (
        args.manifest if args.manifest.is_absolute() else ROOT / args.manifest
    )
    if not video.exists():
        raise SystemExit(f"Missing video: {video}")
    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    expected_duration = timeline["durationInFrames"] / timeline["fps"]

    probe = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
            "-of",
            "json",
            str(video),
        ]
    )
    metadata = json.loads(probe.stdout)
    duration = float(metadata["format"]["duration"])
    streams = metadata["streams"]
    video_stream = next(item for item in streams if item["codec_type"] == "video")
    audio_stream = next(item for item in streams if item["codec_type"] == "audio")

    errors: list[str] = []
    if abs(duration - expected_duration) > 0.75:
        errors.append(
            f"duration {duration:.3f}s differs from timeline {expected_duration:.3f}s"
        )
    if (video_stream.get("width"), video_stream.get("height")) != (1080, 1920):
        errors.append(
            f"resolution is {video_stream.get('width')}x{video_stream.get('height')}"
        )
    if video_stream.get("codec_name") != "h264":
        errors.append(f"video codec is {video_stream.get('codec_name')}")
    if video_stream.get("r_frame_rate") != "30/1":
        errors.append(f"frame rate is {video_stream.get('r_frame_rate')}")
    if audio_stream.get("codec_name") != "aac":
        errors.append(f"audio codec is {audio_stream.get('codec_name')}")
    if audio_stream.get("sample_rate") != "48000":
        errors.append(f"audio sample rate is {audio_stream.get('sample_rate')}")

    decode = run(
        ["ffmpeg", "-v", "error", "-i", str(video), "-f", "null", "-"],
        check=False,
    )
    if decode.returncode or decode.stderr.strip():
        errors.append(f"decode failed: {decode.stderr.strip()}")

    black = run(
        [
            "ffmpeg",
            "-hide_banner",
            "-v",
            "info",
            "-i",
            str(video),
            "-vf",
            "blackdetect=d=0.3:pix_th=0.02",
            "-an",
            "-f",
            "null",
            "-",
        ],
        check=False,
    )
    black_segments = black.stderr.count("black_start:")

    required_ids = {
        "pilot_clip",
        "awesome_llm_apps",
        "vibe_trading",
        "omniroute",
        "mid_reset",
        "meetily",
        "orca",
        "officecli",
        "opencut",
        "ai_job_search",
        "outro",
    }
    actual_ids = {item["id"] for item in timeline["segments"]}
    if actual_ids != required_ids:
        errors.append(
            f"timeline ids mismatch: missing={sorted(required_ids - actual_ids)} "
            f"extra={sorted(actual_ids - required_ids)}"
        )

    result = {
        "video": str(video.relative_to(ROOT)).replace("\\", "/"),
        "duration_seconds": round(duration, 3),
        "expected_duration_seconds": round(expected_duration, 3),
        "resolution": f"{video_stream['width']}x{video_stream['height']}",
        "fps": video_stream["r_frame_rate"],
        "video_codec": video_stream["codec_name"],
        "audio_codec": audio_stream["codec_name"],
        "audio_sample_rate": int(audio_stream["sample_rate"]),
        "full_decode": "ok" if not decode.returncode and not decode.stderr.strip() else "failed",
        "black_segments_over_0_3s": black_segments,
        "episode_segments": [item["id"] for item in timeline["segments"]],
        "voice": timeline["voice"],
        "render_engine": "Remotion 4.0.489 + FFmpeg",
        "errors": errors,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit("\n".join(errors))


if __name__ == "__main__":
    main()
