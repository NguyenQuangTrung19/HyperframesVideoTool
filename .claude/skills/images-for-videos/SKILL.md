---
name: images-for-videos
description: Plan the images a football video will need, BEFORE the script is written. Reads a .txt source, classifies content type, decides which scenes need a custom image, writes a high-quality English prompt for each, and emits images-plan.json next to the .txt. The user generates each image manually (typically on grok.com), saves it under the planned filename, then runs /create-video to assemble the video — the planned images are staged into video/output/ automatically and the AI image API is bypassed.
---

# Images-for-Videos Skill

Visual-first workflow for football videos. The user wants control over hero visuals — they generate every image themselves on grok.com using their SuperGrok / X Premium chat subscription — but they want the prompts and naming worked out by Claude so they can batch-generate in one sitting.

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
   - Write `images-plan.json` into the part folder.
6. **Original source .txt stays untouched** at `video/input/<base-slug>/<base-slug>.txt` as source of truth. Do NOT delete it, do NOT overwrite it.
7. **Step 8 reply (multi-part case)** — list all part folders + image counts:
   ```
   ✓ Source dài 9 240 chars → split 3 phần.
   ✓ Phần 1: video/input/modric-bio-p1/ — 7 ảnh
   ✓ Phần 2: video/input/modric-bio-p2/ — 8 ảnh
   ✓ Phần 3: video/input/modric-bio-p3/ — 7 ảnh
   → Mở images-plan.json trong từng folder để đọc prompt (field `prompt`), gen ảnh
     song song, rồi chạy /create-video cho từng .txt theo thứ tự part 1 → part N.
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

Each individual scene gets its own sceneId / filename / prompt entry in `images-plan.json`. The prompt focuses on THAT player (name + club + nation anchor) instead of a group composition. The downstream `/create-video` skill renders each as a separate scene with its own image.

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

### Step 5: Write a prompt for each scene

Prompt rules — same as the imagePrompt rules in `/create-video`. Default visual style is **football poster artwork** (not cinematic press photo) per `memory/feedback_image_prompts_poster_style.md` — graphic backdrop, crest watermark, light bursts, vibrant club-color palette, photo-real player figure on top.

- **Language: English.** Grok handles English prompts much better than Vietnamese.
- **Style:** football poster artwork — hero subject + graphic-design backdrop + light-burst effects + vibrant saturated colors. Photo-real subject, graphic background — like a Premier League / UCL matchday promotional poster, EA Sports FIFA cover, or Sky Sports broadcast graphic.
- **Always open with:** `"Vertical 9:16 football poster artwork featuring..."` (or `"Vertical 9:16 split-frame football poster artwork showing..."` for matchup hooks). This token primes Grok for the right composition direction.
- **Length:** 80–140 words. Poster prompts run leaner than press-photo prompts because the background is "graphic backdrop" instead of full scene description — don't pad.
- **Player likeness — lean on the NAME, not on physical description.** Counter-intuitive lesson from past videos: when you stack "dark skin, square jaw, short braids, full black beard" onto a prompt, Grok averages those features into a *generic* player matching that description — and overrides the actual face it knows from training data. The real likeness comes from the **name + club + national team** (those are the strongest training-data anchors), not from a feature checklist. Rules:
  1. **Lead with the identity anchors.** `"<Full Name>, <Nationality> <position> for <Club> and the <National Team>"` — e.g. `"Virgil van Dijk, the Dutch centre-back and captain for Liverpool and the Netherlands national team"`. Use the name(s) by which the player is most commonly referred to in press coverage (so Grok matches its training labels). Even more critical in poster style because the graphic backdrop offers less likeness signal than a press-photo stadium context.
  2. **DO NOT describe facial features.** Skip skin tone, jaw shape, hair style/length/color, beard, eye color, cheekbones, nose, tattoos. Those tokens drag the output toward a generic look matching the description and *away* from the actual player. The model already knows what the named player looks like — let it use that.
  3. **Age/era cue is OK only if it disambiguates.** A short cue like `"in his current 2025–26 era"` or `"during his Real Madrid years"` helps Grok pick the right photo era. Skip it for players with one obvious era.
  4. **Spend the word budget on the POSE + BACKDROP, not the face.** Describe: kit + crest visible on chest (see Iconography block below), hero pose / action (trophy-lift, celebration roar, intense pre-action, signature gesture, captain pointing), graphic backdrop (club-color blocks, crest watermark, light rays), accent graphics (trophy element, stars, ribbons).
  5. **Close with a poster-style reference** matched to the scene's role:
     - Matchday scene → `"Stylized like a Premier League matchday promotional poster"` (swap league as needed: Bundesliga / La Liga / Serie A / Ligue 1).
     - UCL knockout / final → `"Stylized like a UEFA Champions League knockout matchday graphic"`.
     - End-of-season award (Golden Boot / Glove / Playmaker) → `"Stylized like an end-of-season award broadcast graphic"`.
     - Trophy lift → `"Stylized like a trophy-lift promotional poster"` or `"champions celebration broadcast graphic"`.
     - Big derby / VS → `"Stylized like a matchday rivalry promotional poster"`.
     - Historic moment / record → `"Stylized like a historic-moment promotional poster"`.
  6. **Real-name prompting is allowed** — the user has confirmed there are no copyright concerns for this channel.

- **Iconography — invite real club elements as poster graphics.** Real club crests, kit colors, and stadium landmarks are still the brand anchor — but rendered as **graphic-design elements**, not photographic backgrounds. The blanket ban on logos used to produce sterile fictional jerseys; the press-photo-realism style flattened out in 9:16. Poster style threads the needle: photo-real player figure + graphic-treated iconography behind/around.
  - **DO request real club crest on the kit** — e.g. `"in a bright red Bayern Munich home kit with the Bayern Munich crest clearly visible on the chest"`, `"in a navy PSG home kit with the Paris Saint-Germain crest clearly visible on the chest"`. Same wording as before — the crest IS the kit.
  - **DO use the crest AS BACKDROP** — `"a huge stylized <Club> crest floating faintly behind him as a watermark"`. This is the poster-style replacement for "packed home stand softly bokeh'd." Big crest watermark = stronger brand read at 9:16 thumbnail size.
  - **DO request club-color graphic blocks** — `"a bold <club color> graphic backdrop"`, `"layered color-block shards in <club colors> arranged like overlapping geometric panes"`, club-color dominant palette with one accent (usually gold for trophy/achievement).
  - **DO request supporting iconography as graphic accents** — fan scarves as graphic color bands at the bottom edge, faint stylized fan-crowd silhouettes flanking the subject, kit manufacturer stripes when canonical (Adidas three-stripes, Nike swoosh), the captain's armband when relevant, UEFA / Premier League trophy as a stylized graphic element when the scene's about that achievement.
  - **Stadium landmarks become subtle graphic motifs** when used — not full photographic backdrops. `"the Eiffel Tower silhouetted faintly as a graphic motif"`, `"Anfield's 'This Is Anfield' archway rendered as a stylized graphic"`. For most scenes, the crest watermark replaces the stadium entirely.
  - **Two exceptions — still avoid:**
    - **Scoreboards** showing scores/match-clock/team names. The pipeline overlays its own captions; an in-image scoreboard fights with the on-screen text.
    - **Lower-thirds, broadcaster graphics, text overlays, captions burned into the image.** Same reason — captions are added in post.
  - Word it explicitly at the end of each prompt: `"The <Club> crest visible on the jersey, no on-image text or captions, no scoreboard graphics."`

- **Hook scenes for VS / matchup content — split-frame poster with both clubs' graphic palettes.** When the video is a matchup (PSG vs Bayern, Messi vs Ronaldo, El Clásico, derby, relegation battle), the hook MUST show both sides. Recipe:
  - Vertical split-frame composition (left half / right half).
  - One player from each side **named** in their **real club kit with real crest visible on the chest**.
  - Each side's backdrop in that club's color palette + faint giant crest watermark + radiating light rays. Fan elements as graphic color bands / stylized silhouettes at the lower edge (not photographic crowds).
  - Down the centre seam: a diagonal lightning-burst / energy-slash separator with dramatic glow. If the matchup is for a specific prize, layer the competition's trophy as a graphic element between them (UCL starball, Premier League trophy, World Cup trophy).
  - Example skeleton:
  ```
  Vertical 9:16 split-frame football poster artwork. Left half: <Player A>, <Nationality> <role> for <Club A> and the <National Team A>, in a <Club A kit color> <Club A> home kit with the <Club A> crest clearly visible on the chest, intense focused hero pose. Behind him, a stylized <Club A color> graphic backdrop with a huge faint <Club A crest> watermark and radiating light rays. Right half: <Player B>, <Nationality> <role> for <Club B> and the <National Team B>, in a <Club B kit color> <Club B> home kit with the <Club B> crest clearly visible on the chest, mirroring hero pose. Behind him, a stylized <Club B color> graphic backdrop with a huge faint <Club B crest> watermark and radiating light rays. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow, the UEFA Champions League trophy with its starball pattern glowing as a stylized graphic accent between them. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League knockout matchday graphic. Both club crests visible on the jerseys, no on-image text or captions, no scoreboard graphics.
  ```

- **Split-frame via TWO single-subject images (preferred when "together" shots are hard to source).** A single AI prompt for two specific named people in one frame is unreliable — Grok often mangles one face, and real two-person photos rarely exist. So for any **VS / sibling-pair / head-to-head** scene (`stat-hero`, `callout`, or a matchup `hook`), plan it as **two single-subject images** that the pipeline composites into one split-frame at build time:
  - Keep ONE scene entry in `images-plan.json` with `filename: "<sceneId>.png"` (the composited result). In its `prompt`, describe **both halves in one string, clearly labelled**: `<sceneId>-1` (left) = which person, `<sceneId>-2` (right) = which person. Each half is a clean one-person 9:16 poster (name + club/nation anchor, framed chest-up, head in upper third). For a preview `hook`, this is simply: `hook-1` = cầu thủ X (chest-up), `hook-2` = HLV Y (chest-up) — no separate prompts file needed.
  - `subjectHint` should name both in Vietnamese, e.g. `hook-1: Messi (cầu thủ) · hook-2: Scaloni (HLV)`.
  - At `npm run images:stage` time, `combine-split-images` auto-merges `<sceneId>-1` + `<sceneId>-2` → `<sceneId>.png` (left | gold seam | right). The user generates two easy single-player images instead of one hard two-person image. They may also drop a real two-person photo as `<sceneId>.png` to skip the merge.
  - `validatePlan` treats `<sceneId>-1` / `<sceneId>-2` as split sources, not orphans. This is exactly what the `tam-cap-anh-em-ruot-tai-world-cup-2026` (sibling pairs) plan uses — model new VS/pair plans on it.

- **Atmospheric / illustrative scenes — variety pool, but as poster graphics.** Don't default every callout/stat-hero to "player in hero pose." Videos breathe when you mix in atmosphere. In poster style these become **graphic-treated motifs** rather than photographic backdrops. Pull from this pool when picking scene angles (one or two per video, not all):
  - **Ultras / fan tribute** — render fan scarves as graphic color bands at the lower frame, stylized fan-crowd silhouettes flanking the subject. References: Yellow Wall (BVB yellow), Virage Auteuil (PSG navy), the Kop (Liverpool red), Bombonera (Boca blue-and-yellow). Don't photographically render the crowd; treat it as a colored graphic shape.
  - **Tifo / mosaic** — a stylized graphic tifo banner motif at the lower or upper frame edge, forming the club crest or initials. Looks great as the "ribbon" element under a hero figure.
  - **Mascot moment** — the club mascot as a stylized graphic accent in a corner (Bayern's "Berni" the bear, Tottenham's cockerel), not a full photo scene. Or use a corner-graphic logo treatment if the mascot itself feels off-brand for the scene.
  - **Stadium landmark as motif** — Allianz Arena's red-glowing facade rendered as a stylized geometric silhouette in the background, Bernabéu's metallic skin as an abstract texture, Anfield's archway as a graphic frame. The landmark is suggested, not photographed.
  - **Trophy element** — the relevant trophy (UCL starball, Premier League, FA Cup, Bundesliga Meisterschale) as a graphic element in a corner or hovering near the subject. Strong choice for award scenes (Golden Boot, Golden Glove, championship lifts).
  - **Manager / staff** — the manager appearing as a smaller secondary figure beside the hero player when both are central to the story (e.g. Arteta hugging a teammate behind Ødegaard, Slot at the touchline behind Salah). Render in the same poster style.
  - **For each pick, still anchor to the specific club:** name the trophy, the stadium silhouette, the crest watermark color. "Generic light rays" is the boring fallback — use it only when nothing more specific fits.

- **"Ảnh chế" / meme scenes — 0–2 per plan when the story invites it.** SportsForAllTV videos work best when they breathe — a humorous "what-if" poster amplifies a story with built-in irony. Use sparingly but use them. **NOT cartoon — football-poster artwork (same style as other scenes) with ONE specific impossible element.**

  **When a meme fits (include 1–2):**
  - ✅ Manager mind-games (e.g. *Pep cổ vũ West Ham* → Pep mặc áo West Ham; *Klopp khen Arsenal* → Klopp ôm cờ Pháo Thủ).
  - ✅ Banter / rivalry tension (derby trash-talk, fan-base back-and-forth).
  - ✅ Drama / soap-opera moments (Mbappé drama, transfer saga twists, contract standoffs).
  - ✅ Absurd "still going" stats (*Modric vẫn chạy ở tuổi 40* → Modric trên ghế đu đưa với giày đinh).
  - ✅ Surprising/ironic stat angles (the underdog topping the table, the star out-assisting the playmaker).

  **When NOT to add a meme (skip — leave 0):**
  - ❌ Tribute / retirement / death pieces.
  - ❌ Sober tactical analysis without an ironic angle.
  - ❌ Pure ranking countdowns (top scorers, top CBs) — facts speak for themselves.
  - ❌ Heavy-news pieces (injuries, controversies that hurt people).

  **Hard cap: 2 meme scenes per plan.** One is usually plenty; two only when the source has multiple distinct comic angles. Memes count toward the density budget — they REPLACE a regular image scene, they don't add on top.

  **Recipe — write the prompt in poster style, but with one specific impossible element:**
  1. **Tag the prompt as humor up front.** Open with `"Vertical 9:16 football poster artwork (humor edit / playful what-if scene) featuring..."` so Grok understands the intent.
  2. **Lead with the named subject** the same way as a regular prompt — `"Pep Guardiola, the Spanish manager of Manchester City"`. Don't describe their face.
  3. **Specify ONE impossible element** clearly: the wrong jersey, the wrong scarf, the wrong gesture toward a rival, a comically out-of-place prop. Don't stack three jokes — one clean punchline reads stronger.
  4. **Real club iconography stays accurate** — the joke is funnier when the West Ham crossed-hammers crest is *correctly* on the kit Pep is *wrongly* wearing. Sloppy crest = bad joke. **The backdrop watermark should be the IRONIC club** (West Ham crest watermark on a Pep poster), not Pep's actual club — that doubles the joke's clarity.
  5. **Reaction accent (optional)** — a small graphic-treated supporter silhouette doing a double-take, or a single front-row fan rendered as a poster cutout with a bewildered expression. Don't over-stage with photographic crowds — one stylized reaction accent is enough.
  6. **Same poster cues** as regular scenes — vibrant saturated palette, light rays, glossy graphic finish, photo-real subject on graphic backdrop. **Do NOT use press-photo realism cues** (telephoto, shallow DOF, "natural skin texture") — they conflict with the poster look.
  7. **Same end clause** — `"The <ironic club> crest visible on the jersey, no on-image text or captions, no scoreboard graphics"`.
  8. **subjectHint must mark it as a meme** in Vietnamese — start with `"Ảnh chế —"` or `"Vui —"` so the user sees the comedic intent without re-reading the English prompt. E.g. `"Ảnh chế — Pep mặc áo West Ham, fan City ngỡ ngàng"`.
  9. **Template:** usually `callout` (humor under a punchline statement). Use `hook` only when the meme IS the headline image of the story.

  **Example — Pep cổ vũ West Ham scenario (poster style):**
  ```
  Vertical 9:16 football poster artwork (humor edit / playful what-if scene) featuring Pep Guardiola, the Spanish manager of Manchester City, in a hero pose with his forearms crossed in front of his chest in the iconic West Ham 'hammers' gesture and a wide grin on his face. He wears a claret-and-sky-blue West Ham United home kit with the West Ham crossed-hammers crest clearly visible on the chest. Background: a bold claret-and-sky-blue West Ham graphic backdrop with a huge stylized West Ham crossed-hammers crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind, a small graphic-treated front-row supporter silhouette in sky-blue Manchester City colors at the lower edge doing a double-take with an open-mouthed expression. Vibrant saturated claret-and-sky-blue palette, very high contrast, glossy graphic-design finish. Stylized like a Premier League promotional poster (with an ironic twist). The West Ham crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
  ```

  **Common pitfalls to avoid:**
  - ❌ Cartoon / illustration style — that breaks the channel's photo-real-subject + graphic-backdrop identity.
  - ❌ More than one impossible element per image (Pep in West Ham kit + holding the wrong trophy + standing in the wrong stadium = chaotic).
  - ❌ Memes that punch down at a player (mocking a struggling youngster, a serious injury) — SportsForAllTV tone is playful, not cruel.
  - ❌ Putting the joke in voiceText *and* the meme image — let the image carry it; voiceText reports the actual story straight.

Example (Van Dijk) — poster style, name-driven, crest watermark backdrop:
```
Vertical 9:16 football poster artwork featuring Virgil van Dijk, the Dutch centre-back and captain for Liverpool and the Netherlands national team, in a hero pose rising for a defensive header mid-air, ball just leaving his forehead, intense commanding expression. He wears a bright red Liverpool home kit with the Liverpool FC Liver-bird crest clearly visible on the chest and the captain's armband on his left arm. Background: a deep crimson Liverpool-red graphic backdrop with a huge stylized Liver-bird crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head, faint stylized 'YNWA' banner ribbon graphic across the lower frame in soft Liverpool-red. Vibrant saturated Liverpool red palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a Premier League matchday promotional poster. The Liverpool crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

Hook example (PSG vs Bayern UCL knockout) — split-frame poster:
```
Vertical 9:16 split-frame football poster artwork showing a UEFA Champions League knockout matchup. Left half: Ousmane Dembélé, the French winger for Paris Saint-Germain, in a navy PSG home kit with the Paris Saint-Germain crest in red and white clearly visible on the chest, intense focused hero pose. Behind him, a stylized navy-and-red PSG graphic backdrop with a huge faint PSG crest watermark, the Eiffel Tower silhouetted faintly as a graphic motif, radiating light rays. Right half: Harry Kane, the English striker and captain for Bayern Munich, in a bright red Bayern Munich home kit with the Bayern Munich crest clearly visible on the chest, mirroring hero pose. Behind him, a stylized red Bayern graphic backdrop with a huge faint Bayern Munich crest watermark, the Allianz Arena's red-glowing facade silhouetted as a graphic motif, radiating light rays. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow, the UEFA Champions League trophy with its starball pattern glowing as a stylized graphic accent between them. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League knockout matchday graphic. Both club crests visible on the jerseys, no on-image text or captions, no scoreboard graphics.
```

For very young/new players (e.g. teenage debutants), Grok's training data may be thin → likeness will be weaker even with the name. Still rely on the name; do NOT compensate with feature descriptions (that makes it worse). Poster style actually helps here — the graphic backdrop carries more of the composition than the face. Warn the user in the summary that this player may need extra re-rolls.
- **Variety:** don't make every player scene a "celebrating goal roar" shot. Mix hero poses across scenes: trophy lift, mid-stride driving forward, defensive header rise, sliding tackle frozen mid-air, captain pointing instructions, contemplative pose with arms folded, post-save dive, signature goal celebration. Variety keeps the video visually interesting at thumbnail and full-frame.
- **Length budget:** poster prompts run leaner than press-photo prompts because the background is "graphic backdrop" instead of a full scene description — **80–140 words is the target**. Grok handles this length well; longer prompts pad the graphic-design vocab without adding visual signal.

- **⚠️ Rating badges for MATCH RECAP content (2026-05-31).** When the source includes player ratings (e.g. Goal.com player ratings), include a **stylized rating badge** in the prompt for each rated player. This makes the video feel like a match-recap broadcast graphic:
  - **High ratings (7-10):** `"A stylized golden/blue rating badge glowing with the number <N> floats near his shoulder like a video-game stat overlay"` — golden for 8+, blue for 7.
  - **Low ratings (4-5):** `"A large stylized deep-red warning rating badge glowing ominously with the number <N> floats near his shoulder like a video-game low-score stat overlay with a cracked glass effect"` — red + cracked glass effect.
  - **MVP (highest score):** `"A large stylized golden-blue rating badge glowing brightly with the number <N> floats prominently near his shoulder like a video-game MVP stat overlay with subtle golden sparkle"` — extra golden sparkle.
  - Always mention the score in the `subjectHint` too: e.g. `"Willian Pacho — Cầu thủ xuất sắc nhất PSG | Điểm 8/10"`.
  - **Pose should match performance:** High-rated → confident/triumphant pose. Low-rated → frustrated/dejected pose. Goalkeeper saves → diving pose. Missed penalty → devastated kneeling pose.

  Example — low-rated player (Desire Doue 4/10):
  ```
  Vertical 9:16 football poster artwork featuring Desire Doue, the young French winger for Paris Saint-Germain, in a frustrated dejected pose walking slowly with head hanging down, shoulders slumped, after a poor performance — a missed shot sailing wide in the background as a ghostly transparent action replay. He wears the navy-and-red PSG home kit with the PSG crest clearly visible on the chest. A large stylized deep-red warning rating badge glowing ominously with the number 4 floats near his shoulder like a video-game low-score stat overlay with a cracked glass effect. Background: a moody dark navy graphic backdrop with a huge faded PSG crest watermark, dramatic downward-pointing cold blue light rays creating a somber disappointed atmosphere. Moody saturated dark navy palette, very high contrast, glossy graphic-design finish. Stylized like a Champions League disappointment editorial poster. The PSG crest visible on the jersey, no scoreboard graphics.
  ```

- **If Grok renders too "photo-real" instead of poster:** add `"in the style of a stylized vector-illustration sports poster"` or `"EA Sports FIFA cover art style"` at the very front of the prompt to push it further toward graphic-design treatment. Use sparingly — the default poster framing usually lands without these extra cues.

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
      "subjectHint": "Hero shot 7 trung vệ — UCL knockout poster",
      "prompt": "Vertical 9:16 football poster artwork. Centre composition: a low-angle silhouette of an elite centre-back in a generic home kit hero pose, captain's armband visible, arms slightly outstretched. Background: a layered dark navy graphic backdrop with a huge stylized UEFA Champions League starball pattern floating faintly as a watermark, dramatic golden light rays radiating outward from behind the figure, faint stylized European-club crest silhouettes (Real Madrid, Liverpool, Barcelona, Bayern) flanking the composition as graphic accents in the upper corners. Vibrant saturated palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League knockout matchday graphic. No on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "cb-1",
      "template": "stat-hero",
      "filename": "cb-1.png",
      "subjectHint": "Virgil van Dijk — Liverpool",
      "prompt": "Vertical 9:16 football poster artwork featuring Virgil van Dijk, the Dutch centre-back and captain for Liverpool and the Netherlands national team, in a hero pose rising for a defensive header mid-air, ball just leaving his forehead, intense commanding expression. He wears a bright red Liverpool home kit with the Liverpool FC Liver-bird crest clearly visible on the chest and the captain's armband on his left arm. Background: a deep crimson Liverpool-red graphic backdrop with a huge stylized Liver-bird crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head, faint stylized 'YNWA' banner ribbon graphic across the lower frame. Vibrant saturated Liverpool red palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a Premier League matchday promotional poster. The Liverpool crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    }
  ]
}
```

**One file** — `images-plan.json` — written to the same directory as the source .txt. This is the single source of truth: machine-readable plan validated by `src/image/plan-schema.ts`, consumed by `/create-video` and `npm run images:stage`. The image description the user generates from lives in each scene's **`prompt`** field (full English image-gen prompt) with **`subjectHint`** naming the subject in Vietnamese. Do **NOT** emit a separate `grok-prompts.md` — the user reads prompts straight from `images-plan.json`.

### Step 8: Reply concisely

Do NOT dump full prompts into the chat — they are in `images-plan.json` for the user to read. Reply with a short confirmation + the parallel-gen reminder:

```
✓ Plan: <input-dir>/images-plan.json
<N> ảnh cần tạo (1 hook + N CB / N item / ...). Mô tả từng ảnh ở field `prompt`.

⚡ Gen ảnh song song: mở <N> tab grok.com cùng lúc (Imagine, 9:16), paste prompt từng
   tab, bấm generate ĐỒNG LOẠT rồi mới chờ. Save về cùng folder, stem đúng tên file
   (`hook`, `cb-1`, ...); đuôi .png/.jpg/.jpeg/.webp/.avif đều OK. Xong → /create-video <path>.

⚠ Orphan từ plan cũ (xóa sau):  ← only if any
  • old-cb-8.png
```

If the user wants to tweak a prompt, they open `images-plan.json` and edit the `prompt` field. If they changed the source .txt, just regenerate `images-plan.json`.

## What this skill does NOT do

- Does not generate images itself — you produce the plan, the user produces the images.
- Does not write `script.json` — that's `/create-video`'s job.
- Does not run the pipeline.
- Does not delete orphan files automatically — only flags them.

## Edge cases

- **Source txt too short to support N scenes:** classify-football-content will note low confidence. Generate a smaller plan (fewer items) and tell the user.
- **Plan would have 0 image-eligible scenes:** rare (every video has at least a hook). If it happens, write the plan with just `hook` and tell the user.
- **User runs the skill twice on the same .txt:** overwrite the plan, list orphans from the old plan in the summary.
