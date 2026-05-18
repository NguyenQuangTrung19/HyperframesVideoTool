---
name: create-music-video
description: Build a 9:16 TikTok music-video clip from a user-supplied song + background video, with karaoke-style lyric captions burned on top. The song is muxed in place of the video's original audio, the video is reformatted into 9:16 with a blurred-background fit, and a karaoke caption highlights each word as the song plays. Distinct from `/create-podcast` — that skill generates TTS voice from a script; this skill uses the user's own song audio and aligns existing lyrics. The user-facing slash command is `/create-music-video <path-to-input-dir>`.
---

# Create Music Video Skill

Build a 9:16 music-video TikTok clip by combining:

1. A song audio file (mp3/wav/m4a/flac/aac/ogg)
2. A background video file (any aspect ratio — typically 16:9 footage)
3. (Optional) A `.txt` of the song lyrics — used as a Whisper hint to make karaoke alignment more accurate on music

The pipeline drops the source video's audio, reformats it into 1080×1920 with a blurred-background "TikTok repurpose" look, runs faster-whisper on the song to get per-word timestamps (biased by the lyrics hint when supplied), and burns a karaoke caption that highlights each word as it's sung.

## When to use this skill vs others

| | `/create-video` | `/create-podcast` | `/create-music-video` (this) |
|---|---|---|---|
| Audio | TTS from script | TTS from script | **User's song file** |
| Visual | Motion graphics | User's video + 9:16 | User's video + 9:16 |
| Captions | None | Karaoke (TTS-timed) | **Karaoke (song-timed)** |
| Lyrics | n/a | n/a | Optional `.txt`, drives alignment hint |

`/create-music-video` is the right choice when:
- The user has a music clip (cover, original song, fan-made track, AI-generated song) they want to post as a lyric-video.
- They have b-roll / footage they want layered behind the music.
- They want the karaoke aesthetic on top.

## Input

Single argument: a path to an input slug directory (or any sibling file inside it). **Sibling files must exist**:

| File | Required | Purpose |
|---|---|---|
| `<slug>.mp4` (or .mov/.webm/.mkv/.m4v) | ✅ | Background video |
| `<slug>.mp3` (or .wav/.m4a/.flac/.aac/.ogg) | ✅ | Song audio |
| `<slug>.txt` | ⚠ Optional | Lyrics text — improves whisper alignment when supplied |

Example layout:

```
input/em-cua-ngay-hom-qua/
  em-cua-ngay-hom-qua.mp4    ← background footage
  em-cua-ngay-hom-qua.mp3    ← the song
  em-cua-ngay-hom-qua.txt    ← lyrics (optional)
```

If the song is instrumental-only, omit the .txt and the pipeline will produce empty captions (or fail loudly if Whisper can't find any vocals — that's the cue to either accept no captions or supply lyrics manually).

## One-time setup (skip if already done for `/create-podcast`)

The alignment step uses faster-whisper running inside the VieNeu-TTS uv project. Install once:

```sh
cd $VIENEU_PROJECT_DIR
uv add faster-whisper
```

## Workflow

### Step 1: Validate input

- Single argument: path to a directory OR a sibling file inside it.
- Resolve `slug` from the directory name.
- Verify a `.mp4`-ish + an audio file both exist under that slug.
- `.txt` is optional. If missing, alignment runs without a hint (less accurate on music — quality depends on the model size).

### Step 2: Run the pipeline

Run `npm run music -- <path-to-input-dir>`. This executes [`src/music/pipeline.ts`](../../../src/music/pipeline.ts) which:

1. Probes audio duration (this drives the timeline length).
2. Runs `align_worker.py` via uv inside the VieNeu env, passing the lyrics file as Whisper's `initial_prompt` when available.
3. Builds `captions.ass` — karaoke subtitle with a 5-word sliding window (wider than podcast since sung syllables hold longer).
4. Calls ffmpeg with one filter graph:
   - Loops the source video to song duration
   - Drops the source audio entirely
   - 9:16 reformat: blurred zoomed copy as background + letterbox-fit foreground
   - Burns `captions.ass` via libass
   - Muxes the song audio as the only audio track
5. Writes `output/<slug>/<slug>.mp4`.

### Step 3: Report

- The output mp4 path.
- Song duration.
- That `words.json` is cached — delete to force re-alignment if alignment looks off and you want to retry with a different model.

## Idempotency

- `words.json` is re-used on re-run. Delete to force re-alignment.
- `captions.ass` regenerated every time (cheap, lets you re-style without re-aligning).
- The final mp4 is regenerated every time.

## Tunable env vars (.env.local)

| Var | Default | Purpose |
|---|---|---|
| `MUSIC_ALIGN_LANG` | `vi` | Whisper transcription language code |
| `MUSIC_ALIGN_MODEL` | `medium` | Whisper model size — music is harder than TTS, so default is bumped from `small` to `medium`. Try `large-v3` if alignment is still off |
| `MUSIC_CAPTION_FONT` | `Arial Black` | Caption font (must be installed) |
| `MUSIC_CAPTION_FONTSIZE` | `84` | Font size in 1080×1920 px units (smaller than podcast since 5-word window) |
| `MUSIC_CAPTION_WINDOW` | `5` | Visible word count: `1` (one-at-a-time), `3` (podcast-style), `5` (line-ish) |
| `MUSIC_CAPTION_Y` | `0.62` | Vertical position 0..1; default places caption just below center |
| `MUSIC_CAPTION_ACTIVE_COLOR` | `FFFF00` | Active-word hex color (no #) |
| `MUSIC_CAPTION_BASE_COLOR` | `FFFFFF` | Non-active word hex color |
| `MUSIC_FPS` | `30` | Output frame rate |
| `MUSIC_CRF` | `20` | x264 quality, lower = better |
| `MUSIC_PRESET` | `medium` | x264 preset, `fast` halves render time |

## Common failure modes

- **"No sibling music audio found"** — the slug dir exists but no `<slug>.{mp3,...}` next to the video. Drop the song in.
- **"Alignment returned 0 words"** — fully instrumental or vocals too quiet for Whisper. Try `MUSIC_ALIGN_MODEL=large-v3`, supply a `.txt` of lyrics as a hint, or accept that this clip can't have karaoke captions and use a different pipeline.
- **Captions drift from the music** — Whisper-on-music alignment is imperfect; `large-v3` plus a clean instrumental-light track is the best combo. For pro karaoke timing the user typically needs to hand-tune `words.json` and re-run.
- **Copyright** — flag to the user that posting copyrighted songs to TikTok may mute the audio or strike the account; suggest royalty-free / self-made / licensed audio.

## Boundary

This skill does NOT generate the song or the video — both must be supplied. If the user wants AI-generated singing TTS, that's a different problem (Suno / Udio etc.). If they want motion-graphic karaoke without real footage, that's not built either.
