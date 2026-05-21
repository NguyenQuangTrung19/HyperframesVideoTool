---
name: images-for-videos
description: Plan the images a football video will need, BEFORE the script is written. Reads a .txt source, classifies content type, decides which scenes need a custom image, writes a high-quality English prompt for each, and emits images-plan.json next to the .txt. The user generates each image manually (typically on grok.com), saves it under the planned filename, then runs /create-video to assemble the video — the planned images are staged into output/ automatically and the AI image API is bypassed.
---

# Images-for-Videos Skill

Visual-first workflow for football videos. The user wants control over hero visuals — they generate every image themselves on grok.com using their SuperGrok / X Premium chat subscription — but they want the prompts and naming worked out by Claude so they can batch-generate in one sitting.

## When to use

User runs `/images-for-videos <path-to-source.txt>` BEFORE running `/create-video`. Examples:

- `/images-for-videos input/topCBsITW/topCBsITW.txt`
- `/images-for-videos input/messi-vs-ronaldo/source.txt`

If the user runs `/create-video` directly without a plan, that skill will work in fallback mode (Gemini API generates images at pipeline runtime) — the plan step is optional but strongly recommended for content where image quality matters (rankings of named players, history pieces, VS comparisons of specific people).

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

**⚠️ Density first — count distinct substantive points before picking image count.** The plan locks the floor of `/create-video`'s scene count (script must include every plan scene). So a bloated plan forces a bloated video. Scale image count to the source's actual content density:

1. Count "distinct substantive points" in the source — independent facts/claims worth their own scene (each ranked item, each compared metric, each tactical insight, each career chapter, each fact). Re-stating earlier material doesn't count.
2. Map points → image-eligible scene count:

   | Distinct points in source | Plan size (image-eligible scenes) | Action |
   |---|---|---|
   | **< 3** | — | **Bail.** Tell user the source is too thin for a useful video and ask them to add more facts/context to the .txt before re-running. Do NOT write `images-plan.json`. |
   | 3–4 | hook + 2–3 image scenes (3–4 total) | Tight plan, single arc |
   | 5–7 | hook + 4–6 image scenes (5–7 total) | Standard plan |
   | 8+ | hook + 7–10 image scenes (8+ total) | Full-depth plan |

3. Then apply the per-content-type shapes below — but cap at the band you picked above. A "Top 10" ranking for a thin source is rare, but if a TRANSFER NEWS source supports only 3 distinct points, that wins over the table's "1–2 stat-hero" guidance — go with `hook + 2 image scenes` total.

For each content type, the typical image set (capped by density above):

| Content type | Typical image-eligible scenes |
|---|---|
| RANKING (Top N) | `hook` + N × `stat-hero` (one per item) — N = number of items |
| VS comparison | `hook` + 2 × `stat-hero` (one per side) + 0–1 `callout` |
| MATCH ANALYSIS | `hook` + 2–4 × `callout`/`stat-hero` for key moments |
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

Prompt rules — same as the imagePrompt rules in `/create-video`, slightly expanded because Grok has more capacity than Gemini:

- **Language: English.** Grok handles English prompts much better than Vietnamese.
- **Style:** sports photography, cinematic, photo-realistic, dramatic lighting.
- **Always include:** `"vertical 9:16 portrait composition"` (Grok respects aspect cues).
- **Length:** 50–120 words. Longer prompts give Grok room to nail details.
- **Player likeness — lean on the NAME, not on physical description.** Counter-intuitive lesson from past videos: when you stack "dark skin, square jaw, short braids, full black beard" onto a prompt, Grok averages those features into a *generic* player matching that description — and overrides the actual face it knows from training data. The real likeness comes from the **name + club + national team** (those are the strongest training-data anchors), not from a feature checklist. Rules:
  1. **Lead with the identity anchors.** `"<Full Name>, <Nationality> <position> for <Club> and the <National Team>"` — e.g. `"Virgil van Dijk, the Dutch centre-back and captain for Liverpool and the Netherlands national team"`. Use the name(s) by which the player is most commonly referred to in press coverage (so Grok matches its training labels).
  2. **DO NOT describe facial features.** Skip skin tone, jaw shape, hair style/length/color, beard, eye color, cheekbones, nose, tattoos. Those tokens drag the output toward a generic look matching the description and *away* from the actual player. The model already knows what the named player looks like — let it use that.
  3. **Age/era cue is OK only if it disambiguates.** A short cue like `"in his current 2025–26 era"` or `"during his Real Madrid years"` helps Grok pick the right photo era. Skip it for players with one obvious era.
  4. **Spend the word budget on the SCENE, not the face.** Describe: kit + crest (see Realism block below), pose/action (defending header, sliding tackle, celebrating, walking out of tunnel, lifting trophy, post-match shirt-swap), setting (packed stadium at night, training ground, press conference), lighting (floodlights, fog, golden hour), camera (low-angle, telephoto, shallow depth of field).
  5. **Anchor to broadcasts at the end.** Close with `"professional sports press photography, telephoto realism, matching <League> broadcast photographs"` — e.g. "matching Premier League broadcast photographs" / "Bundesliga broadcast photographs" / "La Liga and Champions League broadcast photographs". This pushes Grok toward real press-agency references.
  6. **Real-name prompting is allowed** — the user has confirmed there are no copyright concerns for this channel.

- **Realism — invite real club iconography, not avoid it.** This is the biggest knob for "looks real, not AI-generic." Earlier prompts said *"no logos, no scoreboards"* — that was wrong. The blanket ban produced sterile, fictional-looking jerseys that screamed AI. Reverse it:
  - **DO request real club crest / logo on the kit** — e.g. `"in a bright red Bayern Munich home kit with the Bayern Munich crest visible on the chest"`, `"in a navy PSG home kit with the Paris Saint-Germain crest on the chest"`, `"in a white Real Madrid home kit with the Real Madrid crest on the chest"`. The image model already has thousands of training photos of these badges; not asking for them is what makes the kit look generic.
  - **DO request supporting iconography** — fans waving club scarves in matching colors, banners with the club crest, club flag draped over a shoulder, a tifo / mosaic in the stands forming the club's name or initials, club mascot on the touchline, club mural on the stadium exterior, kit manufacturer's stripes (e.g. `"three white Adidas stripes on the sleeves"`) when canonical for that club.
  - **DO request real stadium signage that exists in broadcast photos** — facade lettering (`"Allianz Arena"` glowing on the exterior; `"Parc des Princes"` etched above the entrance; `"Camp Nou"` lettering on the stand), well-known landmarks (Old Trafford's red-brick facade, Bernabéu's metallic skin, Anfield's 'This Is Anfield' tunnel sign, Dortmund's Yellow Wall).
  - **Two exceptions — still avoid:**
    - **Scoreboards** showing scores/match-clock/team names. The pipeline overlays its own captions; an in-image scoreboard fights with the on-screen text.
    - **Lower-thirds, broadcaster graphics, text overlays, captions burned into the photo.** Same reason — captions are added in post.
  - Word it explicitly at the end of each prompt: `"the club's real crest visible on the jersey, no scoreboard graphics or text overlays in the image"`.

- **Hook scenes for VS / matchup content — split-frame with both clubs' iconography.** When the video is a matchup (PSG vs Bayern, Messi vs Ronaldo, El Clásico, derby), the hook MUST show both sides. Recipe:
  - Vertical split composition (left half / right half), or two players facing each other on a diagonal.
  - One player from each side **named** in their **real club kit with real crest visible**.
  - Behind each side: their fans in matching colors, club scarves raised, smoke/flares of their colors if it fits the rivalry tone.
  - The competition's real trophy floating between them (UCL trophy with the starball logo, Premier League trophy, World Cup trophy) when the matchup is for that prize.
  - Example skeleton: `"Vertical 9:16 split-frame composition. On the left, <Player A>, <role> for <Club A>, in <Club A's> <home kit color> kit with the <Club A> crest visible on the chest, intense focused expression. On the right, <Player B>, <role> for <Club B>, in <Club B's> <kit color> kit with the <Club B> crest visible on the chest. Behind <A>, fans in <Club A colors> waving <Club A> scarves; behind <B>, fans in <Club B colors> with flares lit. The UEFA Champions League trophy with its starball pattern glowing dimly between them, dramatic floodlight rim-lighting from behind, telephoto realism, photo-realistic press photography. No scoreboard, no text overlays."`

- **Atmospheric / illustrative scenes — variety pool.** Don't default every callout/stat-hero to "player on the pitch." Cinematic videos breathe when you mix in atmosphere. Pull from this pool when picking scene angles (one or two per video, not all):
  - **Ultras / fan tribute** — a packed end of the stadium (Borussia Dortmund's Yellow Wall, PSG's Virage Auteuil, Liverpool's Kop, Boca's Bombonera) with raised scarves, smoke flares of club colors, a giant tifo unfurling.
  - **Tifo / mosaic** — colored cards held up in the stands forming the club crest, a player's face, or a slogan.
  - **Mascot moment** — the club mascot (Bayern's "Berni" the bear, Atlético's mascot, Tottenham's cockerel) on the touchline interacting with kids, or alone in an empty stadium.
  - **Scarf wall / banner** — a wall of fans holding club scarves taut above their heads, or a giant banner reading the club's nickname.
  - **Stadium exterior / landmark** — Allianz Arena's red-glowing facade at night, Camp Nou's facade, Old Trafford's red brick, Bernabéu's metallic exterior, San Siro's spiral towers — match the landmark to the club.
  - **Tunnel / dressing room** — players walking out of the tunnel, a row of jerseys hanging in the dressing room with names visible, a captain's armband on a folded shirt.
  - **Trophy room / press room** — the trophy on a plinth under spotlight, a manager at the press-conference desk with the club crest on the backdrop.
  - **Training ground** — players in training bibs at the club's training centre, coach with tactics board, photographers' camera bank pitchside.
  - **Streetscape / supporter shot** — supporters walking to the ground with scarves over shoulders, club mural on a city wall, neighbourhood pubs in club colors.
  - For each pick, still anchor to the specific club: name the stadium, the section, the tifo content, the mural's subject. "Generic stadium at night" is the boring fallback — use it only when nothing more specific fits.

- **Realism cues — stack these for press-photo feel.** Add 2–3 of these to every scene prompt: `"telephoto realism"`, `"shallow depth of field"`, `"motion blur on the ball"`, `"sharp focus on the subject, soft bokeh in background"`, `"dramatic rim-lighting from stadium floodlights"`, `"atmospheric haze drifting across the pitch"`, `"steam from breath in cold evening air"` (winter games), `"rain streaks visible in the floodlights"` (wet conditions when relevant), `"golden hour side-lighting"` (afternoon kickoffs), `"natural skin texture, no plastic AI smoothness"`, `"35mm or 85mm lens compression"`, `"shot on a Canon/Sony press body"`.

- **"Ảnh chế" / meme scenes — 0–2 per plan when the story invites it.** SportsForAllTV videos work best when they breathe — a humorous "what-if" press photo amplifies a story with built-in irony. Use sparingly but use them. **NOT cartoon — photo-realistic edits that look like real press photos of an impossible scenario.**

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

  **Recipe — write the prompt in photo-realistic press style, but with one specific impossible element:**
  1. **Tag the prompt as humor up front.** Open with `"Cinematic vertical 9:16 portrait sports photograph (humor edit / playful what-if scene)"` so Grok understands the intent.
  2. **Lead with the named subject** the same way as a regular prompt — `"Pep Guardiola, the Spanish manager of Manchester City"`. Don't describe their face.
  3. **Specify ONE impossible element** clearly: the wrong jersey, the wrong scarf, the wrong gesture toward a rival, a comically out-of-place prop. Don't stack three jokes — one clean punchline reads stronger.
  4. **Real club iconography stays accurate** — the joke is funnier when the West Ham crossed-hammers crest is *correctly* on the kit Pep is *wrongly* wearing. Sloppy crest = bad joke.
  5. **Reaction shot in the background** sells it — fans doing a double-take, teammates side-eyeing, a manager facepalming. One ambient reaction is enough.
  6. **Same realism cues** as regular scenes (telephoto, shallow DOF, natural skin texture, 85mm lens, "no plastic AI smoothness"). Photo-realistic, not stylized.
  7. **Same end clause** — `"the club's real crest visible on the jersey, no scoreboard graphics, no on-image text overlays"`.
  8. **subjectHint must mark it as a meme** in Vietnamese — start with `"Ảnh chế —"` or `"Vui —"` so the user sees the comedic intent without re-reading the English prompt. E.g. `"Ảnh chế — Pep mặc áo West Ham, fan City ngỡ ngàng"`.
  9. **Template:** usually `callout` (humor under a punchline statement). Use `hook` only when the meme IS the headline image of the story.

  **Example — Pep cổ vũ West Ham scenario:**
  ```
  Cinematic vertical 9:16 portrait sports photograph (humor edit / playful what-if scene) of Pep Guardiola, the Spanish manager of Manchester City, wearing a claret-and-sky-blue West Ham United home kit with the West Ham crossed-hammers crest clearly visible on the chest, his forearms crossed in front of his chest in the iconic West Ham 'hammers' gesture, a wide grin on his face. Behind him, a packed Etihad Stadium with sky blue Manchester City fans visible in soft bokeh, several front-row supporters doing a double-take with bewildered open-mouthed expressions at his West Ham kit, one fan covering his face with his City scarf in disbelief. Atmospheric haze under bright floodlights, dramatic rim-lighting, telephoto compression, shallow depth of field, sharp focus on Guardiola and the West Ham crest, natural skin texture, no plastic AI smoothness, 85mm lens, photo-realistic press photography style. The West Ham crest visible on the jersey, no scoreboard graphics, no on-image text overlays.
  ```

  **Common pitfalls to avoid:**
  - ❌ Cartoon / illustration style — that breaks the channel's photo-realistic visual identity.
  - ❌ More than one impossible element per image (Pep in West Ham kit + holding the wrong trophy + standing in the wrong stadium = chaotic).
  - ❌ Memes that punch down at a player (mocking a struggling youngster, a serious injury) — SportsForAllTV tone is playful, not cruel.
  - ❌ Putting the joke in voiceText *and* the meme image — let the image carry it; voiceText reports the actual story straight.

Example (Van Dijk) — name-driven, scene-focused, real iconography, realism-stacked:
```
Cinematic vertical 9:16 portrait sports photograph of Virgil van Dijk, the Dutch centre-back and captain for Liverpool and the Netherlands national team, in his current era — wearing a bright red Liverpool home kit with the Liverpool FC Liver-bird crest clearly visible on the chest and the Adidas logo on the right shoulder. He is rising for a defensive header mid-air, ball just leaving his forehead, an attacker in a white away kit half-visible behind him. Anfield-style stadium with the Kop end packed with red-clad fans, scarves raised, the floodlights piercing through atmospheric haze. Telephoto compression, shallow depth of field with the crowd softly bokeh'd, sharp focus on Van Dijk's torso and the ball, motion blur on his shorts, dramatic rim-lighting on his shoulders, natural skin texture. Professional sports press photography, matching Premier League broadcast photographs. No scoreboard graphics, no on-image text overlays.
```

Hook example (PSG vs Bayern UCL knockout) — split-frame matchup hook with real iconography:
```
Cinematic vertical 9:16 split-frame sports photograph of a Champions League knockout matchup. On the left half, Ousmane Dembélé, the French winger for Paris Saint-Germain, in a navy PSG home kit with the Paris Saint-Germain crest in red and white clearly visible on the chest, mid-stride with intense focused expression, the Eiffel Tower silhouetted faintly in the background. On the right half, Harry Kane, the English striker and captain for Bayern Munich, in a bright red Bayern Munich home kit with the Bayern Munich crest visible on the chest, mid-stride mirroring Dembélé, the Allianz Arena's red-glowing exterior facade behind him. Down the centre seam, the UEFA Champions League trophy with its iconic starball pattern hovers under a dramatic spotlight, golden glow. Behind each side, packed stands in club colors — navy and red on the left waving PSG scarves, all-red on the right waving Bayern scarves with flares. Telephoto compression, shallow depth of field, dramatic rim-lighting, atmospheric haze, photo-realistic press photography, matching UEFA Champions League broadcast photographs. No scoreboard, no on-image text overlays.
```

For very young/new players (e.g. teenage debutants), Grok's training data may be thin → likeness will be weaker even with the name. Still rely on the name; do NOT compensate with feature descriptions (that makes it worse). Warn the user in the summary that this player may need extra re-rolls.
- **Variety:** don't make every player scene a "celebrating goal" shot. Mix from the variety pool above + on-pitch action types: defending, leading the line, in the tunnel, lifting a trophy, post-match shirt-swap, mascot leading kids out, fans' tifo etc. Variety keeps the video visually interesting.
- **Length update:** with the realism + iconography blocks added, prompts will run longer — **80–180 words is now the target** (was 50–120). Grok handles this length well; the extra detail is what lifts the output from generic-AI to press-photo realism.

`subjectHint` field (Vietnamese OK): a one-line note for the user about who/what this image is, e.g. `"Virgil van Dijk — Liverpool"`. Helps the user remember which prompt is for which item without re-reading the English prompt.

### Step 6: Detect orphans from a previous plan

If `images-plan.json` already exists at the target path:
1. Read the existing plan.
2. Compare its filenames to the new plan's filenames.
3. Any filename in the OLD plan but not in the NEW plan → list as "orphan" (user should delete from input folder after re-running, since they won't be used).

### Step 7: Write images-plan.json + grok-prompts.md

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
      "subjectHint": "Hero shot 7 trung vệ — không khí UCL knockout",
      "prompt": "Cinematic vertical 9:16 portrait sports photograph of a low-angle hero composition: a single elite centre-back stands tall in the middle of a packed European stadium pitch at night, captain's armband visible, club crest clearly readable on the chest of his home kit, fans behind him raising scarves of his club's colors, a giant tifo banner reading the club's name unfurled on the far end of the stadium, dramatic floodlights piercing through atmospheric haze and faint smoke from flares, telephoto compression, shallow depth of field with the crowd softly bokeh'd, sharp focus on the defender's torso, dramatic rim-lighting, natural skin texture, photo-realistic press photography, matching UEFA Champions League broadcast photographs. No scoreboard, no on-image text overlays."
    },
    {
      "id": "cb-1",
      "template": "stat-hero",
      "filename": "cb-1.png",
      "subjectHint": "Virgil van Dijk — Liverpool",
      "prompt": "Cinematic vertical 9:16 portrait sports photograph of Virgil van Dijk, the Dutch centre-back and captain for Liverpool and the Netherlands national team, wearing a bright red Liverpool home kit with the Liverpool FC Liver-bird crest clearly visible on the chest and the captain's armband on his left arm. He is rising for a defensive header mid-air at Anfield, ball just leaving his forehead, an attacker in a white away kit half-visible behind him. The Kop end packed with red-clad fans waving Liverpool scarves, floodlights piercing through atmospheric haze. Telephoto compression, shallow depth of field, sharp focus on Van Dijk and the ball, motion blur on his shorts, dramatic rim-lighting, natural skin texture. Professional sports press photography, matching Premier League broadcast photographs. No scoreboard, no on-image text overlays."
    }
  ]
}
```

Two files, both written to the same directory as the source .txt:

1. **`images-plan.json`** — machine-readable plan, validated by `src/image/plan-schema.ts`. This is what `/create-video` and `npm run images:stage` consume.
2. **`grok-prompts.md`** — copy-paste-friendly version for the user. Each prompt in a fenced markdown code block (so editors render a copy button), with a clear header per scene including the planned filename and Vietnamese subjectHint. Format:

```markdown
# Grok prompts — <title>

8 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

---

## [1] hook → `hook.png`

**Subject:** <subjectHint>

​```
<full english prompt>
​```

---

## [2] cb-1 → `cb-1.png` — #1 <Player Name> (<Club>)

**Subject:** <subjectHint>

​```
<full english prompt>
​```

... (one block per scene) ...

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở `<N>` tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **`<N>` tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào folder này (`input/<slug>/`) với stem đúng như file đã ghi (`hook`, `cb-1`, ...).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
4. Khi đủ `<N>` ảnh, chạy: `/create-video input/<slug>/<slug>.txt`
```

The "## [N] sceneId → filename" header should also include the player's name + club when the scene depicts a specific person (e.g. RANKING items, VS sides, PLAYER PROFILE chapters). For atmosphere-only scenes (hook in many cases), just the sceneId/filename is fine.

### Step 8: Reply concisely

Do NOT dump the prompts into the chat — they are already in `grok-prompts.md` for the user to copy from. Reply with a short confirmation only:

```
✓ Plan: input/<slug>/images-plan.json
✓ Prompts: input/<slug>/grok-prompts.md (mở file này để copy)
<N> ảnh cần tạo (1 hook + N CB / N item / ...).

⚠ Orphan từ plan cũ (xóa sau):  ← only if any
  • old-cb-8.png
```

If the user wants to inspect or tweak prompts, they open `grok-prompts.md`. If they want to re-run the skill (e.g. they changed the source .txt), just regenerate both files.

## What this skill does NOT do

- Does not generate images itself — you produce the plan, the user produces the images.
- Does not write `script.json` — that's `/create-video`'s job.
- Does not run the pipeline.
- Does not delete orphan files automatically — only flags them.

## Edge cases

- **Source txt too short to support N scenes:** classify-football-content will note low confidence. Generate a smaller plan (fewer items) and tell the user.
- **Plan would have 0 image-eligible scenes:** rare (every video has at least a hook). If it happens, write the plan with just `hook` and tell the user.
- **User runs the skill twice on the same .txt:** overwrite the plan, list orphans from the old plan in the summary.
