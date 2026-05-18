"""
VieNeu-TTS worker process for the auto-create-video pipeline.

Loads the model + a preset voice ONCE, then accepts JSON-line requests on stdin
and emits JSON-line responses on stdout. Long-running so the Node side can
amortize the ~5-10s model load across all scenes in a single pipeline run.

Protocol
--------
stdout (one JSON object per line):
  {"status": "loading", "voiceId": "...", "emotion": "..."}   -- emitted at startup
  {"status": "ready"}                                          -- model loaded, accepting requests
  {"status": "ok", "outPath": "..."}                           -- successful synth
  {"status": "err", "message": "..."}                          -- bad request / synth failed
  {"status": "bye"}                                            -- about to exit

stdin (one JSON object per line):
  {"op": "synth", "text": "...", "outPath": "abs/path/to.wav"}  -- synthesize text → wav
  {"op": "exit"}                                                 -- shutdown cleanly
  (EOF on stdin also triggers shutdown)

Args
----
argv[1]  voice preset id    (default: "Binh")
argv[2]  emotion             (default: "natural")

Spawn from Node with cwd=VIENEU_PROJECT_DIR (uv project root) and
PYTHONIOENCODING=utf-8 so Vietnamese diacritics survive console pipes on
Windows. Model loading log spam is written to stderr and can be ignored
by the parent.
"""

import sys
import json

# Force unbuffered line writes on stdout so Node sees responses immediately.
# (CPython buffers stdout when piped — without this, Node waits forever.)
def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    voice_id = sys.argv[1] if len(sys.argv) > 1 else "Binh"
    emotion = sys.argv[2] if len(sys.argv) > 2 else "natural"

    emit({"status": "loading", "voiceId": voice_id, "emotion": emotion})

    try:
        from vieneu import Vieneu
        tts = Vieneu(emotion=emotion)
        voice_data = tts.get_preset_voice(voice_id)
    except Exception as e:
        emit({"status": "err", "message": f"model load failed: {e}"})
        return 1

    emit({"status": "ready"})

    for raw in sys.stdin:
        # Strip BOM (PowerShell pipes prepend one) + whitespace.
        line = raw.lstrip("﻿").strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            emit({"status": "err", "message": f"bad json: {e}"})
            continue

        op = req.get("op", "synth")
        if op == "exit":
            break

        if op != "synth":
            emit({"status": "err", "message": f"unknown op: {op}"})
            continue

        text = req.get("text") or ""
        out_path = req.get("outPath") or ""
        if not text or not out_path:
            emit({"status": "err", "message": "missing text or outPath"})
            continue

        try:
            audio = tts.infer(text=text, voice=voice_data)
            tts.save(audio, out_path)
            emit({"status": "ok", "outPath": out_path})
        except Exception as e:
            emit({"status": "err", "message": f"synth failed: {e}"})

    emit({"status": "bye"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
