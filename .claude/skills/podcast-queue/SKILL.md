---
name: podcast-queue
description: Batch-process podcast rows from podcast/input/queue.xlsx. Reads the Excel queue, picks a random video (or videos) from a tone-matched concept folder (any directory directly under `podcast/input/` like `football/`, `naruto/`, `world/` — whatever the user creates) per the row's concept column, runs the podcast pipeline, and writes back the status (Done | Error) + result path. Use when the user wants to run pending rows. Slash command: /podcast-queue.
---

# Podcast Queue Skill

Batch-runs podcast generation from an Excel queue. The user just writes `.txt` scripts under `podcast/input/story/` and pastes the path into a row in `podcast/input/queue.xlsx` — this skill does everything else.

## Folder layout

```
podcast/
├── input/                ← user-supplied data (concept folders + queue + scripts)
│   ├── <concept-1>/      ← e.g. football/, naruto/, world/, neymar/, deep/, … — any folder name
│   │   └── *.mp4         ← flat: just put videos here
│   ├── <concept-2>/      ← create as many concept folders as you want
│   │   └── *.mp4
│   ├── …
│   ├── story/            ← RESERVED — podcast script .txt files (user writes these)
│   └── queue.xlsx        ← the queue itself
├── _runs/                ← per-row workdirs (staged .txt + linked videos) — pipeline-managed, not user-edited
└── output/               ← finished podcast clips (pipeline writes here)
    └── <slug>/<slug>.mp4
```

**Concept = folder name (flat model, 2026-05-25).** Each folder directly under `podcast/input/` is a concept; the folder NAME is the concept name. The user decides what concepts exist by creating folders — there's no fixed list. Examples:

| User wants… | Creates folder | Concept value |
|---|---|---|
| Generic football clips | `podcast/input/football/` | `football` |
| Neymar-specific clips | `podcast/input/neymar/` | `neymar` |
| Naruto clips | `podcast/input/naruto/` | `naruto` |
| Moody / introspective | `podcast/input/deep/` | `deep` |
| Scenery / city / culture | `podcast/input/world/` | `world` |

Each concept folder is walked flat — **no nesting**. The previous `football/<player>` / `anime/<series>` subfolder model was scrapped in favor of this simpler one-level layout.

**Tone matching still matters.** A sad / reflective script should NOT pull from `world` (cheerful landscapes). The user enforces tone manually by choosing the right concept value per row.

## Excel schema

| Column | Required | Purpose |
|---|---|---|
| `story` | YES (input) | Path to the .txt under `podcast/input/story/`. Can be repo-relative (`podcast/input/story/foo.txt`) or absolute. |
| `concept` | optional (input) | Any folder name directly under `podcast/input/` (e.g. `football`, `naruto`, `world`, `neymar` — whatever folders the user created), OR empty/`random` for a uniform random pick across non-empty concept folders. Forces ONE concept per row (never mixed). Legacy nested syntax (`football/neymar`, `anime/naruto`) → row Error with migration hint: flatten to a single folder name. Legacy `views` / `nature` → row Error with migration hint. |
| `orientation` | optional (input) | `landscape` / `portrait` / empty/`auto`. When set, the picker filters the library to only matching videos AND forces the pipeline into that layout regardless of ffprobe auto-detect. Use when your library has BOTH 9:16 and 16:9 in `views/` or `football/` and you want a specific look. Empty = let pipeline auto-detect from whatever was randomly picked. |
| `videos` | optional (input + output) | **Output by default** — the script fills picked video paths joined by `;`. **Manual override:** when filled BEFORE running, treated as an explicit playlist (split by `;` / `,` / newline). The random picker is skipped, `concept` is ignored, orientation column still controls layout. Use for re-running a row with the same videos or hand-curating a specific clip combo. To force a fresh random pick on retry, clear BOTH `status` AND `videos`. |
| `status` | NO (output) | `Done` or `Error`. Empty status = pending; the script processes pending rows only. |
| `result` | NO (output) | On Done: path to the final mp4 (`podcast/output/<slug>/<slug>.mp4`). On Error: a short message. |

### Orientation behavior

| `orientation` value | Picker behavior | Pipeline layout |
|---|---|---|
| empty / `auto` | Pick any video (random), no orientation filter | ffprobe-detect from picked video's W×H |
| `landscape` / `16:9` / `horizontal` | Skip portrait videos in the library, only pick 16:9 footage | Force `landscape` mode (16:9 strip on black 9:16 canvas, captions in strip bottom) |
| `portrait` / `9:16` / `vertical` | Skip landscape videos, only pick 9:16 footage | Force portrait layout (card / vignette / fullbleed per `PODCAST_LAYOUT`) |

If the picker can't find any matching-orientation video in the concept folder, the row is marked Error.

A row is **pending** when `story` is set AND `status` is empty. Once the script processes a row, it writes a status (Done / Error) so subsequent runs skip it. To rerun, clear the `status` cell.

## Workflow

### Step 1: Validate

- Confirm `podcast/input/queue.xlsx` exists. If not, suggest running `npm run podcast-queue` once — that creates the empty template.
- If user mentions specific rows to process, note them, but the script just runs all pending rows top-to-bottom.

### Step 2: Run the script

```bash
npm run podcast-queue
```

Behind the scenes the script:

1. Loads the workbook.
2. For each row where `story` is set and `status` is empty:
   - Resolves the .txt path (repo-relative or absolute).
   - Derives `slug` from the .txt basename (e.g. `pep-tribute.txt` → `pep-tribute`).
   - Parses `orientation` from the column (landscape / portrait / blank=auto).
   - Estimates TTS duration as `chars / 12 sec` (conservative; Vietnamese TTS reads ~12-15 chars/sec).
   - **If `videos` column has content → manual mode:** parses paths (split by `;` / `,` / newline), validates each exists with a supported extension, probes for duration (warns if total < TTS estimate — the compose step loops automatically). Concept + orientation filter are skipped (user explicitly chose).
   - **Otherwise → random pick:** parses the `concept` column. The folder name IS the concept; the picker reads `podcast/input/<concept>/` flat (no recursion). Empty/`random` picks uniformly across every concept folder that has ≥1 video. Then lists `.mp4 / .mov / .webm / .mkv / .m4v` files, shuffles, and probes each via ffprobe — picking up to 3 videos until cumulative duration ≥ TTS estimate × 1.1. When `orientation` is set, skips any video whose probed W:H doesn't match.
   - **No-repeat across rows (batch-scoped):** every video used by an earlier row in the SAME `npm run podcast-queue` invocation (manual OR auto-picked) is excluded from later rows' shuffles. So 5 stories in one batch will pick 5 disjoint video sets as long as the library is large enough. The tracker resets every fresh invocation — running again tomorrow starts from a clean slate. When the unused pool is exhausted (e.g. batch needs 15 picks but library has 10), the picker logs `no-repeat pool cạn — cho phép re-use` and falls back to allowing repeats so the batch can still finish.
   - Materializes a workdir at `podcast/_runs/<slug>/` with the .txt copied as `<slug>.txt` and each picked video hardlinked (or copied if hardlink fails) as `<slug>.mp4`, `<slug>2.mp4`, `<slug>3.mp4`.
   - Spawns `npm run podcast -- <workdir>/<slug>.txt` with `PODCAST_LAYOUT_MODE=<orientation>` injected when the column was set (so the pipeline picks landscape layout even if the picked video's probe is ambiguous).
   - Verifies the output at `podcast/output/<slug>/<slug>.mp4`.
   - Writes back: `videos` (paths joined by `;`), `status` (Done | Error), `result` (output path or error message).
   - **Saves the workbook after EACH row** so a crash mid-batch preserves progress.

### Step 3: Report

After the run completes, summarize:

```
Đã xử lý X row pending. Y thành công, Z lỗi.
Done: <list result paths>
Error rows: <row#> — <message>
```

Don't list every successful row's paths if there are many — top 3 is enough plus the totals.

## Edge cases

| Situation | Action |
|---|---|
| `podcast/input/queue.xlsx` doesn't exist | Script auto-creates an empty template. User adds rows + reruns. |
| `story` cell empty in a data row | Skipped (treated as not-pending) |
| `story` path doesn't exist | Row marked Error: `story không tồn tại: <path>` |
| `concept` folder empty (no videos) | Row marked Error: `Không có video … trong <folder>` |
| `concept=<name>` folder doesn't exist | Row marked Error with hint to create `podcast/input/<name>/` + list of folders that do exist |
| `concept=<a>/<b>` (legacy nested syntax) | Row marked Error with hint: flatten to a single folder name (vd `naruto` thay vì `anime/naruto`) |
| `concept=views` / `concept=nature` (legacy) | Row marked Error with migration hint |
| `concept=story` (reserved name) | Row marked Error: `story` is reserved for the .txt scripts folder, not a concept |
| `concept` empty AND every concept folder is empty | Row marked Error: `không có concept folder nào trong podcast/input/ có video` |
| ffprobe fails on a video | That file is skipped, next shuffled video is tried |
| Pipeline returns non-zero exit | Per `feedback_podcast_ffmpeg_exit69_benign.md`: trust the output-file-exists check, not the exit code |
| Output file missing after pipeline | Row marked Error: `pipeline xong nhưng không thấy <path>` |
| User reruns to retry an Error row | They clear the `status` cell → row becomes pending again |

## Relationship to other skills

```
user writes .txt in podcast/input/story/
       │
       ├─ pastes path into queue.xlsx (story column)
       │
       └─/podcast-queue──► npm run podcast-queue
                                  │
                                  ├─ pick concept + videos
                                  ├─ materialize podcast/_runs/<slug>/
                                  └─ run npm run podcast ──► podcast/output/<slug>/<slug>.mp4
                                                                          │
                                                                          └─ write back to queue.xlsx
```

The `/create-podcast` skill is still available for one-off runs (give it a path to a folder with `.txt` + sibling videos already staged). This skill is for the batch / library-driven workflow.
