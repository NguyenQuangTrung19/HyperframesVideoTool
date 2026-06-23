---
name: images-for-videos
description: Plan the images a football video will need, BEFORE the script is written. Reads a .txt source, classifies content type, decides which scenes need a custom image, names each one with a concise Vietnamese subjectHint, and emits images-plan.json + anh-can-tao.md next to the .txt. Does NOT author English image prompts (per the no-prompt rule — saves tokens). The user generates each image manually on grok.com from the subjectHint description, saves it under the planned filename, then runs /create-video to assemble the video — the planned images are staged into video/output/ automatically and the AI image API is bypassed.
---

# Images-for-Videos Skill

Visual-first workflow for football videos. The user wants control over hero visuals — they generate every image themselves on grok.com using their SuperGrok / X Premium chat subscription. This skill works out **which scenes need an image, their filenames, and a concise Vietnamese subjectHint** for each, so the user can batch-generate in one sitting. **It does NOT write English image prompts** — per the standing no-prompt rule (`memory/feedback_dont_author_image_prompts.md`), authoring verbose prompts wastes tokens with little gain; the user generates each image freehand on grok.com from the subjectHint.

## When to use

User runs `/images-for-videos <path-to-source.txt>` BEFORE running `/create-video`. Examples:

- `/images-for-videos video/input/topCBsITW/topCBsITW.txt`
- `/images-for-videos video/input/messi-vs-ronaldo/source.txt`

If the user runs `/create-video` directly without a plan, that skill will work in fallback mode (Gemini API generates images at pipeline runtime) — the plan step is optional but strongly recommended for content where image quality matters (rankings of named players, history pieces, VS comparisons of specific people).

## Input contract

- Single argument: a path to a `.txt` file.
- The directory containing the txt is the **input folder** — the plan and all images live there.
- Recommended layout: `video/input/<slug>/<slug>.txt`, e.g. `video/input/topCBsITW/topCBsITW.txt`. With this layout, `<slug>` is derived from the parent folder name. Legacy `input/<slug>/<slug>.txt` and flat `input/foo.txt` layouts also work — slug becomes the file stem when there's no enclosing subfolder.

## Workflow (MUST follow these steps in order)

### Step 1: Read the source file

`Read` the .txt completely. Don't truncate — content type detection depends on full structure.

### Step 1.5: Long-source auto-split (BIO + HISTORY ONLY)

**Policy (2026-05-26):** Auto-split applies **ONLY** to content types where the narrative naturally segments into chapters/eras. Run classification FIRST (Step 2 lookahead — actually do classification before this step):

| Content type | Auto-split? |
|---|---|
| BIO-PLAYER | ✅ Yes — split at era / chapter boundaries |
| HISTORY-CLUB | ✅ Yes — split at decade / dynasty boundaries |
| HISTORY-NATIONAL-TEAM | ✅ Yes — split at tournament era / generation boundaries |
| HISTORY-TOURNAMENT | ✅ Yes — split at format-reform / dynasty boundaries |
| RANKING | ❌ Never — single video even if 30 items / 15 000 chars (URL article rewrites of long ranking lists stay single) |
| MATCH ANALYSIS | ❌ Never |
| MATCH RECAP | ❌ Never — single video covering one match's events + player ratings |
| NEWS DRAMA | ❌ Never — single video covering social media / off-pitch drama |
| PRE-MATCH PREVIEW | ❌ Never |
| PLAYER PROFILE (stats deep-dive) | ❌ Never |
| TRANSFER NEWS | ❌ Never |
| TRIVIA | ❌ Never |
| VS | ❌ Never |

**Reason** (per `memory/project_autosplit_only_bio_history.md`): news / ranking / analysis are conceptually one continuous argument — splitting breaks the thesis and feels arbitrary. Long URL articles rewrite into one rich long video, not split. Bio / history are sequential by nature so chapter-based splitting reads naturally.

**For BIO + HISTORY types only**, count the total character length of the source prose (after stripping leading/trailing whitespace; markdown bullets and headings count as chars). Decide the number of parts:

| Total chars | Parts |
|---|---|
| < 4 000 | 1 (no split — skip the rest of this step) |
| 4 000 – 7 999 | 2 |
| 8 000 – 11 999 | 3 |
| 12 000 – 15 999 | 4 |
| ≥ 16 000 | 5 (hard cap — never produce >5 parts) |

**For all other types, skip the rest of this step regardless of source length.** The single-video scene-count cap (16 scenes / ~180 s) applies as the upper bound when source is rich — that's the natural limit, not a split trigger.

**If N = 1 (either by content-type or by short source), skip to Step 2.** Single-part videos go through the rest of the skill exactly as before.

**If N ≥ 2 — auto-split flow:**

1. **Decide the cut points.** Aim for ~equal char count per part (±15 % is fine). Cut at the strongest available boundary — in this order of preference:
   1. **A blank-line paragraph break** that lands near the target char position.
   2. **An end-of-sentence boundary** (`.` / `?` / `!` followed by whitespace) near the target.
   3. **A word boundary** as last resort.
   Never split mid-word, mid-sentence-fragment, or mid-bullet-list-item.
2. **Prefer semantic boundaries when the content type has them:**
   - **RANKING (Top N)** — cut between rank groups (e.g. Top 10 → Part 1 = ranks 10–6, Part 2 = ranks 5–1). Always end a part on a *complete* rank entry.
   - **BIO-PLAYER / HISTORY-*** — cut between eras / chapters / decades.
   - **TRIVIA** — cut between facts (each fact stays whole).
   - **MATCH ANALYSIS / PRE-MATCH PREVIEW / PLAYER PROFILE / VS / TRANSFER NEWS** — usually only split if source is unusually long (rare); same paragraph-boundary rules apply.
3. **For each part, derive the part slug:**
   - `<base-slug>` = parent-folder name of the source .txt (e.g. `video/input/modric-bio/modric-bio.txt` → base = `modric-bio`).
   - Part folder: `video/input/<base-slug>-p<N>/`.
   - Part .txt: `<base-slug>-p<N>.txt` inside that folder.
4. **For each part, write the part .txt:**
   - Body = the segment's prose.
   - **Title line:** carry the original title forward, suffixed `— Phần <N>` (e.g. `"Hành trình Modric — Phần 1"`). If the source has no explicit title line, derive one from the slug + part marker.
   - **No internal trailing CTA in the .txt itself.** The "Phần N+1 sắp lên sóng…" line for non-final parts gets injected as the OUTRO scene by `/create-video` at render time, not baked into the prose. Keep the .txt clean prose.
5. **For each part, run Steps 2–7 INDEPENDENTLY** against its own .txt:
   - Classify the part's content separately (it inherits the parent content type in practice — RANKING stays RANKING; BIO-PLAYER stays BIO-PLAYER).
   - Apply the density rules from Step 3 against this part's distinct points (each part should support 6–11 scenes on its own — see `/create-video` density table). If a part would have < 3 points → reduce N by 1 and re-split (rare).
   - Write `images-plan.json` + `anh-can-tao.md` into the part folder.
6. **Original source .txt stays untouched** at `video/input/<base-slug>/<base-slug>.txt` as source of truth. Do NOT delete it, do NOT overwrite it.
7. **Step 8 reply (multi-part case)** — list all part folders + image counts:
   ```
   ✓ Source dài 9 240 chars → split 3 phần.
   ✓ Phần 1: video/input/modric-bio-p1/ — 7 ảnh
   ✓ Phần 2: video/input/modric-bio-p2/ — 8 ảnh
   ✓ Phần 3: video/input/modric-bio-p3/ — 7 ảnh
   → Mở anh-can-tao.md trong từng folder để xem cần ảnh gì (mô tả VN gọn mỗi scene),
     gen song song, rồi chạy /create-video cho từng .txt theo thứ tự part 1 → part N.
   ```

### Step 2: Classify content

Invoke the [`classify-football-content`](../classify-football-content/SKILL.md) skill on the source. Get:
- **type** (RANKING / VS / MATCH ANALYSIS / MATCH RECAP / NEWS DRAMA / PRE-MATCH PREVIEW / PLAYER PROFILE / HISTORY-CAREER / TRANSFER NEWS / TRIVIA)
- **proposed scene structure** (count + template sequence)

This is the single source of truth for "what scenes this video will have". The image plan derives directly from it.

**New content types (2026-05-31):**
- **MATCH RECAP** — Post-match analysis with player ratings (e.g. Goal.com player ratings articles). Contains per-player performance breakdowns with numerical scores. These are IMAGE-DENSE — plan one image per rated player mentioned in the .txt.
- **NEWS DRAMA** — Social media reactions, troll posts, off-pitch controversy. Plan images for each distinct moment/reaction in the narrative.

### Step 3: Determine image-eligible scenes

Only these templates take a custom image:
- `hook` — opening hero shot
- `stat-hero` — full-bleed background under one big stat
- `callout` — atmospheric background under a quote/claim

These templates do NOT take images (skip them in the plan):
- `comparison` — left/right cards on solid color
- `feature-list` — bulleted list, no photo
- `outro` — TikTok profile card

**⚠️ Density first — count distinct substantive points before picking image count.** The plan locks the floor of `/create-video`'s scene count (script must include every plan scene). So a bloated plan forces a bloated video. Scale image count to the source's actual content density:

1. Count "distinct substantive points" in the source — independent facts/claims worth their own scene (each ranked item, each compared metric, each tactical insight, each career chapter, each fact, **each named player with a rating**). Re-stating earlier material doesn't count.
2. Map points → image-eligible scene count:

   | Distinct points in source | Plan size (image-eligible scenes) | Action |
   |---|---|---|
   | **< 3** | — | **Bail.** Tell user the source is too thin for a useful video and ask them to add more facts/context to the .txt before re-running. Do NOT write `images-plan.json`. |
   | 3–4 | hook + 2–3 image scenes (3–4 total) | Tight plan, single arc |
   | 5–7 | hook + 4–6 image scenes (5–7 total) | Standard plan |
   | 8–12 | hook + 7–11 image scenes (8–12 total) | Full-depth plan |
   | 13+ | hook + 12–15 image scenes (13–16 total) | **Maximum-depth plan** — for MATCH RECAP with many rated players or NEWS DRAMA with many distinct events. Each named player/event gets their own scene. |

   **⚠️ CRITICAL (2026-05-31 feedback): NEVER under-plan images.** If the .txt mentions 10 distinct players with ratings, plan 10 player scenes + hook + context scenes = ~13 total. A video with only 6-8 images for a 10-player article feels cheap and low-quality. **Every named player with a rating or significant role deserves their own image scene.**

3. Then apply the per-content-type shapes below — but cap at the band you picked above. A "Top 10" ranking for a thin source is rare, but if a TRANSFER NEWS source supports only 3 distinct points, that wins over the table's "1–2 stat-hero" guidance — go with `hook + 2 image scenes` total.

For each content type, the typical image set (capped by density above):

| Content type | Typical image-eligible scenes |
|---|---|
| RANKING (Top N) | `hook` + N × `stat-hero` (one per item) — N = number of items |
| VS comparison | `hook` + 2 × `stat-hero` (one per side) + 0–1 `callout` |
| MATCH ANALYSIS | `hook` + 2–4 × `callout`/`stat-hero` for key moments |
| **MATCH RECAP** | `hook` + **1 scene per named player with rating** (typically 8–12 `stat-hero`/`callout`) + 1–2 `context` scenes (manager/trophy/aftermath). Plan generously — each key fact and each rated player gets their own image. |
| **NEWS DRAMA** | `hook` + **1 scene per distinct event/moment** (typically 6–10 `stat-hero`/`callout`) + 1–2 `context` scenes. Social media screenshots become stylized poster compositions. |
| PRE-MATCH PREVIEW | `hook` + 2–4 × `callout`/`stat-hero` (stakes, key matchup, prediction visual) |
| PLAYER PROFILE | `hook` + 3–5 × `stat-hero`/`callout` |
| HISTORY-CAREER | `hook` + 4–6 × `callout`/`stat-hero` (key chapters) |
| TRANSFER NEWS | `hook` + 1–2 × `stat-hero` (player + fee context) |
| TRIVIA | `hook` + N × `callout` (one per fact) |

**⚠️ Player groups inside any content type — plan ONE image per named player, not one image for the whole group.** When the source names 2-5 specific players as a thematic group (workers / leaders / key matchups / breakout stars / shortlist transfer targets / squad-reveal trụ cột) and each player has a distinguishing trait, plan an **individual `stat-hero` (or `callout`) scene per player**, each with its own image. Don't pack 4 names into one `feature-list` scene — that template doesn't take an image, and a sound-off viewer can't recognize 4 different players from a single bullet list.

| Player-group situation | Plan as |
|---|---|
| HISTORY-CAREER mentions 4 "workers" (Kimmich, Andrich, Rüdiger, Tah) | `hook` + ... + 1 group `callout` (concept intro) + 4 individual `stat-hero` (one per player) |
| MATCH ANALYSIS names 3 key actors of a goal moment | 3 individual `callout` scenes, one per actor |
| PRE-MATCH PREVIEW lists 4 key matchups | 4 individual `callout` scenes, one per matchup duel (could be split-frame each) |
| TRANSFER NEWS shortlist (5 candidates) | 1 group `callout` + 3-5 individual `stat-hero` (one per candidate) |
| Source lists 6+ players without per-player traits | Keep as `feature-list` (no image) — splitting 6+ creates fatigue |

Each individual scene gets its own sceneId / filename / subjectHint entry in `images-plan.json`. The subjectHint names THAT player (e.g. `"Virgil van Dijk — Liverpool"`) instead of a group. The downstream `/create-video` skill renders each as a separate scene with its own image.

**⚠️ Group-stage team reveal → NO per-team images (handled by the `group-intro` code template).** When the source introduces a tournament **group** (a bảng with its 3–4 teams + predicted order, e.g. "Bảng F: Argentina, Na Uy, Australia, Tunisia"), do NOT plan a `stat-hero` image per team for that table. The team reveal is rendered by the data-driven **`group-intro`** template (flags/crests + names + predicted finish — code, no AI image) by `/create-video`. Plan images ONLY for the `hook` + 1–2 **highlights** of that group (a marquee match VS, a star player). A group-stage part covering 2 bảng = `hook` + ~2 highlight image scenes in `images-plan.json`; the two `group-intro` table scenes carry no plan entry. (This is exactly how `du-doan-world-cup-2026-p1…p6` are planned.)

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

Default filename extension: `.png`. The pipeline accepts `.png` / `.jpg` / `.jpeg` / `.webp` / `.avif` — the user may save under any of these and the staging step handles it (the Chromium renderer decodes AVIF natively).

### Step 5: Write a subjectHint for each scene

**No English prompts.** Per the standing no-prompt rule (`memory/feedback_dont_author_image_prompts.md`), do NOT write a `prompt` field. Each image-eligible scene carries only a concise Vietnamese `subjectHint`; the user generates the image freehand on grok.com from it. (The schema keeps `prompt` optional for legacy plans — leave it out for new ones.)

**subjectHint rules** (≤200 chars, Vietnamese OK — one line per scene):
- Name the subject the way press refers to them + club/nation anchor: `"Virgil van Dijk — Liverpool"`, `"Kylian Mbappe — Pháp"`. The NAME locks likeness — don't describe faces.
- **MATCH RECAP / ratings:** append the score — `"Willian Pacho — PSG | Điểm 8/10"`. Pose follows performance (user decides at gen time).
- **Meme / ảnh chế:** prefix `"Ảnh chế —"` or `"Vui —"` so intent is clear, e.g. `"Ảnh chế — Pep mặc áo West Ham"`. Cap 2 memes/plan; they REPLACE a regular scene, not add on top. Skip memes for tribute / heavy-news pieces.
- Enough for the user to know what to gen — no visual-style instructions, no English.

**Split-frame via TWO single-subject images** (VS / sibling-pair / matchup hook): keep ONE plan scene with `filename: "<sceneId>.png"`, but the user gens two easy single-person images named `<sceneId>-1` (left) + `<sceneId>-2` (right). At `npm run images:stage`, `combine-split-images` auto-merges them → `<sceneId>.png` (left | gold seam | right). `subjectHint` names both: `"hook-1: Messi (cầu thủ) · hook-2: Scaloni (HLV)"`. The user may instead drop a real two-person photo as `<sceneId>.png` to skip the merge. `validatePlan` treats `-1`/`-2` as split sources, not orphans.

### Step 6: Detect orphans from a previous plan

If `images-plan.json` already exists at the target path:
1. Read the existing plan.
2. Compare its filenames to the new plan's filenames.
3. Any filename in the OLD plan but not in the NEW plan → list as "orphan" (user should delete from input folder after re-running, since they won't be used).

### Step 7: Write images-plan.json + anh-can-tao.md

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
      "subjectHint": "Hero shot 7 trung vệ — UCL knockout"
    },
    {
      "id": "cb-1",
      "template": "stat-hero",
      "filename": "cb-1.png",
      "subjectHint": "Virgil van Dijk — Liverpool"
    }
  ]
}
```

No `prompt` field — `subjectHint` is the only description (see Step 5). The schema keeps `prompt` optional for legacy plans, but new plans omit it.

**Two files**, both written to the same directory as the source .txt:

1. **`images-plan.json`** — the machine source of truth: validated by `src/image/plan-schema.ts`, consumed by `/create-video` and `npm run images:stage`. Each scene = `id` + `template` + `filename` + `subjectHint` (Vietnamese, naming the subject). No English prompt.
2. **`anh-can-tao.md`** — a **lightweight Vietnamese checklist** so the user knows at a glance which images to generate, without reading raw JSON. Format:

```markdown
# Ảnh cần tạo — <title> (<N> ảnh)

Gen trên grok.com (Imagine, 9:16). Save đúng tên file dưới đây vào folder này; đuôi .png/.jpg/.jpeg/.webp/.avif đều được.

- [ ] `hook.png` — <subjectHint của scene hook>
- [ ] `cb-1.png` — <subjectHint>
- [ ] `cb-2.png` — <subjectHint>
... (một dòng `- [ ] \`<filename>\` — <subjectHint>` cho MỖI scene, đúng thứ tự plan) ...
```

One line per scene, in plan order, `- [ ] \`<filename>\` — <subjectHint>`. This is the **sole** image description the user reads — keep each subjectHint self-sufficient.

### Step 8: Reply concisely

Reply with a short confirmation + the parallel-gen reminder (do NOT dump anything else):

```
✓ Plan: <input-dir>/images-plan.json
✓ Checklist ảnh: <input-dir>/anh-can-tao.md (xem cần tạo ảnh gì)
<N> ảnh cần tạo (1 hook + N CB / N item / ...).

⚡ Gen ảnh song song: mở <N> tab grok.com cùng lúc (Imagine, 9:16), gen theo mô tả
   từng scene trong anh-can-tao.md, bấm generate ĐỒNG LOẠT rồi mới chờ. Save về cùng
   folder, stem đúng tên file (`hook`, `cb-1`, ...); đuôi .png/.jpg/.jpeg/.webp/.avif
   đều OK. Xong → /create-video <path>.

⚠ Orphan từ plan cũ (xóa sau):  ← only if any
  • old-cb-8.png
```

If the user changed the source .txt, just regenerate both files.

## What this skill does NOT do

- Does not generate images itself — you produce the plan, the user produces the images.
- Does not write `script.json` — that's `/create-video`'s job.
- Does not run the pipeline.
- Does not delete orphan files automatically — only flags them.

## Edge cases

- **Source txt too short to support N scenes:** classify-football-content will note low confidence. Generate a smaller plan (fewer items) and tell the user.
- **Plan would have 0 image-eligible scenes:** rare (every video has at least a hook). If it happens, write the plan with just `hook` and tell the user.
- **User runs the skill twice on the same .txt:** overwrite the plan, list orphans from the old plan in the summary.
