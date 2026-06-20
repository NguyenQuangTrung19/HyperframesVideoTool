---
name: video-queue
description: Batch-process motion-graphic video rows from `video/input/queue.xlsx`. Two-pass pipeline — Pass 1 runs /refine-txt (if requested) + /images-for-videos for every pending row and halts at the manual-image-gen step; user opens grok.com to generate images per part folder; Pass 2 renders /create-video for every row whose images are now ready (multi-part-aware — auto-split sources fan out into <slug>-p1, -p2, … renders, all collapsed into a single row's result). Use when the user wants to prep + render multiple motion-graphic videos through one Excel sheet instead of running /create-video manually per source.
---

# Video Queue Skill

Batch driver for motion-graphic videos. Mirrors `/podcast-queue` (Excel-driven, status tracked per row) but for the `/create-video` pipeline.

## Why two-pass

Motion-graphic videos have a **manual image-generation bottleneck** in the middle of the pipeline — the user gens images on grok.com themselves, the queue cannot do it. So the workflow splits in two:

1. **Pass 1 (prep):** /refine-txt (if requested) → /images-for-videos. Auto-split decides single-video vs N parts. Status moves `pending` → `planned`. Skill halts and prints every folder the user must gen images for.
2. **User manual:** open anh-can-tao.md in each folder (the VN checklist of what images to make; full English prompts are in images-plan.json), gen images in parallel tabs, save them under the filenames the plan declared.
3. **Pass 2 (render):** for every `planned` row, verify images are now in place, then run /create-video per part. Multi-part renders fan out — the row's `result` column collects all part mp4 paths joined by `; `. Status moves `planned` → `done`.

Re-running `/video-queue` does Pass 1 on still-pending rows AND Pass 2 on still-planned rows in a single invocation. The split into "passes" is conceptual — for the user it looks like "run the skill, gen images, run again."

## When to use

- User has 2+ video sources to render in a session.
- User wants a worksheet to track which sources are at which stage.

Single-source runs don't need this skill — just call `/images-for-videos` + `/create-video` directly.

## xlsx schema

File: `video/input/queue.xlsx` (auto-created on first run by the helper script).

| Column | Required | Purpose |
|---|---|---|
| `source` | YES | Path to base .txt source (`video/input/<slug>/<slug>.txt`) OR a URL (starts with `http://` or `https://`). NOT a part .txt — the queue fans out parts itself. |
| `refine` | optional | `yes` / `no` / empty (=no). If `yes`, queue runs /refine-txt before planning |
| `title` | optional | Title override. Empty = derive from .txt title line |
| `notes` | optional | Free-text user notes. Queue ignores — for user organization |
| `status` | output | `pending` (empty) / `planned` / `done` / `error` |
| `result` | output | Per-part mp4 paths joined by `; ` (multi-part) or single mp4 path |
| `error` | output | Error message when status = `error` |

A "pending row" = `source` set + `status` empty or = `pending`.
A "planned row" = `status` = `planned`. Has been refined + planned; waiting for images.
A "done row" = `status` = `done`. All renders complete.

## Helper

The skill talks to the xlsx via a thin helper at `scripts/video-queue.ts` (also exposed as `npm run video-queue`):

```bash
npm run video-queue --silent -- list
# → prints JSON: [{rowIdx, source, refine, title, notes, status, result, error}, ...]
#   rowIdx is the 1-based Excel row number (header is row 1, so first data row is rowIdx=2)

npm run video-queue --silent -- set <rowIdx> <key>=<value> [<key>=<value> ...]
# → writes status / result / error fields. Only those 3 keys are writable.
# → status legal values: pending, planned, done, error
```

Use `--silent` (npm) so npm doesn't prepend its banner to the JSON output. Always pass `--` before `list`/`set` so npm forwards the args to the script.

## Workflow

### Step 1: Read the queue

```bash
npm run video-queue --silent -- list
```

Parse the JSON output. Each row has:
- `rowIdx` — Excel row number, use this in `set` calls
- `source` — path to base .txt
- `refine` — `"yes"` / `"no"` / `""`
- `title` — override or empty
- `status` — `""` / `"pending"` / `"planned"` / `"done"` / `"error"`
- `result`, `error` — current output / failure message

If the helper printed `(created empty template at ...)` on stderr, the queue file didn't exist before — tell the user the template is ready and to add rows, then exit.

If no rows at all → tell the user to add rows at `video/input/queue.xlsx`, exit.

### Step 2: Classify each row's next action

For every row (in `rowIdx` ascending order):

| Current status | Next action |
|---|---|
| `""` or `"pending"` | **Pass 1** — run /refine-txt (if `refine=yes`) then /images-for-videos. Transition to `planned`. |
| `"planned"` | **Pass 2** — check if all planned images exist. If yes → render. If no → leave as `planned` and remind user which folders still need images. |
| `"done"` | Skip. |
| `"error"` | Skip by default. (User clears `status` + `error` manually to retry.) |

Process Pass-1 rows first, then Pass-2 rows. This keeps the user-facing log organized.

### Step 3: Pass 1 — refine + plan

For each row with status pending:

1. **Detect source kind:**
   - If `source` starts with `http://` or `https://` → **URL source**.
   - Otherwise → **file source** (`.txt` path).
2. **URL branch — invoke `/read-rewrite <url>`:**
   - The skill fetches the article, rewrites it into a channel-voice `.txt` at `video/input/<derived-slug>/<derived-slug>.txt`, and chains into `/images-for-videos` (which auto-splits if the rewritten text is ≥ 4 000 chars).
   - After /read-rewrite completes, the effective source path becomes the new `.txt` file. Optionally update the row's `source` column to that path so future runs see the file (use `set <rowIdx> source=<new-path>`).
   - Skip the `refine=yes` step for URL sources — /read-rewrite already produces channel-voice text.
3. **File branch — validate `source` exists.** If file is missing → `set <rowIdx> status=error error="source not found: <path>"` and continue to next row.
4. **If `refine=yes` (file branch only):** invoke the `/refine-txt` skill on the source. The skill polishes in place + creates `<slug>.raw.txt` backup.
5. **Invoke `/images-for-videos`** on the source (skip if already chained by /read-rewrite in step 2). The skill auto-detects long sources (≥ 4 000 chars) and splits them into `<slug>-p1/`, `<slug>-p2/`, … each with its own .txt + images-plan.json + anh-can-tao.md.
6. **If `title` is non-empty:** record the override for Pass 2 (the part .txt files don't carry queue-row metadata — keep a local in-memory map of `rowIdx → title override` for use when /create-video runs).
7. **Update row:** `set <rowIdx> status=planned`. Leave `result` and `error` empty.
8. **Log to user:** "Row 3: planned, gen ảnh tại video/input/<slug>-p1/, <slug>-p2/, <slug>-p3/" (list all part folders that need images, or the base folder if single-video).

If any skill errored (e.g. /read-rewrite cannot fetch URL, /images-for-videos bails on < 3 distinct points), capture the error and `set <rowIdx> status=error error=<message>`.

### Step 4: Pass 2 — render

For each row with status planned:

1. **Discover part folders** for this source:
   - Resolve `<base-slug>` from `source` path's parent folder.
   - List sibling folders in `video/input/` matching `<base-slug>-p<N>/` (N = positive integer). Sort by N ascending.
   - If any `-p<N>/` folders found → multi-part render: parts = the list of folders.
   - Else → single-video render: part = the base folder containing `source`.
2. **For each part folder, verify image readiness:**
   - Read its `images-plan.json`.
   - For each `scene.filename`, check whether a file with that stem exists in the folder under any of `.png` / `.jpg` / `.jpeg` / `.webp`. (The downstream `npm run images:stage` does the actual extension resolution; the skill just confirms presence.)
   - Collect missing filenames per part.
3. **If any part is missing images:**
   - Leave status as `planned`.
   - Log: "Row 3 còn thiếu ảnh: <slug>-p2/cb-3.jpg, <slug>-p3/hook.jpg. Gen xong rồi chạy lại /video-queue."
   - Skip to next row. Do NOT set status=error — `planned` is the correct waiting state.
4. **All parts have images → render each:**
   - For each part folder, in order p1 → p2 → … → pN:
     - Invoke `/create-video <part-folder>/<part-folder-basename>.txt`.
     - The /create-video skill auto-detects part context (folder name ends `-p<N>` + sibling `-p<N+1>/` existence) and uses the multi-part outro for non-final parts, standard engagement+outro for the final part.
     - Capture the output mp4 path (`video/output/<part-folder-basename>/video.mp4` for plan mode, or the timestamped folder for free-form).
   - If any part render fails, capture the part's error.
5. **Update row after all parts render:**
   - All succeeded → `set <rowIdx> status=done result="<path1>; <path2>; ..."` (paths joined by `; `, in part order).
   - Some failed → `set <rowIdx> status=error result="<paths-that-succeeded>" error="part 2 fail: <msg>"`. User can fix + clear status to retry.

### Step 5: Summary

After processing all rows, print a short summary:

```
Pass 1 (planned): 3 rows
  • row 2: video/input/modric-bio-p1, -p2, -p3 (3 parts)
  • row 4: video/input/top5-trivia (single)
  • row 5: video/input/messi-vs-ronaldo (single)

Pass 2 (rendered): 1 row
  • row 3: video/output/pep-vs-arteta-p1/video.mp4 (1 part)

Còn lại 4 row ở trạng thái `planned` — gen ảnh xong rồi chạy /video-queue lần nữa để render.
```

If a row was skipped because of an error, list it under a separate "Errors" header with the error message.

## Idempotency + crash safety

- The helper writes the xlsx atomically after every `set` call → mid-run crashes don't corrupt the queue.
- Re-running `/video-queue` is always safe: pending stays pending until it advances, planned stays planned until all images land + render succeeds, done stays done.
- To force re-render of a `done` row: clear `status` (set it to empty string via `set <rowIdx> status=""`) — the helper accepts empty status as `pending`.
- To force re-plan (re-run Pass 1): manually delete the `<slug>-pN/` part folders (or the single-video plan file), clear status, run again. (Don't delete the source `.txt` — that's the queue's input.)

## When NOT to use

- Single source — just run `/images-for-videos` + `/create-video` directly, faster and less ceremony.
- Podcast / music-video / bio with real-footage content → those have their own pipelines (`/podcast-queue` for batch podcast; `/create-music-video` for single music clips).

## Example session

```
User: /video-queue

Skill:
✓ Đọc queue (3 row pending)
[Pass 1]
Row 2 (modric-bio, refine=yes):
  → /refine-txt: polished in-place, .raw.txt backed up
  → /images-for-videos: source 9 240 chars → split 3 phần
  → status=planned, gen ảnh tại:
    • video/input/modric-bio-p1/  (7 ảnh — xem anh-can-tao.md)
    • video/input/modric-bio-p2/  (8 ảnh)
    • video/input/modric-bio-p3/  (7 ảnh)
Row 3 (top10-trivia, refine=no):
  → /images-for-videos: source 3 100 chars → single plan, 8 ảnh
  → status=planned, gen ảnh tại video/input/top10-trivia/
Row 4 (messi-vs-ronaldo): same as row 3, single plan.

User opens grok.com, gens all images per folder, saves them in.

User: /video-queue

Skill:
✓ Đọc queue (3 row planned)
[Pass 2]
Row 2 (modric-bio, 3 parts):
  → /create-video p1 (non-final): video/output/modric-bio-p1/video.mp4
  → /create-video p2 (non-final): video/output/modric-bio-p2/video.mp4
  → /create-video p3 (final): video/output/modric-bio-p3/video.mp4
  → status=done, result="video/output/modric-bio-p1/video.mp4; ...; .../modric-bio-p3/video.mp4"
Row 3 (top10-trivia, single):
  → /create-video: video/output/top10-trivia/video.mp4
  → status=done
Row 4 (messi-vs-ronaldo): còn thiếu hook.jpg → vẫn planned. Gen xong rồi /video-queue lại.

Summary:
  Done: 2 row (4 mp4 đã render)
  Planned (chờ ảnh): 1 row
```
