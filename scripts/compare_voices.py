"""
One-shot helper: synthesize the same Vietnamese sentence with every VieNeu-TTS
preset voice, save each to output/voice-samples/<voiceId>.wav, so we can audition
them side-by-side. Loads the Vieneu model once and reuses it across all voices.

Run from the VieNeu-TTS repo:
    PYTHONIOENCODING=utf-8 uv run python <abs path to this script>
"""

import sys
import os
from pathlib import Path

OUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("voice-samples")
TEXT = sys.argv[2] if len(sys.argv) > 2 else (
    "Manchester United cần ai kế nhiệm Bruno Fernandes? "
    "Tin đồn đẩy mạnh sang Elliot Anderson với mức giá hơn một trăm triệu bảng. "
    "Nhưng cựu trợ lý Meulensteen lại có một đáp án khác."
)

OUT_DIR.mkdir(parents=True, exist_ok=True)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from vieneu import Vieneu  # noqa: E402

print("[loading model] (one-time)")
tts = Vieneu(emotion="natural")

voices = tts.list_preset_voices()
print(f"[found] {len(voices)} preset voices")

for label, voice_id in voices:
    out_path = OUT_DIR / f"{voice_id}.wav"
    print(f"[synth] {voice_id:8s}  ({label})  → {out_path}")
    voice_data = tts.get_preset_voice(voice_id)
    audio = tts.infer(text=TEXT, voice=voice_data)
    tts.save(audio, str(out_path))

print(f"[done] {len(voices)} files in {OUT_DIR}")
