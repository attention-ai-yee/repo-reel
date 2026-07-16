#!/usr/bin/env python3
"""Generate phrase-timed V2 pilot narration with a pluggable TTS boundary.

The current `edge` provider is an online, no-key preview provider. The JSON
output format is deliberately provider-agnostic so VoxCPM, GPT-SoVITS or a
commercial voice can replace it without touching the Remotion composition.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import subprocess

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "pilot-v2.json"
PUBLIC_AUDIO = ROOT / "remotion" / "public" / "audio"
GENERATED = ROOT / "remotion" / "src" / "generated"
VOICE_TESTS = ROOT / "output" / "voice-tests"


def duration_seconds(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


async def synthesize(
    text: str,
    output: Path,
    voice: str,
    rate: str,
    pitch: str,
) -> list[dict]:
    output.parent.mkdir(parents=True, exist_ok=True)
    words: list[dict] = []
    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, pitch=pitch)
    with output.open("wb") as media:
        async for event in communicate.stream():
            if event["type"] == "audio":
                media.write(event["data"])
            elif event["type"] in {"WordBoundary", "SentenceBoundary"}:
                words.append(
                    {
                        "text": event["text"],
                        "start": round(event["offset"] / 10_000_000, 4),
                        "duration": round(event["duration"] / 10_000_000, 4),
                        "boundary": event["type"],
                    }
                )
    return words


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--voice", default=None)
    parser.add_argument("--timeline-output", type=Path, default=None)
    parser.add_argument("--skip-tests", action="store_true")
    args = parser.parse_args()

    data = json.loads(args.input.read_text(encoding="utf-8"))
    fps = int(data["fps"])
    voice = args.voice or data["voice"]["name"]
    rate = data["voice"]["rate"]
    pitch = data["voice"]["pitch"]
    audio_prefix = args.input.stem.replace("-v2", "")
    cursor = 0
    timeline = {"fps": fps, "voice": voice, "segments": []}

    for segment in data["segments"]:
        if segment["kind"] == "silent":
            frames = round(float(segment["fixed_seconds"]) * fps)
            item = {**segment, "startFrame": cursor, "durationInFrames": frames, "words": []}
        else:
            target = PUBLIC_AUDIO / f"{audio_prefix}-{segment['id']}.mp3"
            words = await synthesize(segment["spoken"], target, voice, rate, pitch)
            audio_seconds = duration_seconds(target)
            frames = round((audio_seconds + float(segment.get("tail_seconds", 0.35))) * fps)
            item = {
                **segment,
                "audio": f"audio/{target.name}",
                "audioSeconds": round(audio_seconds, 4),
                "startFrame": cursor,
                "durationInFrames": frames,
                "words": words,
            }
        timeline["segments"].append(item)
        cursor += frames

    timeline["durationInFrames"] = cursor
    GENERATED.mkdir(parents=True, exist_ok=True)
    timeline_output = args.timeline_output
    if timeline_output is None:
        timeline_output = GENERATED / (
            "full-timeline.json" if "full" in args.input.stem else "pilot-timeline.json"
        )
    elif not timeline_output.is_absolute():
        timeline_output = ROOT / timeline_output
    timeline_output.parent.mkdir(parents=True, exist_ok=True)
    timeline_output.write_text(
        json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if not args.skip_tests:
        VOICE_TESTS.mkdir(parents=True, exist_ok=True)
        intro = data["segments"][0]["spoken"]
        for label, test_voice, test_rate, test_pitch in [
            ("A-xiaoxiao", "zh-CN-XiaoxiaoNeural", "+4%", "+0Hz"),
            ("B-yunxi", "zh-CN-YunxiNeural", "+6%", "-2Hz"),
        ]:
            await synthesize(intro, VOICE_TESTS / f"{label}.mp3", test_voice, test_rate, test_pitch)

    print(
        f"voice={voice} duration={cursor / fps:.2f}s frames={cursor} "
        f"timeline={timeline_output}"
    )


if __name__ == "__main__":
    asyncio.run(main())
