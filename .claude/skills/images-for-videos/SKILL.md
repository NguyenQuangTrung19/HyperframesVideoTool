---
name: images-for-videos
description: Plan the images a football video will need, BEFORE the script is written. Reads a .txt source, classifies content type, decides which scenes need a custom image, writes a high-quality English prompt for each, and emits images-plan.json next to the .txt. The user generates each image manually (typically on grok.com), saves it under the planned filename, then runs /create-analysis-video to assemble the video — the planned images are staged into output/ automatically and the AI image API is bypassed.
---

# Images-for-Videos Skill

Visual-first workflow for football videos. The user wants control over hero visuals — they generate every image themselves on grok.com using their SuperGrok / X Premium chat subscription — but they want the prompts and naming worked out by Claude so they can batch-generate in one sitting.

## When to use

User runs `/images-for-videos <path-to-source.txt>` BEFORE running `/create-analysis-video` (or `/create-news-video`). Examples:

- `/images-for-videos input/topCBsITW/topCBsITW.txt`
- `/images-for-videos input/messi-vs-ronaldo/source.txt`

If the user runs `/create-analysis-video` first without a plan, that skill will work in fallback mode (Gemini API generates images) — the plan step is optional but recommended for content where image quality matters (rankings of named players, history pieces, VS comparisons of specific people).

## Input contract

- Single argument: a path to a `.txt` file.
- The directory containing the txt is the **input folder** — the plan and all images live there.
- Recommended layout: `input/<slug>/<slug>.txt`, e.g. `input/topCBsITW/topCBsITW.txt`. With this layout, `<slug>` is derived from the parent folder name. Flat layouts (`input/foo.txt`) also work — slug becomes the file stem.

## Workflow (MUST follow these steps in order)

### Step 1: Read the source file

`Read` the .txt completely. Don't truncate — content type detection depends on full structure.

### Step 2: Classify content

Invoke the [`classify-football-content`](../classify-football-content/SKILL.md) skill on the source. Get:
- **type** (RANKING / VS / MATCH ANALYSIS / PRE-MATCH PREVIEW / PLAYER PROFILE / HISTORY-CAREER / TRANSFER NEWS / TRIVIA)
- **proposed scene structure** (count + template sequence)

This is the single source of truth for "what scenes this video will have". The image plan derives directly from it.

### Step 3: Determine image-eligible scenes

Only these templates take a custom image:
- `hook` — opening hero shot
- `stat-hero` — full-bleed background under one big stat
- `callout` — atmospheric background under a quote/claim

These templates do NOT take images (skip them in the plan):
- `comparison` — left/right cards on solid color
- `feature-list` — bulleted list, no photo
- `outro` — TikTok profile card

For each content type, the typical image set is:

| Content type | Typical image-eligible scenes |
|---|---|
| RANKING (Top N) | `hook` + N × `stat-hero` (one per item) |
| VS comparison | `hook` + 2 × `stat-hero` (one per side) + 0–1 `callout` |
| MATCH ANALYSIS | `hook` + 2–4 × `callout`/`stat-hero` for key moments |
| PLAYER PROFILE | `hook` + 3–5 × `stat-hero`/`callout` |
| HISTORY-CAREER | `hook` + 4–6 × `callout`/`stat-hero` (key chapters) |
| TRANSFER NEWS | `hook` + 1–2 × `stat-hero` (player + fee context) |
| TRIVIA | `hook` + N × `callout` (one per fact) |

### Step 4: Assign sceneIds + filenames

Pick stable, lowercase, hyphen-separated IDs that match the content shape. The id and filename stem MUST match — `id: "cb-1"` ↔ `filename: "cb-1.png"`.

Convention by content type:

| Content type | sceneId pattern | Example IDs |
|---|---|---|
| RANKING (Top N) | `hook` + `<topic>-1` ... `<topic>-N` | `hook`, `cb-1`, `cb-2`, ..., `cb-7` |
| VS | `hook`, `<sideA>`, `<sideB>` | `hook`, `messi`, `ronaldo` |
| MATCH ANALYSIS | `hook`, `moment-1`, `moment-2`, ... | `hook`, `moment-1`, `moment-2`, `tactic-shift` |
| PLAYER PROFILE | `hook`, `chapter-1`, ... | `hook`, `early-years`, `breakout`, `peak`, `legacy` |

Use the `<topic>` prefix that's natural for the content. For "Top 7 Trung vệ" → `cb-1` to `cb-7`. For "Top 10 vua phá lưới" → `striker-1` to `striker-10` (or `rank-1` to `rank-10` if more generic). Pick whatever the user is likely to recognize at a glance.

Default filename extension: `.png`. The pipeline accepts `.png` / `.jpg` / `.jpeg` / `.webp` — the user may save under any of these and the staging step handles it.

### Step 5: Write a prompt for each scene

Prompt rules — same as the imagePrompt rules in `/create-analysis-video`, slightly expanded because Grok has more capacity than Gemini:

- **Language: English.** Grok handles English prompts much better than Vietnamese.
- **Style:** sports photography, cinematic, photo-realistic, dramatic lighting.
- **Always include:** `"vertical 9:16 portrait composition"` (Grok respects aspect cues).
- **Length:** 50–120 words. Longer prompts give Grok room to nail details.
- **Player likeness:** for named players, describe physical traits + kit color rather than naming the club crest. e.g. for Van Dijk: `"a tall imposing Dutch centre-back with short dark hair and a beard, in a red kit, defending in the air against a forward in white"`. Avoid asking Grok to render specific logos or text — your captions cover those.
- **Variety:** don't make every CB a "celebrating goal" shot. Mix: defending, leading the line, in the tunnel, lifting a trophy, post-match shirt-swap, etc. Variety keeps the video visually interesting.
- **No text/scoreboards/UI in image:** captions/stats render on top of the image, so the image must be a clean background.

`subjectHint` field (Vietnamese OK): a one-line note for the user about who/what this image is, e.g. `"Virgil van Dijk — Liverpool"`. Helps the user remember which prompt is for which item without re-reading the English prompt.

### Step 6: Detect orphans from a previous plan

If `images-plan.json` already exists at the target path:
1. Read the existing plan.
2. Compare its filenames to the new plan's filenames.
3. Any filename in the OLD plan but not in the NEW plan → list as "orphan" (user should delete from input folder after re-running, since they won't be used).

### Step 7: Write images-plan.json

Schema (validated by `src/image/plan-schema.ts`):

```json
{
  "version": "1.0",
  "source": "topCBsITW.txt",
  "contentType": "RANKING",
  "title": "Top 7 Trung vệ xuất sắc nhất thế giới 2026",
  "createdAt": "2026-05-06T14:30:00.000Z",
  "scenes": [
    {
      "id": "hook",
      "template": "hook",
      "filename": "hook.png",
      "subjectHint": "Tổng hợp atmosphere — không gian sân bóng đêm",
      "prompt": "Wide low-angle vertical 9:16 portrait sports photograph of a packed European football stadium at night under bright floodlights, dramatic fog rolling across the pitch, blurred crowd in the stands, cinematic photo-realistic atmosphere, dark moody color grading."
    },
    {
      "id": "cb-1",
      "template": "stat-hero",
      "filename": "cb-1.png",
      "subjectHint": "Virgil van Dijk — Liverpool",
      "prompt": "Cinematic vertical 9:16 portrait sports photograph of a tall imposing Dutch centre-back with short dark hair and a full beard, wearing a bright red Premier League home kit, standing tall in defensive header pose mid-air against an attacker in white, packed stadium under floodlights blurred in the background, dramatic lighting, photo-realistic."
    }
  ]
}
```

Use the `Write` tool to save to the same directory as the source .txt (filename: `images-plan.json`).

### Step 8: Print summary to the user

Format the output as a copy-paste-friendly checklist. Vietnamese is fine for the surrounding text; the prompts themselves stay English.

```
✓ Plan saved: input/<slug>/images-plan.json
  Content: <type> — <title>
  <N> ảnh cần tạo trên grok.com:

[1] hook  (template: hook)
    Save as: input/<slug>/hook.png
    Subject: <subjectHint>
    Prompt:
    ─────
    <full prompt>
    ─────

[2] cb-1  (template: stat-hero)
    Save as: input/<slug>/cb-1.png
    Subject: <subjectHint>
    Prompt:
    ─────
    <full prompt>
    ─────

... (one block per scene) ...

⚠ Orphan files (xóa sau khi tạo plan mới):  ← only if any
  • old-cb-8.png

Tiếp theo:
  1. Mở grok.com, paste từng prompt, tạo ảnh 9:16, tải về.
  2. Save mỗi ảnh vào path 'Save as' phía trên (đặt đúng tên file).
  3. Chạy /create-analysis-video input/<slug>/<slug>.txt → script + video.
```

## What this skill does NOT do

- Does not generate images itself — you produce the plan, the user produces the images.
- Does not write `script.json` — that's `/create-analysis-video`'s job.
- Does not run the pipeline.
- Does not delete orphan files automatically — only flags them.

## Edge cases

- **Source txt too short to support N scenes:** classify-football-content will note low confidence. Generate a smaller plan (fewer items) and tell the user.
- **Plan would have 0 image-eligible scenes:** rare (every video has at least a hook). If it happens, write the plan with just `hook` and tell the user.
- **User runs the skill twice on the same .txt:** overwrite the plan, list orphans from the old plan in the summary.
