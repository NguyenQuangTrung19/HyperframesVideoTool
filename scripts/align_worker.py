"""
Word-level forced-alignment worker for the podcast-clip pipeline.

Runs faster-whisper on a TTS-generated mp3 to recover per-word start/end
timestamps, which the Node side turns into a karaoke .ass subtitle file.

Why faster-whisper:
- TTS output is studio-clean → near-perfect alignment with "small" model.
- Local + free (vs OpenAI Whisper API), keeps the project local-first.
- word_timestamps=True returns char-accurate boundaries.

Protocol
--------
argv[1]  abs path to mp3 (or wav) audio file
argv[2]  language code (default "vi")
argv[3]  model size (default "small": tiny|base|small|medium|large-v3)
argv[4]  optional path to a UTF-8 text file holding an `initial_prompt` for
         Whisper (e.g. song lyrics). Pass "-" or omit to skip. Whisper
         silently truncates the prompt to ~224 tokens, so the caller is
         expected to keep it short.

stdout: single JSON object
  {
    "words": [
      {"w": "Vinícius", "start": 0.42, "end": 0.78},
      ...
    ],
    "language": "vi",
    "modelSize": "small"
  }

stderr: model load + transcribe progress (ignored by parent)

First run downloads the chosen model (~150 MB for small). Cached under
~/.cache/huggingface so subsequent runs are fast.

Dependencies are declared inline (PEP 723) so the Node side can run this with
`uv run --script align_worker.py …` — uv auto-provisions an ephemeral, cached
env with faster-whisper. No external project (e.g. VieNeu-TTS) is required.
"""

# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "faster-whisper>=1.0",
# ]
# ///

import sys
import json


def emit_error(msg: str, code: int = 1) -> int:
    sys.stdout.write(json.dumps({"error": msg}, ensure_ascii=False) + "\n")
    sys.stdout.flush()
    return code


def main() -> int:
    if len(sys.argv) < 2:
        return emit_error("usage: align_worker.py <audio_path> [language] [model_size]", 2)

    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "vi"
    model_size = sys.argv[3] if len(sys.argv) > 3 else "small"
    prompt_path = sys.argv[4] if len(sys.argv) > 4 else "-"

    initial_prompt = None
    if prompt_path and prompt_path != "-":
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                initial_prompt = f.read().strip() or None
        except OSError as e:
            return emit_error(f"failed to read prompt file {prompt_path}: {e}", 6)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return emit_error(
            "faster-whisper not installed in this Python env. "
            "Run `uv add faster-whisper` inside the VieNeu project dir, "
            "or `uv pip install faster-whisper` if you prefer pip.",
            3,
        )

    # int8 is plenty for word alignment on CPU and ~4x faster than float32.
    print(f"loading whisper model: {model_size}", file=sys.stderr)
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception as e:
        return emit_error(f"model load failed: {e}", 4)

    print(f"transcribing: {audio_path} (lang={language})", file=sys.stderr)
    try:
        segments, _info = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
            # vad_filter cuts silence-only segments which can swallow short words
            # in podcasts — keep it OFF for tight karaoke timing.
            vad_filter=False,
            beam_size=1,
            condition_on_previous_text=False,
            initial_prompt=initial_prompt,
        )
    except Exception as e:
        return emit_error(f"transcribe failed: {e}", 5)

    words = []
    for seg in segments:
        if not seg.words:
            continue
        for w in seg.words:
            # faster-whisper occasionally leaks a leading space onto word.word
            text = (w.word or "").strip()
            if not text:
                continue
            words.append({
                "w": text,
                "start": round(float(w.start), 3),
                "end": round(float(w.end), 3),
            })

    sys.stdout.write(json.dumps({
        "words": words,
        "language": language,
        "modelSize": model_size,
    }, ensure_ascii=False) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
