#!/usr/bin/env python3
"""Create an original continuation bed for the full V2 episode."""

from __future__ import annotations

import json
import math
from pathlib import Path
import wave

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TIMELINE = ROOT / "remotion" / "src" / "generated" / "full-timeline.json"
OUT = ROOT / "remotion" / "public" / "audio"
SR = 48_000


def write_wav(path: Path, samples: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    stereo = samples if samples.ndim == 2 else np.column_stack([samples, samples])
    peak = max(1e-9, float(np.max(np.abs(stereo))))
    if peak > 0.97:
        stereo = stereo * (0.97 / peak)
    pcm = np.int16(np.clip(stereo, -1, 1) * 32767)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())


def soft_saw(t: np.ndarray, freq: float) -> np.ndarray:
    result = np.zeros_like(t)
    for harmonic in range(1, 7):
        result += np.sin(2 * np.pi * freq * harmonic * t) / harmonic
    return result * 0.5


def main() -> None:
    timeline = json.loads(TIMELINE.read_text(encoding="utf-8"))
    first_spoken = next(item for item in timeline["segments"] if item["kind"] == "spoken")
    offset = first_spoken["startFrame"] / timeline["fps"]
    total = timeline["durationInFrames"] / timeline["fps"]
    duration = total - offset
    n = int((duration + 0.25) * SR)
    t = np.arange(n, dtype=np.float64) / SR
    music = np.zeros((n, 2), dtype=np.float64)
    rng = np.random.default_rng(20260716)

    tempo = 116
    beat = 60 / tempo
    chords = [
        [73.42, 110.00, 146.83, 220.00],
        [65.41, 98.00, 130.81, 196.00],
        [55.00, 82.41, 110.00, 164.81],
        [61.74, 92.50, 123.47, 185.00],
    ]
    chord_span = beat * 8
    repeats = math.ceil(duration / (chord_span * len(chords)))
    for index, chord in enumerate(chords * repeats):
        start = index * chord_span
        if start >= duration:
            break
        mask = (t >= start) & (t < min(duration, start + chord_span + 0.45))
        local = t[mask] - start
        env = np.minimum(1, local / 0.42) * np.minimum(
            1, (chord_span + 0.45 - local) / 0.62
        )
        pad = sum(soft_saw(local, freq) for freq in chord) / len(chord)
        motion = 0.22 * np.sin(
            2 * np.pi * chord[-1] * local + 0.8 * np.sin(2 * np.pi * 0.09 * local)
        )
        music[mask, 0] += 0.038 * env * (pad + motion)
        music[mask, 1] += 0.038 * env * (pad - motion * 0.45)

    for beat_index, start in enumerate(np.arange(0, duration, beat)):
        pos = int(start * SR)
        length = min(int(0.3 * SR), n - pos)
        local = np.arange(length) / SR
        phase = 2 * np.pi * (52 * local + 38 * (1 - np.exp(-18 * local)) / 18)
        kick = np.sin(phase) * np.exp(-14 * local)
        music[pos : pos + length, :] += 0.085 * kick[:, None]
        hat_start = start + beat * 0.5
        hpos = int(hat_start * SR)
        hlen = min(int(0.075 * SR), n - hpos)
        if hlen > 0:
            hlocal = np.arange(hlen) / SR
            noise = np.concatenate([[0], np.diff(rng.normal(0, 1, hlen))])
            hat = noise * np.exp(-55 * hlocal)
            pan = 0.68 if beat_index % 2 else 0.32
            music[hpos : hpos + hlen, 0] += 0.009 * hat * (1 - pan)
            music[hpos : hpos + hlen, 1] += 0.009 * hat * pan

    fade = np.minimum(1, t / 0.8) * np.minimum(1, (duration - t) / 1.4)
    music *= np.clip(fade, 0, 1)[:, None]
    write_wav(OUT / "full-bed.wav", music)
    print(f"full sound bed: offset={offset:.2f}s duration={duration:.2f}s")


if __name__ == "__main__":
    main()
