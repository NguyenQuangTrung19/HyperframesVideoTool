---
name: create-podcast
description: Build a 9:16 TikTok podcast-clip video from a Vietnamese podcast .txt script and a user-supplied background video file. The TTS voice is laid over the muted source video, the source is reformatted into 9:16 inside a small rounded-corner card anchored near the top of the canvas (TikTok/Reels/FB-optimized layout), with big karaoke captions burned below the card (white + light-blue active word). Distinct from `/create-video` — that skill builds motion-graphic scenes from a script, this skill overlays a podcast over user-supplied footage. The user-facing slash command is `/create-podcast <path-to-source.txt>`.
---

# Create Podcast Skill

Build a 9:16 podcast-style TikTok clip by combining:

1. A Vietnamese .txt script (the podcast content — any prose the user wants narrated)
2. A user-supplied background video file (any aspect ratio — typically 16:9 footage)

The pipeline mutes the source video's audio, reformats it into a 1:1 rounded-corner card (default **880×880, anchored at y=520**) centered on a 1080×1920 black canvas — there's a ~92px gap between the card outline and the canvas edges on the left + right (and matching black space above + below for the brand-shell header and big karaoke captions). The outline (8px stroke) defaults to **black** so it blends with the canvas; override to white or another color via the stroke source if you want a visible frame. This is the TikTok / Instagram Reels / Facebook Reels podcast-clip layout: small "preview" card up top, full-width captions below. Voiceover comes from ElevenLabs / AusyncLab / VieNeu (configurable), word-aligned via faster-whisper, then burned in as karaoke captions (white base + light-blue active word).

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
- Examples: `/create-podcast podcast/input/neymar/neymar.txt input2.m4a`, `/create-podcast podcast/input/x/x.txt C:/music/track.mp3`

**Default input folder (as of 2026-05-23):** new podcast inputs live under `podcast/input/<slug>/`. Motion-graphic football content lives under `video/input/<slug>/` (that's `/create-video`'s territory). Legacy folders directly under `input/<slug>/` are still accepted — the skill resolves any path the user passes.

**Sibling video(s) — required, same dir as .txt.** One or more files named `<slug>.<ext>` (`<ext>` ∈ {mp4, mov, webm, mkv, m4v}). When the script's TTS runs longer than the first video, the next-numbered file is appended in order; the entire chain loops if needed. Numbering is natural-sorted so `<slug>10.mp4` comes after `<slug>2.mp4`.

Example layout:

```
podcast/input/neymar/
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
| `PODCAST_CAPTION_FONTSIZE` | card layout — sentence: `52` / word: `64` / chunks: `60`. vignette: caption module default | Caption font size in 1080×1920 px units. Card layout uses smaller defaults because the wordmark + edge-to-edge card already fill a lot of visual real estate |
| `PODCAST_CAPTION_MAX_WORDS` | `8` | Hard cap on the number of words shown in a single caption (sentence + reveal modes). The grouper pre-flushes before adding a word that would exceed this, so caption events are guaranteed to fit on one line — prevents multi-line wrap that would stack/overlap with libass's default leading. Combined with `MAX_CHARS`, whichever hits first triggers the split. Lower for snappier pacing, raise (and bump font size down) for denser captions |
| `PODCAST_CAPTION_MAX_CHARS` | `30` | Hard cap on the character count of a single caption (sentence + reveal modes). 30 chars is the safe single-line budget at Segoe UI / Cambria Bold ≥52px with 80px side margins (920px usable). Lower if your fontSize is bigger than the default; raise if you shrink it |
| `PODCAST_CAPTION_MAX_CHARS_CHUNKS` | `22` | Same as above but for the `chunks` caption mode (which targets 2-4 word chunks). 22 chars covers the typical 2-4 word VN chunk at fontSize 56-60; lower it if you raise the font |
| `PODCAST_CAPTION_Y` | (auto) | Vertical position of caption as fraction of canvas height. **For card layout this is auto-anchored 80 px below the card OUTLINE bottom** so there's a clear breathing gap between the white stroke and the caption. Override with a fraction (e.g. `0.65` = y=1248, `0.50` = mid-frame) |
| `PODCAST_LAYOUT_MODE` | `auto` | Source orientation override — wins over `PODCAST_LAYOUT` whenever the source is (or should be) landscape. **`auto`** (default) ffprobes the first sibling video: `width > height` ⇒ landscape layout, else portrait. **`landscape`** forces landscape regardless of source aspect. **`portrait`** forces portrait. Use the explicit override when the auto-detection mis-classifies a video (e.g. portrait content stored inside a 1280×720 letterboxed container) |
| `PODCAST_LAYOUT` | `card` | Portrait-source layout preset (ignored when source is landscape — that always uses the dedicated `landscape` layout). **`card`** (default) — solid black canvas + 880×880 rounded card centered + thin white outline + centered wordmark above. Best when source footage is topic-relevant (football clips). **`vignette`** — legacy viral aesthetic: blurred-source bg + sharp card + search bar + progress bar + watermark. **`fullbleed`** — aesthetic-bg mode: source footage fills the entire 1080×1920 canvas (cover crop) with optional dim overlay, NO card, NO chrome. Wordmark sits free-floating at top, karaoke captions overlay as lower-third. Use fullbleed when the source is high-quality scenery / street / ambient footage where the image quality IS the draw. **Landscape layout** (auto-selected for 16:9 sources): solid black canvas, 16:9 strip scaled to width=1080 centered vertically (small upward bias), Palatino italic "Podcast và bạn" corner text top-left, karaoke captions burned INSIDE the strip's lower portion with 80 px safe margins — no card chrome |
| `PODCAST_LANDSCAPE_VBIAS` | `-80` | Landscape only — vertical offset (px) of the 16:9 strip from canvas center. Negative pushes the strip upward to leave more room below; positive pushes down. Default `-80` biases the strip slightly above center so captions sit comfortably in its lower portion |
| `PODCAST_CAPTION_SAFE_MARGIN` | `80` | Landscape + fullbleed only — horizontal safe margin (px) from canvas edges. Captions never bleed past this margin no matter how long the line is (long lines wrap via WrapStyle 0) |
| `PODCAST_FULLBLEED_DIM` | `0` | **Fullbleed only.** Opacity (0..1) of the black dim overlay over the scenery footage. Default `0` = no dim (source plays at full brightness — max quality). Raise to `0.28` for the legacy dim look (better caption legibility on very bright scenery); `0.4` is heavy dim |
| `PODCAST_CORNER_RADIUS` | `40` | Foreground corner radius in px. `0` = sharp corners, `80+` = very rounded card look. **Ignored when `PODCAST_LAYOUT=fullbleed`** (no card to round) |
| `PODCAST_CARD_STROKE` | `4` | Width (px) of a thin white outline drawn around the card so the rounded corners read against the pure-black canvas (black-on-black would hide the curve). `0` = no outline. Only drawn when `PODCAST_CORNER_RADIUS > 0` |
| `PODCAST_FG_WIDTH` | `880` | Foreground card width (px) on the 1080×1920 canvas. Default `880` pairs with height `880` for a 1:1 square card with ~92px gap on left + right between the outline and the canvas edges. The source video is scaled to cover the box (default `cover` fit). `1080` = card width = full canvas (outline cropped off). Bump to ~1064 for the "edge-to-edge" look |
| `PODCAST_FG_HEIGHT` | `880` | Foreground card height (px). Default `880` paired with width `880` = 1:1 square |
| `PODCAST_FG_Y` | `520` | Top Y position of the foreground card (px from the top of the canvas). Default `520` centers the 880×880 card vertically on the 1080×1920 canvas with equal black space above + below. `0` flush-top, larger values push down |
| `PODCAST_FG_X` | (auto-centered) | Left X position (px). Omit → card horizontally centered: `x=(1080-width)/2`. Set explicitly to anchor left/right (e.g. `0` flush-left) |
| `PODCAST_FG_MARGIN` | (unset) | **Legacy** — when any of `PODCAST_FG_WIDTH/HEIGHT/Y/X` is set, this is ignored. When set alone, it sizes the card as `(1080-2M) × (1920-2M)` anchored at `(M,M)` — i.e. equal-margin black border on all sides, the older "near-full-canvas card" look |
| `PODCAST_LOGO` | (auto) | Path to a PNG logo overlaid **top-left** (matches `/create-video` brand-shell). Auto-uses `assets/logoPodcast.png` if present. Set to empty string to disable |
| `PODCAST_LOGO_WIDTH` | `120` | Logo target width in px (height preserved by aspect ratio) |
| `PODCAST_LOGO_MARGIN` | `60` | Margin (px) from the top + left edges |
| `PODCAST_BRAND_NAME` | `TIKTOK_DISPLAY_NAME` or `SportsForAllPodcast` | Brand text rendered as the main wordmark (or beside the logo in legacy mode). Empty string disables |
| `PODCAST_BRAND_TAG` | `PODCAST` | Tag below the wordmark (or below brand name in legacy mode), cyan #22D3EE, uppercased + letter-spaced automatically. Empty string disables |
| `PODCAST_BRAND_WORDMARK` | `true` (card layout) | When true, renders the new **centered wordmark** above the card outline instead of the legacy top-left `logo + brand-text` shell. Wordmark = "SportsForAllPodcast" in Segoe UI Black with a purple #A855F7 halo + a 320×6 px purple→cyan gradient underline + a letter-spaced cyan tag below. Set `false` to fall back to the legacy look (logo PNG top-left + side-by-side text) |
| `PODCAST_WORDMARK_FONTSIZE` | `62` | Main wordmark font size in px (Segoe UI Black) |
| `PODCAST_WORDMARK_TAG_FONTSIZE` | `28` | Tag-line font size below the underline |
| `PODCAST_WORDMARK_UNDERLINE_W` | `320` | Gradient-underline width in px (purple → cyan). Underline height is fixed at 6 px |
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
| `PODCAST_CRF` | `18` | x264 quality, lower = better. Default `18` = near-visually-lossless. Raise to `20` for ~half the file size (still high quality); raise to `23` for "good-enough" web quality |
| `PODCAST_PRESET` | `slow` | x264 preset. Default `slow` = best compression at the chosen CRF (~2× render time). Switch to `medium` for faster renders or `fast`/`veryfast` to halve render time at the cost of bigger files |

## Common failure modes

- **"No sibling video found"** — the .txt exists but no `<slug>.{mp4,...}` (or numbered variant) next to it. Ask user to put at least one video there.
- **"Unsafe file name"** / concat demuxer mismatch — siblings have different resolutions or codecs. Re-encode them to a common format first.
- **"Background music file not found"** — the 2nd CLI arg or `PODCAST_BG_MUSIC` env points to a file that doesn't exist (after `assets/beat/` resolution).
- **"faster-whisper not installed"** — run the one-time install above.
- **"VieNeu project dir not found"** — see existing `/create-video` skill setup; this skill shares the same TTS infrastructure.
- **Audio + caption misaligned** — try `PODCAST_ALIGN_MODEL=medium`. Vietnamese diacritics occasionally trip `small` on phrases with rapid stress changes.

## Boundary with `/create-video`

This skill does NOT classify content or impose scene/density rules. The .txt is treated as plain prose — the user owns pacing and structure. If they want the channel's motion-graphic look instead, route them to `/create-video`.
