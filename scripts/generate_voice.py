#!/usr/bin/env python3
"""Generate phrase-timed V2 pilot narration with a pluggable TTS boundary.

The current `edge` provider is an online, no-key preview provider. The JSON
output format is deliberately provider-agnostic so VoxCPM, GPT-SoVITS or a
commercial voice can replace it without touching the Remotion composition.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import re
import uuid
from pathlib import Path
import subprocess
import urllib.request

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "pilot-v2.json"
PUBLIC_AUDIO = ROOT / "remotion" / "public" / "audio"
GENERATED = ROOT / "remotion" / "src" / "generated"
VOICE_TESTS = ROOT / "output" / "voice-tests"
PRONUNCIATION_FILE = ROOT / "config" / "pronunciation.json"
DOUBAO_CRED_FILE = ROOT / "config" / "doubao.json"
DOUBAO_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse"
DOUBAO_RESOURCE_ID = "seed-tts-1.0"


def load_pronunciation() -> dict[str, str]:
    """Load display->tts homophone substitutions for ambiguous polyphones.

    Each rule must keep the same character length so word boundaries can be
    mapped back onto the original display text for subtitles.
    """
    if not PRONUNCIATION_FILE.exists():
        return {}
    table = json.loads(PRONUNCIATION_FILE.read_text(encoding="utf-8"))
    rules: dict[str, str] = {}
    for display, spoken in table.items():
        if display.startswith("_"):
            continue
        if len(display) != len(spoken):
            raise SystemExit(
                f"pronunciation rule must keep length: {display!r} -> {spoken!r}"
            )
        rules[display] = spoken
    # Apply longer phrases first so a short key never consumes part of a longer
    # one (e.g. "一行命令" must win over a hypothetical "一行").
    return dict(sorted(rules.items(), key=lambda item: len(item[0]), reverse=True))


def apply_pronunciation(text: str, rules: dict[str, str]) -> str:
    for display, spoken in rules.items():
        text = text.replace(display, spoken)
    return text


# English acronyms that Doubao would otherwise spell out letter by letter but
# should be read as a single word. Keys and values must stay the same length so
# word boundaries still map back onto the display text for captions.
ACRONYM_WORD_READINGS = {
    "README": "readme",
}


def soften_for_tts(text: str) -> str:
    """Make symbols read naturally without changing display text.

    Underscores and slashes inside identifiers (repo names, file names) should
    be silent, not read aloud as "下划线" / "斜杠". Replacing them with a space
    keeps the same word order so boundaries still map back to the display text.
    Acronyms listed in ACRONYM_WORD_READINGS are lowercased so the TTS reads
    them as one word (e.g. "readme") instead of spelling each letter.
    """
    for display, spoken in ACRONYM_WORD_READINGS.items():
        text = text.replace(display, spoken)
    return text.replace("_", " ").replace("/", " ")


def restore_display_words(
    words: list[dict], tts_text: str, display_text: str
) -> list[dict]:
    """Map word boundaries from substituted TTS text back to display text."""
    if tts_text == display_text:
        return words
    restored: list[dict] = []
    cursor = 0
    for word in words:
        index = tts_text.find(word["text"], cursor)
        if index == -1:
            restored.append(word)
            continue
        cursor = index + len(word["text"])
        restored.append({**word, "text": display_text[index:cursor]})
    return restored


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


def load_doubao_credentials() -> dict:
    if not DOUBAO_CRED_FILE.exists():
        raise SystemExit(
            f"Doubao credentials not found: {DOUBAO_CRED_FILE}. "
            'Create it with {"api_key": "...", "app_key": "<optional APP ID>"}.'
        )
    return json.loads(DOUBAO_CRED_FILE.read_text(encoding="utf-8"))


def split_sentences(text: str) -> list[str]:
    """Split TTS text into sentence units matching the caption granularity.

    The Remotion CaptionTrack displays one SentenceBoundary word at a time, so
    the fallback timing below must produce sentence-level words, not tokens.
    """
    parts = re.split(r"(?<=[。！？；!?;])", text)
    return [part for part in (piece.strip() for piece in parts) if part]


def estimate_sentence_words(text: str, total_seconds: float) -> list[dict]:
    """Distribute a segment's audio duration across sentences by length.

    Doubao's HTTP SSE endpoint returns audio only (no word boundaries), so the
    caption timeline is approximated by allocating each sentence a share of the
    total duration proportional to its character count. A small lead-in offset
    mirrors the edge provider's initial padding.
    """
    sentences = split_sentences(text)
    if not sentences:
        return []
    lead_in = 0.1
    usable = max(0.0, total_seconds - lead_in)
    weights = [max(1, len(sentence)) for sentence in sentences]
    weight_total = sum(weights)
    words: list[dict] = []
    cursor = lead_in
    for index, (sentence, weight) in enumerate(zip(sentences, weights)):
        if index == len(sentences) - 1:
            duration = max(0.0, lead_in + usable - cursor)
        else:
            duration = usable * weight / weight_total
        words.append(
            {
                "text": sentence,
                "start": round(cursor, 4),
                "duration": round(duration, 4),
                "boundary": "SentenceBoundary",
            }
        )
        cursor += duration
    return words


async def synthesize_doubao(
    text: str,
    output: Path,
    voice: str,
    speed_ratio: float = 1.0,
    attempts: int = 4,
) -> list[dict]:
    """Synthesize with Volcengine Doubao TTS (V3 unidirectional SSE).

    Returns sentence-level words whose timings are estimated from the audio
    duration, since this endpoint does not stream word boundaries. speed_ratio
    maps to the API's audio_params.speed_ratio (0.2-3.0, 1.0 = normal).
    """
    output.parent.mkdir(parents=True, exist_ok=True)
    boundaries_path = output.with_suffix(".words.json")
    if output.exists() and output.stat().st_size >= 512 and boundaries_path.exists():
        try:
            cached_words = json.loads(boundaries_path.read_text(encoding="utf-8"))
            if cached_words:
                return cached_words
        except (json.JSONDecodeError, OSError):
            pass
    credentials = load_doubao_credentials()
    temporary = output.with_name(f"{output.stem}.part{output.suffix}")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        temporary.unlink(missing_ok=True)
        payload = {
            "user": {"uid": "reporeel"},
            "req_params": {
                "text": text,
                "speaker": voice,
                "audio_params": {
                    "format": "mp3",
                    "sample_rate": 24000,
                    "speed_ratio": speed_ratio,
                },
            },
        }
        request = urllib.request.Request(
            DOUBAO_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Api-Key": credentials["api_key"],
                "X-Api-App-Key": credentials.get("app_key", ""),
                "X-Api-Resource-Id": DOUBAO_RESOURCE_ID,
                "X-Api-Request-Id": str(uuid.uuid4()),
            },
        )
        try:
            raw = await asyncio.to_thread(
                lambda: urllib.request.urlopen(request, timeout=120)
                .read()
                .decode("utf-8", "replace")
            )
            chunks: list[bytes] = []
            for line in raw.splitlines():
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                body = line[5:].strip()
                if body in ("[DONE]", ""):
                    continue
                try:
                    event = json.loads(body)
                except json.JSONDecodeError:
                    continue
                if isinstance(event, dict) and event.get("data"):
                    chunks.append(base64.b64decode(event["data"]))
            if not chunks:
                raise RuntimeError(f"doubao returned no audio: {raw[:300]}")
            temporary.write_bytes(b"".join(chunks))
            if temporary.stat().st_size < 512:
                raise RuntimeError(
                    f"incomplete speech output: bytes={temporary.stat().st_size}"
                )
            temporary.replace(output)
            words = estimate_sentence_words(text, duration_seconds(output))
            boundaries_path.write_text(
                json.dumps(words, ensure_ascii=False), encoding="utf-8"
            )
            return words
        except Exception as error:
            last_error = error
            temporary.unlink(missing_ok=True)
            if attempt == attempts:
                break
            print(
                f"voice_retry={attempt}/{attempts} "
                f"error={type(error).__name__}"
            )
            await asyncio.sleep(attempt * 2)
    raise RuntimeError(
        f"Speech generation failed after {attempts} attempts: {last_error}"
    ) from last_error


async def synthesize(
    text: str,
    output: Path,
    voice: str,
    rate: str,
    pitch: str,
    attempts: int = 4,
) -> list[dict]:
    output.parent.mkdir(parents=True, exist_ok=True)
    boundaries_path = output.with_suffix(".words.json")
    if output.exists() and output.stat().st_size >= 512 and boundaries_path.exists():
        try:
            cached_words = json.loads(boundaries_path.read_text(encoding="utf-8"))
            if cached_words:
                return cached_words
        except (json.JSONDecodeError, OSError):
            pass
    temporary = output.with_name(f"{output.stem}.part{output.suffix}")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        words: list[dict] = []
        temporary.unlink(missing_ok=True)
        communicate = edge_tts.Communicate(text, voice=voice, rate=rate, pitch=pitch)
        try:
            with temporary.open("wb") as media:
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
            if temporary.stat().st_size < 512 or not words:
                raise RuntimeError(
                    f"incomplete speech output: bytes={temporary.stat().st_size} "
                    f"boundaries={len(words)}"
                )
            temporary.replace(output)
            boundaries_path.write_text(
                json.dumps(words, ensure_ascii=False), encoding="utf-8"
            )
            return words
        except Exception as error:
            last_error = error
            temporary.unlink(missing_ok=True)
            if attempt == attempts:
                break
            print(
                f"voice_retry={attempt}/{attempts} "
                f"error={type(error).__name__}"
            )
            await asyncio.sleep(attempt * 2)
    raise RuntimeError(
        f"Speech generation failed after {attempts} attempts: {last_error}"
    ) from last_error


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--voice", default=None)
    parser.add_argument("--timeline-output", type=Path, default=None)
    parser.add_argument("--skip-tests", action="store_true")
    args = parser.parse_args()

    data = json.loads(args.input.read_text(encoding="utf-8"))
    fps = int(data["fps"])
    voice_config = data["voice"]
    provider = voice_config.get("provider", "edge")
    voice = args.voice or voice_config["name"]
    rate = voice_config.get("rate", "+0%")
    pitch = voice_config.get("pitch", "+0Hz")
    speed_ratio = float(voice_config.get("speech_rate", 1.0))
    audio_prefix = args.input.stem.replace("-v2", "")
    cursor = 0
    timeline = {"fps": fps, "voice": voice, "segments": []}
    speech_results: dict[str, tuple[Path, list[dict], float]] = {}
    semaphore = asyncio.Semaphore(4)
    pronunciation = load_pronunciation()

    async def prepare_speech(segment: dict) -> None:
        tts_text = soften_for_tts(apply_pronunciation(segment["spoken"], pronunciation))
        fingerprint = hashlib.sha1(
            (
                provider
                + "\0"
                + tts_text
                + "\0"
                + voice
                + "\0"
                + rate
                + "\0"
                + pitch
                + "\0"
                + str(speed_ratio)
            ).encode("utf-8")
        ).hexdigest()[:10]
        target = PUBLIC_AUDIO / (
            f"{audio_prefix}-{segment['id']}-{fingerprint}.mp3"
        )
        async with semaphore:
            if provider == "doubao":
                words = await synthesize_doubao(tts_text, target, voice, speed_ratio)
            else:
                words = await synthesize(tts_text, target, voice, rate, pitch)
        words = restore_display_words(words, tts_text, segment["spoken"])
        speech_results[segment["id"]] = (
            target,
            words,
            duration_seconds(target),
        )

    await asyncio.gather(
        *[
            prepare_speech(segment)
            for segment in data["segments"]
            if segment["kind"] != "silent"
        ]
    )

    for segment in data["segments"]:
        if segment["kind"] == "silent":
            frames = round(float(segment["fixed_seconds"]) * fps)
            item = {**segment, "startFrame": cursor, "durationInFrames": frames, "words": []}
        else:
            target, words, audio_seconds = speech_results[segment["id"]]
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

    if not args.skip_tests and provider == "edge":
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
