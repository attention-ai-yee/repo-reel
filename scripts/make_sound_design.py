#!/usr/bin/env python3
"""Create an original low-key electronic bed and UI accents for the V2 pilot."""

from __future__ import annotations

import json
import math
from pathlib import Path
import wave

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TIMELINE = ROOT / "remotion" / "src" / "generated" / "pilot-timeline.json"
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
    for harmonic in range(1, 8):
        result += np.sin(2 * np.pi * freq * harmonic * t) / harmonic
    return result * 0.52


def main() -> None:
    timeline = json.loads(TIMELINE.read_text(encoding="utf-8"))
    duration = timeline["durationInFrames"] / timeline["fps"]
    n = int((duration + 0.2) * SR)
    t = np.arange(n, dtype=np.float64) / SR
    music = np.zeros((n, 2), dtype=np.float64)

    tempo = 112
    beat = 60 / tempo
    chords = [
        [73.42, 110.00, 146.83, 174.61],
        [58.27, 87.31, 116.54, 146.83],
        [65.41, 98.00, 130.81, 164.81],
        [55.00, 82.41, 110.00, 138.59],
    ]
    chord_span = beat * 8
    for index, chord in enumerate(chords * math.ceil(duration / (chord_span * len(chords)))):
        start = index * chord_span
        if start >= duration:
            break
        mask = (t >= start) & (t < min(duration, start + chord_span + 0.35))
        local = t[mask] - start
        env = np.minimum(1, local / 0.45) * np.minimum(1, (chord_span + 0.35 - local) / 0.55)
        pad = sum(soft_saw(local, f) for f in chord) / len(chord)
        shimmer = 0.28 * np.sin(2 * np.pi * chord[-1] * 2 * local + 0.7 * np.sin(2 * np.pi * 0.08 * local))
        music[mask, 0] += 0.043 * env * (pad + shimmer)
        music[mask, 1] += 0.043 * env * (pad - shimmer * 0.5)

    rng = np.random.default_rng(20260715)
    for beat_index, start in enumerate(np.arange(0, duration, beat)):
        length = min(int(0.32 * SR), n - int(start * SR))
        if length <= 0:
            continue
        local = np.arange(length) / SR
        pos = int(start * SR)
        # Rounded electronic kick, intentionally restrained under narration.
        phase = 2 * np.pi * (54 * local + 44 * (1 - np.exp(-18 * local)) / 18)
        kick = np.sin(phase) * np.exp(-13 * local)
        music[pos : pos + length, :] += 0.105 * kick[:, None]
        # Short hat on the offbeat.
        hat_start = start + beat * 0.5
        hpos = int(hat_start * SR)
        hlen = min(int(0.09 * SR), n - hpos)
        if hlen > 0:
            hlocal = np.arange(hlen) / SR
            noise = rng.normal(0, 1, hlen)
            noise = np.concatenate([[0], np.diff(noise)])
            hat = noise * np.exp(-48 * hlocal)
            pan = 0.7 if beat_index % 2 else 0.35
            music[hpos : hpos + hlen, 0] += 0.012 * hat * (1 - pan)
            music[hpos : hpos + hlen, 1] += 0.012 * hat * pan

    # Gentle master fade and headroom; voice sits roughly 12 dB above this bed.
    fade = np.minimum(1, t / 1.2) * np.minimum(1, (duration - t) / 1.2)
    music *= np.clip(fade, 0, 1)[:, None]
    write_wav(OUT / "pilot-bed.wav", music)

    print(f"sound bed: {duration:.2f}s")


if __name__ == "__main__":
    main()
