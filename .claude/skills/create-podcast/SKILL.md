---
name: create-podcast
description: Build a 9:16 TikTok podcast-clip video from a Vietnamese podcast .txt script and a user-supplied background video file. The TTS voice is laid over the muted source video, the source is reformatted into 9:16 inside a small rounded-corner card anchored near the top of the canvas (TikTok/Reels/FB-optimized layout), with big karaoke captions burned below the card (white + light-blue active word). Distinct from `/create-video` — that skill builds motion-graphic scenes from a script, this skill overlays a podcast over user-supplied footage. The user-facing slash command is `/create-podcast <path-to-source.txt>`.
---

# Create Podcast Skill

Build a 9:16 podcast-style TikTok clip by combining:

1. A Vietnamese .txt script (the podcast content — any prose the user wants narrated)
2. A user-supplied background video file (any aspect ratio — typically 16:9 footage)

The pipeline mutes the source video's audio, reformats it into a small 3:4 portrait rounded-corner card (default **660×880, anchored at y=240**) sitting on a 1080×1920 black canvas — leaving the top for the brand-shell header and the bottom for big karaoke captions. This is the TikTok / Instagram Reels / Facebook Reels podcast-clip layout: small "preview" card up top, full-width captions below. Voiceover comes from ElevenLabs / AusyncLab / VieNeu (configurable), word-aligned via faster-whisper, then burned in as karaoke captions (white base + light-blue active word).

**Voice quality matters for this format.** Unlike motion-graphic clips (where on-screen text + visuals carry the load), a podcast-clip lives or dies on the voice. VieNeu's emotion is too flat — set `PODCAST_TTS_PROVIDER=ausynclab` (recommended, reuses existing AusyncLab plan + lets you pick a podcast-specific voice via `PODCAST_AUSYNCLAB_VOICE_ID`) or `PODCAST_TTS_PROVIDER=elevenlabs` (with `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`) in `.env.local` to override only this skill. Motion-graphic stays on whatever global `TTS_PROVIDER` is set to.

## When to use this skill vs `/create-video`

| | `/create-video` | `/create-podcast-video` (this skill) |
|---|---|---|
| Input | .txt only | .txt + sibling video file |
| Visual | Generated motion graphics (HyperFrames templates) | User's video, reformatted to 9:16 with blur-bg |
| Captions | None on-screen (template fields carry the load) | Karaoke word-by-word burn-in |
| Source-of-truth for length | Script-driven (6–15 scenes, 45–180s) | TTS-driven (any length the .txt produces) |
| Use case | "Branded analysis post" | "Podcast clip riding on real footage" |

`/create-podcast-video` is the right choice when:
- The user has a long opinion / hot take / explanation they want to narrate.
- They have a video file (training session, press conference, fan-cam, training clip, etc.) that provides the visual.
- They want the TikTok-native "podcast clip aesthetic" — captions popping word by word over real footage.

## Input

```
/create-podcast <path/to/source.txt> [music-file]
```

**Arg 1 (required) — path to a `.txt` file.** TTS duration = output duration.

**Arg 2 (optional) — background music override.** Overrides the auto-discovered `assets/beat/input.{m4a,mp3,wav,mp4}`. Resolution rules:
- Bare filename (e.g. `input2.m4a`) → resolved against `assets/beat/`
- Filename with path separator OR absolute path → used as-is
- Same extension support as the auto-discovery (m4a / mp3 / wav / mp4)
- Examples: `/create-podcast input/neymar/neymar.txt input2.m4a`, `/create-podcast input/x/x.txt C:/music/track.mp3`

**Sibling video(s) — required, same dir as .txt.** One or more files named `<slug>.<ext>` (`<ext>` ∈ {mp4, mov, webm, mkv, m4v}). When the script's TTS runs longer than the first video, the next-numbered file is appended in order; the entire chain loops if needed. Numbering is natural-sorted so `<slug>10.mp4` comes after `<slug>2.mp4`.

Example layout:

```
input/neymar/
  neymar.txt     ← podcast script
  neymar.mp4     ← background video #1 (plays first)
  neymar2.mp4    ← background video #2 (plays when #1 ends, if TTS still has time)
  neymar3.mp4    ← #3, …
```

⚠️ **All sibling videos should share the same resolution + codec.** They are concatenated via ffmpeg's `concat` demuxer which does NOT transcode mid-stream — a mismatch will fail loudly. Use a re-encoder (e.g. `ffmpeg -i x.mov -c:v libx264 x.mp4`) to normalize first if your inputs differ.

If no sibling video matches, the skill aborts.

## One-time setup (skip if already done)

The alignment step uses faster-whisper running inside the existing VieNeu-TTS uv project. Install once:

```sh
cd $VIENEU_PROJECT_DIR     # path from VIENEU_PROJECT_DIR env, default ../VieNeu-TTS
uv add faster-whisper
```

First run also downloads the Whisper model (~150 MB for "small", which is the default and is plenty accurate for clean TTS audio).

## Workflow

### Step 1: Validate input

- Arg 1 must be a path to an existing `.txt` file.
- At least one sibling video file must exist (`<slug>.{mp4,mov,webm,mkv,m4v}` — additional numbered files like `<slug>2.mp4` are picked up automatically).
- If a second arg is supplied, it's a music-file override (bare filename → `assets/beat/<arg>`; absolute or path-with-separator → used as-is).
- If the user passed a URL, redirect them to `/read-rewrite` to produce the .txt first, then have them drop a video next to it.
- If the .txt is empty, reject.

### Step 2: Run the pipeline

Run `npm run podcast -- <abs-path-to-txt> [music-file]`. This executes [`src/podcast/pipeline.ts`](../../../src/podcast/pipeline.ts) which:

1. Reads & normalizes the .txt (strips markdown headings, label-only lines like `Key facts:`, collapses blank-line runs).
2. Generates TTS voice via `VieNeuClient` (the same client used by `/create-video`).
3. Runs `align_worker.py` via uv inside the VieNeu env → returns per-word timestamps.
4. Builds `captions.ass` — karaoke subtitle with a 3-word sliding window, active word in yellow.
5. Calls ffmpeg with one filter graph:
   - Concatenates all sibling videos in natural order and loops the chain to cover TTS duration
   - Drops the source audio entirely
   - 9:16 reformat: solid black 1080×1920 canvas + foreground scaled to fit with rounded corners (default radius 40px, tunable via `PODCAST_CORNER_RADIUS`)
   - Burn-in `captions.ass` via libass (white base + light-blue active word)
   - Mux TTS audio + optional background music (auto-picked from `assets/beat/input.{m4a,mp3,wav,mp4}` if present, first match wins, mixed at `PODCAST_BG_MUSIC_VOLUME=0.15`)
6. Writes `output/<slug>/<slug>.mp4`.

### Step 3: Report

Tell the user:
- The output mp4 path (the deliverable to upload).
- Total duration (`voice.mp3` length).
- That `voice.mp3` is also written if they want to import it into CapCut for manual touch-ups.
- That `words.json` is cached — deleting it forces re-alignment if they edit voice timing later.

## Idempotency

- `voice.mp3` is re-used on re-run. Delete it to force re-TTS (e.g. if the .txt changed).
- `words.json` is re-used on re-run. Delete it to force re-alignment.
- `captions.ass` is regenerated every time (cheap).
- The final mp4 is regenerated every time (always reflects current voice + words).

So the common debug cycle "tweak caption styling → re-render" only re-runs the ffmpeg compose step.

## Tunable env vars (.env.local)

| Var | Default | Purpose |
|---|---|---|
| `PODCAST_TTS_PROVIDER` | (unset → global) | Override TTS for this skill only: `ausynclab` \| `elevenlabs` \| `vieneu`. When unset, auto-picks ElevenLabs if its creds are set, else global `TTS_PROVIDER`. **`ausynclab`** is the current premium pick — natural-sounding, paid (AUSYNCLAB_API_KEY required); pair with `PODCAST_AUSYNCLAB_VOICE_ID` to use a different voice than the main pipeline |
| `ELEVENLABS_API_KEY` | (unset) | Required when `PODCAST_TTS_PROVIDER=elevenlabs` |
| `ELEVENLABS_VOICE_ID` | (unset) | ElevenLabs voice ID (stock or cloned). Get from elevenlabs.io → Voices |
| `ELEVENLABS_MODEL` | `eleven_multilingual_v2` | Model used for synth — `eleven_multilingual_v2` reads VN best |
| `ELEVENLABS_STABILITY` | `0.5` | 0.0–1.0 — lower = more expressive, higher = more monotone |
| `ELEVENLABS_SIMILARITY_BOOST` | `0.75` | 0.0–1.0 — how closely to match the source voice |
| `ELEVENLABS_STYLE` | `0.0` | 0.0–1.0 — bump for more dramatic delivery (costs latency) |
| `PODCAST_ALIGN_LANG` | `vi` | Whisper transcription language code |
| `PODCAST_ALIGN_MODEL` | `small` | Whisper model size — `small` is the sweet spot. Use `medium` for slightly better diacritic accuracy at ~3× the compute |
| `PODCAST_CAPTION_MODE` | `sentence` | Caption display style. `sentence` (default) shows the full current sentence with the active word highlighted — easier to read for podcast narration. `word` shows a 3-word sliding karaoke window (older behavior, useful for fast-paced clips) |
| `PODCAST_CAPTION_FONT` | `Segoe UI` | Caption font family — must be installed on the system (Segoe UI ships with Windows 11, full VN diacritic support; alternatives: `Bahnschrift` for condensed look, `Calibri` for softer feel, `Segoe UI Black` for heavier weight) |
| `PODCAST_CAPTION_FONTSIZE` | sentence: `60` / word: `68` | Caption font size in 1080×1920 px units. Sentence mode defaults to smaller (60) since the whole sentence needs to fit; word mode keeps 68 |
| `PODCAST_CAPTION_Y` | (auto) | Vertical position of caption as fraction of canvas height. **By default this is auto-anchored 180px below the foreground card's bottom edge** (so captions track the card position). Override with a fraction (e.g. `0.65` = y=1248, `0.50` = mid-frame). When the card is too tall to leave room below (legacy `PODCAST_FG_MARGIN` mode), falls back to the caption module's own default (sentence: 0.78, word: 0.82) |
| `PODCAST_CORNER_RADIUS` | `40` | Foreground corner radius in px. `0` = sharp corners, `80+` = very rounded card look |
| `PODCAST_CARD_STROKE` | `4` | Width (px) of a thin white outline drawn around the card so the rounded corners read against the pure-black canvas (black-on-black would hide the curve). `0` = no outline. Only drawn when `PODCAST_CORNER_RADIUS > 0` |
| `PODCAST_FG_WIDTH` | `660` | Foreground card width (px) on the 1080×1920 canvas. Default `660` pairs with height `880` for a clean 3:4 portrait card. The source video is scaled to fit inside this box (aspect-preserved) and pillarbox/letterbox-padded to fill the box. `1080` = full-width |
| `PODCAST_FG_HEIGHT` | `880` | Foreground card height (px). Default `880` paired with width `660` = 3:4 portrait — the TikTok/Reels/FB podcast-clip aesthetic, leaving room for brand-shell above and big captions below |
| `PODCAST_FG_Y` | `240` | Top Y position of the foreground card (px from the top of the canvas). `240` sits just below the brand-shell header. `0` flush-top, larger values push down |
| `PODCAST_FG_X` | (auto-centered) | Left X position (px). Omit → card horizontally centered: `x=(1080-width)/2`. Set explicitly to anchor left/right (e.g. `0` flush-left) |
| `PODCAST_FG_MARGIN` | (unset) | **Legacy** — when any of `PODCAST_FG_WIDTH/HEIGHT/Y/X` is set, this is ignored. When set alone, it sizes the card as `(1080-2M) × (1920-2M)` anchored at `(M,M)` — i.e. equal-margin black border on all sides, the older "near-full-canvas card" look |
| `PODCAST_LOGO` | (auto) | Path to a PNG logo overlaid **top-left** (matches `/create-video` brand-shell). Auto-uses `assets/logoPodcast.png` if present. Set to empty string to disable |
| `PODCAST_LOGO_WIDTH` | `120` | Logo target width in px (height preserved by aspect ratio) |
| `PODCAST_LOGO_MARGIN` | `60` | Margin (px) from the top + left edges |
| `PODCAST_BRAND_NAME` | `TIKTOK_DISPLAY_NAME` or `SportsForAllTV` | Channel name rendered beside the logo in 40px white Segoe UI Bold. Empty string disables |
| `PODCAST_BRAND_TAG` | `PODCAST` | Tag line below brand name in 24px cyan (#22D3EE) — uppercased automatically. Empty string disables |
| `PODCAST_BG_MUSIC` | (auto) | Path to background music file. Auto-tries `assets/beat/input.{m4a,mp3,wav,mp4}` in order. Set to empty string to disable |
| `PODCAST_BG_MUSIC_VOLUME` | `1.0` | Linear volume (0..2) applied to bg music before mixing under TTS. `0.15` ≈ whisper-quiet, `0.5` markedly present, `1.0` rivals the voice (default), `>1.0` boosts above original (may clip on summed peaks) |
| `PODCAST_TAIL_SEC` | `7` | Seconds of "video tail" after the main voice ends — video + music continue, no voice, no caption. Provides a breath before the outro slides in. Set `0` to skip |
| `PODCAST_OUTRO_ENABLED` | `true` | Toggle the outro card at the end. Set `false` to skip entirely (output ends at voice + tail) |
| `PODCAST_OUTRO_SEC` | `5` | Outro card duration in seconds. The rounded foreground video is replaced with a TikTok-style follow card (channel name, handle, follow button, source) for this many seconds |
| `PODCAST_OUTRO_TEXT` | `"Theo dõi Sports For All Ti Vi để xem nhiều phân tích sâu hơn mỗi tuần."` | Vietnamese TTS line spoken during the outro phase. Reuses the same TTS provider as the main voice |
| `PODCAST_OUTRO_HANDLE` | `TIKTOK_HANDLE` or `@bonglan0702` | Channel handle rendered under the channel name on the outro card |
| `PODCAST_OUTRO_FOLLOWERS` | `TIKTOK_FOLLOWERS` or `1.2M followers` | Follower-count line on the outro card |
| `PODCAST_OUTRO_CTA` | `Theo dõi ngay` | Label on the red follow-pill button |
| `PODCAST_OUTRO_SOURCE` | `Sưu tầm` | Source-attribution line at the bottom of the outro card (`Nguồn:` prefix is added automatically) |
| `PODCAST_FPS` | `30` | Output frame rate |
| `PODCAST_CRF` | `20` | x264 quality, lower = better |
| `PODCAST_PRESET` | `medium` | x264 preset, e.g. `fast` halves render time |

## Common failure modes

- **"No sibling video found"** — the .txt exists but no `<slug>.{mp4,...}` (or numbered variant) next to it. Ask user to put at least one video there.
- **"Unsafe file name"** / concat demuxer mismatch — siblings have different resolutions or codecs. Re-encode them to a common format first.
- **"Background music file not found"** — the 2nd CLI arg or `PODCAST_BG_MUSIC` env points to a file that doesn't exist (after `assets/beat/` resolution).
- **"faster-whisper not installed"** — run the one-time install above.
- **"VieNeu project dir not found"** — see existing `/create-video` skill setup; this skill shares the same TTS infrastructure.
- **Audio + caption misaligned** — try `PODCAST_ALIGN_MODEL=medium`. Vietnamese diacritics occasionally trip `small` on phrases with rapid stress changes.

## Boundary with `/create-video`

This skill does NOT classify content or impose scene/density rules. The .txt is treated as plain prose — the user owns pacing and structure. If they want the channel's motion-graphic look instead, route them to `/create-video`.
