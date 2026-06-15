---
name: create-video
description: Build a Vietnamese 9:16 motion-graphic football video from a `.txt` source file (and an optional images-plan.json next to it). Length and scene count scale automatically to the source's content density — short sources produce short videos, rich sources produce long videos. Supports match analysis, list/ranking, VS comparisons, history/career, transfer news, pre-match preview, player profile, and trivia content. The user-facing slash command is `/create-video <path-to-source.txt>`.
---

# Create Video Skill

Build a Vietnamese 9:16 motion-graphic football video from a `.txt` source file.

This is the unified video-builder for the SportsForAllTV channel — replacing the older split between `/create-news-video` and `/create-analysis-video`. Both flows now converge here:

- **File flow:** user runs `/images-for-videos <file.txt>` → user generates planned images on grok.com → user runs **`/create-video <file.txt>`** → script + render.
- **URL flow:** user runs `/read-rewrite <url>` (which fetches, rewrites, chains into `/images-for-videos`) → user generates images → user runs **`/create-video <file.txt>`** → script + render.

Length scales to the source's actual content density — **don't pad a thin source to hit a quota**:

- **6–15 scenes, 45–180s, scaled by distinct substantive points in the source:**
  - 3–4 distinct points → 6–8 scenes / 45–75s
  - 5–7 distinct points → 8–11 scenes / 75–120s
  - 8+ distinct points → 11–15 scenes / 120–180s
  - **< 3 distinct points → bail. Tell the user the source is too thin for a useful video and ask for more material; do NOT generate a script.**

A "distinct substantive point" = an independent fact/claim worth its own scene. Restating something said earlier doesn't count. Padding to hit a longer duration than the source supports is a worse video than a tight short one — Vietnamese short-form viewers swipe away when later scenes don't add new information.

## Input

Single argument: a path to a `.txt` source file. The directory containing the .txt is the input folder; an optional `images-plan.json` may sit next to the .txt (created earlier by `/images-for-videos`). For URL sources, route through `/read-rewrite <url>` first — this skill does not fetch URLs directly.

**Default input folder (as of 2026-05-23):** new motion-graphic football content lives under `video/input/<slug>/`. Podcast inputs live under `podcast/input/<slug>/` (`/create-podcast`'s territory, not this skill). Legacy folders directly under `input/<slug>/` are still accepted — the skill resolves any path the user passes, and the slug-from-folder logic in Step 3 handles both layouts.

## Content types this skill handles

| Type | Example topic | Dominant templates |
|---|---|---|
| Match analysis | "Phân tích chiến thuật Arsenal vs Real Madrid CK C1" | callout, stat-hero, comparison |
| List / Ranking | "Top 10 Vua phá lưới Châu Âu", "5 chuyển nhượng đắt nhất 2026" | stat-hero (per item), callout |
| VS comparison | "Messi vs Ronaldo: Ai vĩ đại hơn?" | comparison (heavy), stat-hero |
| Player profile (stats deep-dive) | "Bruno Fernandes mùa giải 2025-26 — số liệu chi tiết" | stat-hero, comparison, feature-list |
| Pre-match preview | "Đội hình dự kiến Real vs Bayern", "Squad reveal World Cup" | formation-pitch, callout, comparison |
| Transfer news | "Bom tấn: Mbappe đến Real", "Tin chuyển nhượng tuần này" | stat-hero, callout, comparison |
| Trivia / Did-you-know | "5 kỷ lục lạ lùng nhất Premier League" | callout, stat-hero |
| Player biography | "Hành trình Modric: Từ chiến tranh đến QBV" | timeline, stat-hero, callout |
| Club / national-team / tournament history | "100 năm Real Madrid", "Lịch sử tuyển Brazil qua các kỳ WC", "Champions League qua các thời kỳ" | timeline, stat-hero, callout |

Bio + history content uses the same image-based motion-graphic pipeline as the rest of `/create-video` (AI poster images per scene, NOT real archival footage). Treat a BIO-PLAYER source as a long-form PLAYER PROFILE with career milestones as the dominant pattern; treat a HISTORY-* source as era / edition-based with timeline + stat-hero scenes (one scene per era / dynasty / edition rather than chapter-based prose). Density rules apply normally — a single video tops out at 11–15 scenes / 180s. For bios with material for 20+ scenes, split the source into Phần 1 / Phần 2 `.txt` files manually and run `/create-video` on each part.

## Plan-mode vs free-form mode

Before doing anything else, check if the source .txt has a sibling `images-plan.json` (i.e. `dirname(txtPath)/images-plan.json` exists). The presence of that file unlocks **plan mode**:

| | Plan mode (preferred — visual-first workflow) | Free-form mode (fallback) |
|---|---|---|
| Trigger | `images-plan.json` exists next to source .txt | No plan file — user skipped `/images-for-videos` |
| Output dir | `video/output/<slug>/` (no timestamp) | `video/output/<slug>-<timestamp>/` |
| sceneIds | **MUST match** plan's `scenes[].id` exactly | Free-choice (`hook`, `rank-1`, …) |
| imagePrompt | Copy plan's `prompt` verbatim into the matching scene | Generated by Claude |
| Image source | Pre-staged from input folder via `npm run images:stage` | Generated at pipeline runtime by Gemini/OpenAI/xAI |
| If image missing | **Halt** — `npm run images:stage` exits non-zero, report missing files to user | Pipeline falls back to gradient |

User is on the visual-first track when they ran `/images-for-videos` first. Respect their plan — do not reshuffle scenes, drop scenes the plan declared, or invent new image-eligible scenes the plan didn't anticipate. The plan is the contract.

When in plan mode, you may STILL add non-image-eligible scenes that the plan didn't include (e.g., a `feature-list` summary, a `comparison` card) — those don't need plan entries. The plan only governs scenes whose template is `hook` / `stat-hero` / `callout`.

## Workflow (MUST follow these steps in order)

### Step 1: Validate input

- Single argument must be a path to an existing `.txt` file.
- If user passed a URL → reject with: `"Skill này nhận file .txt. Với URL bài báo, dùng /read-rewrite <url> trước, rồi quay lại chạy /create-video trên file .txt nó tạo ra."`
- If user passed a non-existent path or a non-.txt file → reject with a clear message.
- If file exists, proceed to Step 1.5.

### Step 1.5: Detect multi-part context + long-source guardrail

The `/images-for-videos` skill auto-splits long sources (≥ 4 000 chars) into N child folders `video/input/<base-slug>-p1/`, `<base-slug>-p2/`, …, each with its own `.txt` + `images-plan.json`. This step decides which mode `/create-video` is operating in.

1. **Resolve the part marker.** Parse the parent-folder name of the source `.txt`:
   - Pattern: `<base-slug>-p<N>` where N is a positive integer → this is a multi-part render. Set `partN = N`, `baseSlug = <base-slug>`.
   - Otherwise → single-video render. Skip the rest of this step.
2. **Detect non-final part.** Check whether sibling folder `video/input/<baseSlug>-p<N+1>/` exists. If it exists → this is a **non-final part**. Otherwise → **final part** (or the only part if N=1 and no -p2 sibling exists).
3. **Long-source guardrail (single-video mode only — i.e. step 1 set no part marker).** Read the .txt char count:
   - If chars < 4 000 → continue normally to Step 2.
   - If chars ≥ 4 000 AND `images-plan.json` does NOT exist at the source folder → **halt** with this exact message: `"Source này dài <X> chars (≥4000) — nên split thành nhiều phần. Chạy /images-for-videos <txt-path> trước, skill sẽ tự split + tạo plan ảnh per part, sau đó chạy /create-video cho từng <slug>-pN.txt."`. Do NOT proceed to script generation. The split logic lives in one place (`/images-for-videos`); don't duplicate it here.
   - If chars ≥ 4 000 AND `images-plan.json` DOES exist at the source folder → continue normally (user has explicitly built a single-video plan for the long source; trust them). Note: plan-mode floor still applies — every plan scene must be in the script.
4. **For multi-part renders, the slug rule becomes:**
   - outputDir = `video/output/<baseSlug>-p<partN>/` (still no timestamp, idempotent overwrite).
   - The script's `title` field carries `— Phần <N>` suffix (mirroring what `/images-for-videos` wrote into the part .txt's title line).
   - Density rules (Step 2.4) apply to THIS PART's prose only — each part is its own 6–15 scenes / 45–180s video.
5. **For non-final parts**, the closing 2 scenes change — see Step 4 "Multi-part outro override" below. Final parts (or single-video renders) use the standard engagement-question + outro pair.

### Step 2: Gather source material

⚠️ **First: classify the content using the [`classify-football-content`](../classify-football-content/SKILL.md) skill.** It defines 8 canonical types (RANKING, VS, MATCH ANALYSIS, PRE-MATCH PREVIEW, PLAYER PROFILE, HISTORY/CAREER, TRANSFER NEWS, TRIVIA), each with detection signals (filename + body cues), proposed scene structure, voice tone, and hook patterns. Read it before structuring the script — it's the single source of truth for "what shape should this video take".

After classification:

1. **`Read` the entire file.** Don't truncate — analysis files often contain many stats and context you'll need.
2. **Apply the type's structure** from the classifier (scene count, template sequence, voice tone). Don't invent a custom structure unless the file clearly doesn't fit any type.
3. **Extract facts:** pull out every concrete number, date, name, achievement. These become `stat-hero` values, `comparison` values, or `callout` claims.
4. **⚠️ Count "distinct substantive points" — pre-flight density check (MANDATORY):**

   Before writing any scenes, count how many *independent* facts/claims the source supports — each one a thing that earns its own scene without restating earlier material.

   | Content type | What counts as one point |
   |---|---|
   | RANKING | Each ranked item |
   | VS | Each compared metric (goals, trophies, h2h, style, etc.) |
   | MATCH ANALYSIS | Each tactical insight, key moment, or stat block |
   | PRE-MATCH PREVIEW | Each: stakes / h2h record / key matchup / lineup-impact / prediction |
   | PLAYER PROFILE | Each: career era, achievement category, signature trait |
   | HISTORY/CAREER | Each milestone or era chapter |
   | TRANSFER NEWS | Each: fee / origin-destination / why-now / tactical fit / reaction |
   | TRIVIA | Each fact |

   Then map count → target length and **stop here if too thin**:

   | Distinct points | Scenes (incl. hook+outro) | Voice duration | Action |
   |---|---|---|---|
   | **< 3** | — | — | **Bail.** Tell user the source is too thin for a useful video and ask them to add more facts/context. Do NOT proceed to write a script. |
   | 3–4 | 6–8 | 45–75s | Tight short-form, single-arc structure |
   | 5–7 | 8–11 | 75–120s | Standard mid-form |
   | 8+ | 11–15 | 120–180s | Full-depth long-form |

   When in plan mode (images-plan.json exists), the plan's image-eligible scene count is your floor — don't go below it. If the plan declared 6 image scenes but the source only supports 3 distinct points, surface the mismatch to the user before writing the script (they should re-run `/images-for-videos` first).

5. **Restructure for spoken video:** the file content is written for reading, but the video is heard. Rewrite for spoken Vietnamese:
   - Break long sentences into short ones (1–2 sentences per scene voiceText).
   - Convert formal text to văn nói (spoken style).
   - Apply phonetic rules (numbers spelled out — see Step 4 "Vietnamese TTS Phonetic Rules" below).
   - Drop tangential paragraphs that don't fit the target duration from Step 2.4.
6. **Polish & fact-check sparingly:** if the user's file states something you know to be wrong (e.g. wrong score, wrong year), fix it silently and proceed. If a key claim is unverifiable, soften the wording rather than echoing as definitive.
7. **Set metadata:**
   - `title` = best summary (max 80 chars). Derive from filename + content if no explicit title.
   - `source.url` = `"local"`, `source.domain` = `"local"`, `source.image` = `null`.
   - Hook scene gets `imagePrompt` either copied from the plan (plan mode) or generated by you (free-form mode).

### Step 3: Create slug + output directory

**Plan mode** (images-plan.json exists next to source .txt):
- slug = parent folder name of the .txt (e.g. `video/input/topCBsITW/topCBsITW.txt` → slug = `topCBsITW`; legacy `input/topCBsITW/topCBsITW.txt` → slug = `topCBsITW` also works). Falls back to file stem when txt isn't in a subfolder.
- outputDir = `video/output/<slug>/` — **no timestamp suffix**, reruns overwrite for idempotency.
- `mkdir -p <outputDir>`

**Free-form mode** (no plan file):
- slug = lowercase ASCII (strip Vietnamese diacritics, đ→d), replace non-alphanumeric with `-`, max 50 chars (analysis topics are longer than news)
- timestamp = current local time as `YYYYMMDD-HHmm`
- outputDir = `video/output/<slug>-<timestamp>/`
- `mkdir -p <outputDir>`

### Step 4: Generate script.json

**Schema:** see `src/render/script-schema.ts`. Density-scaled targets (see Step 2.4):

| Distinct points | Scene count | Total words | Words/scene | Total duration |
|---|---|---|---|---|
| 3–4 | 6–8 | 150–250 | 30–45 | 45–75s |
| 5–7 | 8–11 | 250–400 | 30–45 | 75–120s |
| 8+ | 11–15 | 400–600 | 30–45 | 120–180s |

⚠️ **`imagePrompt` is REQUIRED on every `hook` / `callout` / `stat-hero` scene** — even in plan mode with all images pre-staged. The image pipeline filters scenes by `imagePrompt` BEFORE checking manual overrides, so a scene without `imagePrompt` will have its staged image silently dropped and render with a gradient fallback (looks like "missing images" — see `memory/feedback_image_override_needs_imageprompt.md`). In plan mode, copy the prompt verbatim from `images-plan.json` into the corresponding scene. Use a Node helper if there are many scenes to copy — don't inline the prompts manually if it explodes the script.

⚠️ **Don't pad.** Hitting the lower bound for thin content is correct. Hitting the upper bound for rich content is correct. Hitting the upper bound for thin content (padding) is wrong — viewers swipe.

⚠️ **Voice speed defaults by content type:**
- **News, RANKING, MATCH ANALYSIS, TRANSFER, TRIVIA, PRE-MATCH PREVIEW, PLAYER PROFILE, VS** → `"voice": { "provider": "ausynclab", "voiceId": "1914439", "speed": 0.90 }`. AusyncLab `speed` is a duration multiplier (verified `src/tts/ausynclab-client.ts` L58), so `0.90 = 10 % FASTER` playback — fits info-dense content. Floor `0.85`; below that rhythm breaks.
- **BIO-PLAYER, HISTORY-*** → `"voice": { ..., "speed": 1.0 }`. Storytelling tone benefits from reference-rate delivery (year/age openers, reflective cadence).
- If a user later complains the voice is now too fast → flip to `0.95` then `1.0`; never push above 1.05 for news.
- Tail-eating watch: dynaudnorm per-scene is on by default. If a scene still eats tail consonants, rephrase the ending to avoid soft-consonant closes like `…ng.` / `…nh.` — use stronger closes (`…tốt.`, `…trên sân.`, `…ngày nay.`). See `memory/feedback_voice_speed_news_faster_bio_slower.md`.

⚠️ **Write RICH, not summary — 1–2 sentences is a MINIMUM, not a target.** When the source supports it (URL articles, bio chapters, deep-dive analyses), each body scene's `voiceText` should be **3–5 sentences** with specific detail, comparison framing, journalistic color, and micro-context (the year, the rival, the stakes, the quote). The "1–2 câu/scene" guidance in this skill is for thin sources — info-rich sources deserve denser voiceText per scene. Per-scene voice duration 8–12s is comfortable, not too long. Better 130s of dense content than 60s of thin recap. See `memory/feedback_script_rich_not_summary.md`.

Before writing each scene's voiceText, list out: (a) the load-bearing fact, (b) 1–2 supporting details from the source, (c) 1 contextual layer (rival / era / stakes / quote). Only then write the voiceText — that ensures all three layers land.

**⚠️ CRITICAL: Journalistic voice — write like a VN football journalist, not an explainer**

SportsForAllTV writes for VN football fans who follow the sport seriously — they read Goal Vietnam, Vnexpress thể thao, Sky Sports VN, listen to bình luận viên on TV (Quang Tùng, Anh Ngọc, Vũ Quang Huy). **Mọi `voiceText` và visible `templateData` text phải đọc như một nhà báo thể thao chuyên nghiệp viết**, không phải explainer cho người mới biết bóng đá. Lexicon phổ thông + cấu trúc giải-thích kéo brand authority xuống. Bộ rules dưới đây áp đồng thời với phonetic rules (ngay sau).

#### A. Lexicon — thuật ngữ chuyên thay văn phổ thông

Bộ swap mặc định khi viết voiceText / templateData. Đây là rút gọn — chi tiết + lý do trong `memory/feedback_football_lexicon.md`:

| Tránh (phổ thông) | Dùng (chuyên) | Note |
|---|---|---|
| đường chuyền giấu | lừa hướng / chọc khe lừa hướng | "disguised pass" |
| xuyên tuyến | chọc khe | "through-ball" |
| kiến tạo (n.) | pha kiến tạo | đếm rõ hơn |
| cơ hội tạo ra cho đồng đội | pha kiến tạo cơ hội | "chances created" |
| đặt bóng vào đúng chỗ | đặt điểm rơi | sport idiom |
| số 10 (mô tả style/role) | nhạc trưởng | playmaker idiom VN |
| tham gia bàn thắng | pha tham gia bàn thắng | "goal involvement" |
| đặc biệt | có chữ ký riêng / độc nhất | sport-narrative |
| trận đầu dưới HLV X | trận đầu cầm quân của X | "cầm quân" idiom |
| key pass (nguyên gốc Anh) | đường chuyền chìa khoá / pass tạo cú dứt điểm | dịch trực tiếp dùng được |
| đội bóng / CLB (lặp lại) | nickname club: Quỷ Đỏ (MU), Pháo Thủ (Arsenal), Gà Trống (Spurs), Lữ đoàn đỏ (Liverpool), Hùm xám (Bayern), Vua trắng (Real), Á thánh (Barca) | đa dạng hoá khi bị repeat |
| đội trưởng (lặp lại) | đội trưởng + nickname club ("đội trưởng Quỷ Đỏ") | đa dạng |

#### B. Sentence construction — patterns nhà báo VN dùng

- **Lead với fact, không cảm thán.** ✅ "Mười chín pha kiến tạo. Kém kỷ lục đúng một đường chuyền." ❌ "Bruno đang có một mùa giải tuyệt vời với rất nhiều kiến tạo..."
- **Active voice.** ✅ "Bruno chọc khe cho Mbeumo." ❌ "Một đường chuyền được Bruno thực hiện cho Mbeumo."
- **Specific > generic.** Đừng dùng "đặc biệt", "tuyệt vời", "ấn tượng" alone — back ngay bằng số liệu hoặc hành vi cụ thể. ✅ "Ấn tượng nhất: 120 pha kiến tạo cơ hội, gần gấp đôi #2." ❌ "Bruno đang chơi một mùa giải ấn tượng."
- **Attribution rõ.** "Theo Opta", "theo Sky Sports", "Cunha nói" — câu chứa số liệu hoặc trích dẫn cần nguồn. Một câu một nguồn, không pha trộn.
- **Câu ngắn — một ý / câu.** Câu ghép nhiều mệnh đề pha loãng emphasis. ✅ "Carrick lên thay. Bruno về số 10 cổ điển. Hồi sinh ngay trận đầu." ❌ "Sau khi Amorim bị sa thải và Carrick lên thay thì Bruno đã được trả về vị trí số 10 ưa thích nên đã hồi sinh."
- **Past + present interplay.** Sự kiện ở quá khứ + câu hỏi/trạng thái ở hiện tại tạo nhịp. ✅ "Bruno đã đoạt giải. Nhưng cuộc đua kỷ lục vẫn còn 1 đường chuyền."

#### C. Tropes nhà báo VN dùng (xài có chủ đích, không nhồi)

- "Tâm điểm chú ý" — focal point của trận / mùa
- "Cột mốc" / "cột mốc cá nhân" — milestone framing
- "Trong bối cảnh..." — chỉ khi sau đó có context cụ thể, không treo lửng
- "Sở trường" / "thế mạnh" — for player traits
- "Án ngữ" / "kèm cặp" / "khắc chế" — defensive technical
- "Đặt dấu ấn" / "ghi dấu ấn" — individual brilliance
- "Khoảnh khắc kinh điển" / "pha xử lý đẳng cấp" — for highlight moments

#### D. Tropes to avoid (đồng bộ với `/refine-txt` anti-cliché list)

- ❌ "Có thể nói rằng..." / "Phải nói rằng..." / "Không thể phủ nhận" — câu chữ thừa, cắt thẳng vào fact
- ❌ "Đáng chú ý là..." / "Câu hỏi đặt ra là..." — old-school journalism padding
- ❌ "Tình hình hiện tại" / "Mới đây" / "Theo nguồn tin" — generic openers, đốt 5-7 từ không thông tin
- ❌ "Tuyệt vời" / "đỉnh cao" / "cực kỳ ấn tượng" / "thực sự" / "vô cùng" / "đặc biệt" alone — generic adjectives = nhạt
- ❌ "Chấn động" / "không thể tin nổi" / "sốc" — clickbait, dùng chỉ khi event thật sự xứng (đoạt cup, kỷ lục thế giới, scandal lớn)
- ❌ Quá nhiều em dash ngang câu — sparingly, 1 cái/scene voiceText tối đa
- ❌ "Như chúng ta đã biết..." — patronizing
- ❌ Văn "em / mình / bạn" — voice là 3rd person trừ outro CTA ("Theo dõi Sports For All Ti Vi...")
- ❌ **Doubling "nhiều / nhiều hơn"** — câu kiểu *"Anh thực hiện nhiều đường chuyền X nhiều hơn ai"* / *"Bruno tạo ra nhiều A nhiều hơn #2"* dính 2 từ "nhiều" liền — đọc lằng nhằng. Cách viết đúng:
  - ✅ "Anh dẫn đầu Ngoại hạng Anh về X." (dùng "dẫn đầu giải" thay "nhiều ... nhiều hơn")
  - ✅ "Anh thực hiện X nhiều nhất giải." (chỉ một "nhiều", thêm "nhất")
  - ✅ "Số đường X của Bruno gấp đôi #2." (rephrase thành so sánh số học)
  - ✅ "Bruno chọc khe nhiều hơn #2 đến 50%." (chỉ một "nhiều")
- ❌ **Doubling khác** — "rất ... rất", "đã ... đã", "không ... không" trong cùng câu. Đọc thử thành tiếng — nếu lặp âm "nhiều / rất / đã" 2 lần trong 10 từ → rephrase.

#### E. Vietnamese ambiguity & natural-phrasing filter — đọc lên thành tiếng trước khi save

Mỗi `voiceText` PHẢI đi qua một pass đọc-lên-thành-tiếng (mental TTS) để check xem câu có parse 2 nghĩa không, có hợp lý không, người nghe có theo được không. Đây không phải bước tuỳ chọn — script này dùng TTS đọc cho người nghe, nên parse-ambiguity = video fail. Rule cụ thể:

1. **Tránh `phải` làm body-side qualifier** (đầu gối phải, chân phải, vai phải) — modal `phải` (must/have to) collide với qualifier `phải` (right side). Người đọc/TTS sẽ parse câu theo modal trước.
   - ❌ `"dây chằng đầu gối phải đứt"` ← parse mặc định: "knee MUST tear" thay vì "right-knee tore"
   - ✅ `"dây chằng đầu gối bên phải bị đứt"` (rõ qualifier + bị)
   - ✅ `"anh bị đứt dây chằng đầu gối"` (drop side info, dùng `bị`)
   - ✅ `"chân thuận / chân không thuận"` (idiomatic VN football, không cần "phải/trái")
2. **Dùng `bị` cho unfortunate passive events** (chấn thương, đứt, gãy, treo giò, dính thẻ đỏ, mất điểm):
   - ✅ `anh bị đứt dây chằng` / `anh dính chấn thương dây chằng`
   - ❌ `dây chằng đứt` (subject-less, nghe như báo cáo lạnh lùng, không có người chịu)
3. **Sentence fragments cần explicit subject** khi nối tiếp từ câu trước:
   - ❌ `"Đứt dây chằng cuối 2023. Mổ sụn chêm tháng 12."` ← chủ ngữ mờ
   - ✅ `"Anh đứt dây chằng cuối 2023. Mổ sụn chêm tháng 12."` (subject set, carry over)
4. **Quote 1st person ("tôi/mình") phải có signal verb** — không để pronouns nhảy đột ngột:
   - ❌ `"Ancelotti dứt khoát. Tôi không phải nhà ảo thuật."` ← "tôi" là ai?
   - ✅ `"Ancelotti nói thẳng: ông không phải nhà ảo thuật."` (giữ 3rd person — preferred trong news voice)
   - ✅ `"HLV người Ý nói: 'Tôi không phải nhà ảo thuật.'"` (rõ ràng là quote)
5. **Possessive `của` xa subject — dễ ambiguous** (sở hữu vs đại diện):
   - ❌ `"Brazil của Neymar đã vào bán kết"` ← Brazil thuộc Neymar?
   - ✅ `"Brazil cùng Neymar vào bán kết"` / `"Selecao có Neymar trong đội hình"`
6. **`hơn cả X` vs `hơn X`** — `cả` thừa khi không nhấn:
   - ❌ `"hơn cả Pele 2 bàn"` ← `cả` không đem nghĩa gì
   - ✅ `"hơn Pele 2 bàn"` / `"vượt Pele đúng 2 bàn"`
7. **Tránh "Tôi không phải X" + "Tôi đã Y" kề nhau** — 2 lần "tôi" gần nhau gây trùng âm:
   - ❌ `"Tôi không phải nhà ảo thuật. Tôi đã làm bóng đá 40 năm."`
   - ✅ `"Ông không phải nhà ảo thuật. 40 năm trong nghề đã chứng minh điều đó."`

#### F. Self-check trước khi finalize

Trước khi `Write` script.json, đọc lại từng `voiceText` và hỏi:
1. **Có cụm phổ thông nào trong bảng A không?** Swap.
2. **Có câu nào passive không?** Active hoá (trừ khi diễn tả chấn thương / sự cố — dùng `bị` per rule E.2).
3. **Có "đặc biệt / tuyệt vời" treo lửng không specific theo sau?** Cụ thể hoá hoặc cắt.
4. **Có lặp tên CLB / cầu thủ ≥3 lần?** Thay 1 lần bằng nickname.
5. **Câu dài >25 từ một mệnh đề?** Tách 2 câu.
6. **(NEW) Đọc lên thành tiếng — câu nào parse 2 nghĩa khi nghe?** Rephrase per E.1-E.7.
7. **(NEW) Mỗi `phải` trong voiceText: là modal (must), body-side, hay copula negation (`không phải`)?** Nếu body-side → swap qualifier rõ hơn hoặc drop side info.
8. **(NEW) Mỗi fragment-style sentence: subject có rõ từ context không?** Nếu không, thêm `anh` / `đội` / tên cụ thể.
9. **(NEW) Quote (1st person 'tôi/mình'): có signal verb ("nói", ":", "...") không?** Nếu không, reframe 3rd person.

Nếu pass cả 9 → tone đã chuyên. Bài đọc ra phải nghe như Sky Sports VN read out, không phải Wikipedia VN read out.

**⚠️ CRITICAL: Vietnamese TTS Phonetic Rules**

The `voiceText` field is read aloud by AusyncLab Vietnamese TTS (default, paid — `myna-1-turbo` voice `1914439`) or VieNeu (free fallback). **Numbers and symbols are read literally** — if you write "5.5", TTS may say "năm rưỡi" (five and a half). The `templateData` fields (visual text on screen) keep the original "5.5" / "82.7%" formatting — visual is separate from spoken.

**⚠️ Default to DIGIT FORM for whole-number quantities + Vietnamese unit** (years, ages, dates, counts, scores). AusyncLab + myna-1-turbo reads `26 cầu thủ` / `năm 2026` / `tháng 10 năm 2023` / `79 bàn` / `40 năm` cleanly — and avoids the "đọc hụt" (eats syllables) bug user hits on long spelled-out cụm như `hai nghìn không trăm hai mươi sáu`. **Only spell out** when there's a real phonetic ambiguity to resolve (decimals → `chấm/phẩy`, scores → `ba so với một`, brand version numbers).

| Number form | Visible (templateData) | voiceText — preferred for AusyncLab |
|---|---|---|
| Year | `2026` | `năm 2026` (digit form, easy parse) |
| Date | `14/6` | `ngày 14 tháng 6` (digit form) |
| Year + date | `17/10/2023` | `ngày 17 tháng 10 năm 2023` |
| Age | `34 tuổi` | `34 tuổi` |
| Count + unit | `26 cầu thủ` / `79 bàn` / `40 năm` | `26 cầu thủ` / `79 bàn` / `40 năm` — digit form |
| Score | `3-1` / `0-2` | `ba một` / `không hai` — MUST spell. A hyphen between digits is read as the minus word "trừ" (`3-1` → "ba TRỪ một") |
| Formation | `4-2-3-1` / `4-3-3` | `bốn hai ba một` / `bốn ba ba` — MUST spell. Same hyphen-as-"trừ" bug (`4-2-3-1` → "bốn TRỪ hai TRỪ ba TRỪ một"). The visible `formation` field keeps digits |
| Decimal | `82.7%` | `tám mươi hai phẩy bảy phần trăm` (MUST spell — decimals read wrong) |
| Decimal version | `iOS 18.2` | `iOS mười tám chấm hai` (MUST spell) |
| Money | `€80M` | `80 triệu euro` (digit + spelled unit) |
| USD | `$5` | `5 đô` (digit + Vietnamese-shortened unit) |
| Percentage | `30%` | `30 phần trăm` (digit + spelled unit) |
| Multiplier | `2x` | `gấp đôi` (more natural than "hai lần") |
| Time | `60 giây` | `60 giây` |
| Height | `1m93` | `một mét chín mươi ba` (compound height — spell) |
| Rank | `#1` / `#7` | `hạng 1` / `hạng 7` (drop `#` symbol) |

**⚠️ Vietnamese-specific number-word collisions to handle in voiceText:**

1. **`năm` homophone (= year + 5)** — `bốn mươi năm` (40 years) gets read as "bốn mươi lăm" (45). **Fix: use digit form `40 năm`**. Triggers any spelled `X mươi/chục năm` followed by anything meaning "years". Detail: `memory/feedback_vietnamese_homophone_nam.md`.
2. **Long compound spelled numbers** — AusyncLab eats syllables in `hai nghìn không trăm hai mươi sáu` style. Always prefer `2026` or `năm 2026`.
3. **⚠️ Hyphen between digits is read as "trừ" (minus) — NEVER leave `X-Y` digit forms in voiceText.** This is a confirmed AusyncLab bug (2026-06-15): a scoreline `2-1` reads "hai TRỪ một" and a formation `4-2-3-1` reads "bốn TRỪ hai TRỪ ba TRỪ một". ALWAYS spell them as space-separated words in voiceText — scores `2-1` → `hai một`, `1-0` → `một không`, `10-0` → `mười không`; formations `4-2-3-1` → `bốn hai ba một`, `3-4-3` → `ba bốn ba`. Better still for match-results boards: drop the score from the spoken line entirely (narrative color only — the board shows the digits). The visible `templateData` fields (`bigStat`, `formation`, `match-results` scores, `comparison.value`) keep the digit/hyphen form. Detail: `memory/feedback_voicetext_hyphen_reads_as_minus.md`.

**Notation choices:**
- Decimal point — use `chấm` (more spoken/natural) or `phẩy` (formal). Pick one and stay consistent.
- Comma separator — use `phẩy` (e.g. "1,000" → "một nghìn").
- Ratio "3:1" — say `ba trên một` or `ba so với một`.

**Brand names + acronyms:**
- English brand names usually OK as-is: `Manchester United`, `Real Madrid`, `Barcelona`, `Champions League`, `Premier League` ✅.
- **Vietnamese acronyms & abbreviations (`HLV`, `CLB`, `BLV`, `WC`, `ĐTQG`, `QBV`, `UCL`, `ĐKVĐ` etc.) — MUST NEVER BE USED IN `voiceText` (the spoken script).** The text-to-speech engine often misreads or spells them out letter-by-letter. You must spell them out fully in `voiceText`: `"huấn luyện viên"` (for HLV), `"câu lạc bộ"` (for CLB), `"bình luận viên"` (for BLV), `"World Cup"` (for WC), `"đội tuyển quốc gia"` (for ĐTQG), `"Quả Bóng Vàng"` (for QBV), `"Champions League"` (for UCL), `"đương kim vô địch"` (for ĐKVĐ).
  > [!IMPORTANT]
  > **The screen fields (visible text in `templateData` such as `value`, `label`, `context`, `highlights`, `bigStat`, `statement`, `quote`, `question`) CAN keep the abbreviations (e.g. HLV, CLB, UCL, WC, ĐKVĐ) to save space and look neat on screen. The voiceText MUST spell them out fully.**
- Vietnamese acronyms like `MU` can be spelt out as `"Manchester United"` (or `"em-iu"` only if disambiguation matters).
- **Player names — strip non-Vietnamese diacritics from FOREIGN names; keep Vietnamese diacritics on Vietnamese names.** Applies to BOTH `voiceText` AND every visible `templateData` field. Examples:
  - Foreign players: `Mbappe` (NOT `Mbappé`), `Vinicius Junior` (NOT `Vinícius Júnior`), `Nedved` (NOT `Nedvěd`), `Matthaus` (NOT `Matthäus`), `Romario` (NOT `Romário`), `Muller` (NOT `Müller`), `Fenomeno` (NOT `Fenômeno`), `Suarez` (NOT `Suárez`), `Cannavaro` (already plain), `Buffon` (already plain).
  - Vietnamese players keep full dấu: `Đặng Văn Lâm`, `Nguyễn Quang Hải`, `Nguyễn Tiến Linh`.
  - Why: VieNeu TTS pronounces stripped foreign names more naturally for VN listeners, and large-font screen rendering of háček / umlaut / tilde looks foreign / inconsistent next to Vietnamese-styled supporting text. Image-prompt strings (English, sent to Grok) MAY keep diacritics — they help Grok lock onto the right press-photo training data.

**Symbols to AVOID in voiceText:**
- `→` `&` `%` `$` `#` `+` `=` (TTS may say literal name or skip).
- `!` `?` at end of sentence is OK — natural intonation.
- Emoji: NEVER (TTS pronounces or skips inconsistently).
- URLs: NEVER (TTS reads dot/slash literally).
- Em dash `—` is OK in voiceText (signals a pause); avoid in `templateData` (renders as long bar at large fonts — see typography rules).

**End each `voiceText` sentence with `.` or `?`** for natural pause/intonation.

**Worked example — same scene, voice vs visual:**
```json
{
  "voiceText": "Hạng nhất, Raphinha — mười lăm bàn cùng tám pha kiến tạo, người đã khoác lên Barcelona một sức sống mới.",
  "templateData": {
    "template": "stat-hero",
    "value": "15 + 8",          // ← visual: keep digit form
    "label": "Raphinha",
    "context": "Bàn thắng + kiến tạo"
  }
}
```
The voice reads "mười lăm bàn cùng tám pha kiến tạo"; the screen shows "15 + 8". They reinforce each other — viewer hears the spoken form and sees the compact form simultaneously.

**⚠️ Hook (most important — first 2s decide swipe-or-stay):**

The hook scene is THE single biggest lever for view-through. Viewers decide within ~2 seconds whether to keep watching or swipe — and most of what scrolls past on TikTok is "fine, just not stopping me." The hook fails when it acts as an article title; it works when it forces a "wait, what?" reaction.

#### A. Headline rule — NEVER a title, ALWAYS a hook archetype

The `templateData.headline` field is what a sound-off viewer reads in 2 seconds. It MUST fit one of four archetypes — never a topic description:

| Archetype | What it does | ✅ Good headline | ❌ Bad (title-style) |
|---|---|---|---|
| **Stat-shock** | Punches a surprising number/quantity | `"22 năm chờ đợi"`, `"19 kiến tạo"`, `"€80 triệu một mùa"` | `"Hành trình nhà vô địch"` |
| **Question** | Forces curiosity gap | `"Sao Tuchel loại Maguire?"`, `"Ai cứu tuyển Anh đêm nay?"` | `"7 quyết định của Tuchel"` |
| **Verdict** | Strong stance, opinionated | `"Maguire hết cửa Tam Sư"`, `"Đức đã không còn run sợ"` | `"Đội hình Đức cho WC 2026"` |
| **Contradiction** | Pits two things that shouldn't fit | `"Vô địch, nhưng vẫn thiếu 1 thứ"`, `"22 năm đợi — 0 cầu thủ giống nhau"` | `"Vòng cuối Premier League"` |

Anti-test: if the headline could appear unchanged as a `<h1>` on a news website, it's a title — rewrite. If swapping headlines between two of your videos would make either still make sense, both are too generic.

#### B. `bigStat` field — use for stat-shock hooks

Optional `templateData.bigStat` (≤8 chars) renders a giant **WHITE serif** value (Playfair Display) as the hero of the frame, with a short **red accent bar** drawn beneath it. When set:
- The headline shrinks to a supporting role below the red bar.
- The viewer's eye lands on the big number before anything else — exactly the scroll-stopper TikTok rewards.
- The kicker (`eyebrow`, see §B2) STILL shows above the stat — competition context + the big number coexist, broadcast lower-third style.

Use `bigStat` whenever the hook's punchline is a number, a money figure, a rank, a score, or a duration. Skip it for question / verdict / contradiction hooks where the words ARE the punch.

| Hook archetype | Use bigStat? | Example |
|---|---|---|
| Stat-shock | ✅ Yes | `bigStat: "22 NĂM"`, `headline: "Pháo Thủ trở lại đỉnh"`, `subhead: "Premier League 2024-25"` |
| Score-shock | ✅ Yes | `bigStat: "0-7"`, `headline: "Đêm Real bị nghiền nát"`, `subhead: "Tại Bernabeu"` |
| Money-shock | ✅ Yes | `bigStat: "€222M"`, `headline: "Kỷ lục chuyển nhượng"`, `subhead: "PSG mua Neymar 2017"` |
| Rank-shock | ✅ Yes | `bigStat: "#1"`, `headline: "Bruno bỏ xa cả Châu Âu"`, `subhead: "19 kiến tạo Ngoại hạng Anh"` |
| Question | ❌ No | `headline: "Sao Tuchel loại Maguire?"` alone |
| Verdict | ❌ No | `headline: "Maguire hết cửa Tam Sư"` alone |

`bigStat` content rules:
- ≤8 chars hard cap (renders as one giant token; longer wraps badly at 320px font).
- Strip spaces where possible: `"22 NĂM"`, `"€80M"`, `"0-7"`, `"#1"`.
- UPPERCASE for VN words inside bigStat (the "NĂM" in `"22 NĂM"`); digits/symbols stay as-is.
- Keep VN diacritics in bigStat when present (`"NĂM"`, not `"NAM"`) — visible field rules apply.

#### B2. `eyebrow` + `eyebrowSub` — the competition kicker (ALWAYS fill `eyebrow`)

The hook opens with a **broadcast-style kicker**: a red vertical bar + an uppercase label (Oswald font, automatic), rendered above the bigStat/headline. This is what gives the hook its **tin tức / thời sự / phân tích** authority instead of a clickbait shout — it reads like a real sports broadcast lower-third.

- **`eyebrow`** (≤30 chars) = the **competition / context label**. **ALWAYS set it.** Use the tournament or league the story belongs to: `"Ngoại hạng Anh"`, `"Champions League"`, `"World Cup 2026"`, `"La Liga"`, `"Vòng loại World Cup"`, `"Chuyển nhượng"`. For non-match content pick the topical desk: bio → `"Chân dung"`, history → `"Hồi ký"`, ranking → `"Bảng xếp hạng"`, trivia → `"Có thể bạn chưa biết"`, transfer → `"Chuyển nhượng"`.
- **`eyebrowSub`** (≤24 chars, optional) = a **second context line** under the kicker: matchweek, stage, date, or venue — `"Vòng 32"`, `"Bán kết lượt về"`, `"08.06.2026"`, `"Tại Anfield"`. Omit when it adds nothing (channel rule = fewer words).
- ❌ Do NOT put urgency slogans here (`"TIN NÓNG"`, `"GÂY SỐC"`, `"ĐỘC QUYỀN"`). The kicker carries **context**; the headline carries the **hook**. The competition label generalizes across every video and reads as authoritative, not clickbait.
- If `eyebrow` is omitted the kicker is hidden (only the persistent shell brand top-left shows) — always prefer to set it.

#### C. `kenBurns` — pick kinetic motion for hooks, not slow zoom

The default has shifted from `"zoom-in"` (slow Ken Burns) to `"impact-zoom"` (kinetic). Slow zoom on a poster reads like an article cover; kinetic motion reads like a video. Pick per hook:

| Value | Effect | When to use |
|---|---|---|
| `"impact-zoom"` (new default) | Hard scale-down from 1.6× + blur clear in 0.6s, then gentle drift | Most hooks — versatile, attention-grabbing |
| `"whip-pan"` | Background whips in from 40% right + blur, settles in 0.55s | Action / drama / arrival news ("Tuchel chốt danh sách") |
| `"shake-on-beat"` | 5-tick shake then settle, drifts subtle | Conflict / shock / scandal hooks |
| `"zoom-in"` (slow) | Original 1.0→1.18 over full scene | Meditative / tribute / legacy stories ONLY |
| `"zoom-out"`, `"pan-left"`, `"pan-right"` | Old Ken Burns variants | Reveal-wide hooks (squad, stadium, era retrospective) |

When in doubt, pick `"impact-zoom"`. The slow Ken Burns options stay available for tribute / meditative content — but they should be the exception, not the default.

#### D. `voiceText` — hook word in first ≤8 words, setup AFTER

The voice has ~1.5s before the viewer commits. The hook word (the surprising number, the conflict word, the question) MUST be in the FIRST CLAUSE — anything after a comma can be setup, but the punch lands first.

❌ Setup-first (hook word arrives at 4s+ — viewer already gone):
> *"Trước ngày Tuchel chốt danh sách 26 cầu thủ tuyển Anh dự World Cup 2026, đây là 7 quyết định khó nhất."*

✅ Punch-first (hook word at second 1, setup follows):
> *"7 quyết định có thể khiến tuyển Anh về sớm. Tuchel đang đứng giữa lằn ranh."*

❌ Setup-first:
> *"22 năm chờ đợi để Pháo Thủ trở lại đỉnh nước Anh. 23 cầu thủ, 23 hành trình..."*

✅ Punch-first:
> *"22 năm. Pháo Thủ trở lại đỉnh Ngoại hạng. 23 cầu thủ, 23 con đường tới đây."*

The first SHORT sentence (≤8 words) is the hook. The voice can elaborate in sentence 2.

#### E. Worked examples — full hook scenes with new fields

**Stat-shock (Arsenal vô địch):**
```json
{
  "id": "hook",
  "type": "hook",
  "voiceText": "22 năm. Pháo Thủ trở lại đỉnh Ngoại hạng. 23 cầu thủ, 23 hành trình khác nhau.",
  "templateData": {
    "template": "hook",
    "eyebrow": "Ngoại hạng Anh",
    "eyebrowSub": "Mùa 2024-25",
    "bigStat": "22 NĂM",
    "headline": "Pháo Thủ trở lại đỉnh",
    "kenBurns": "impact-zoom"
  },
  "imagePrompt": "..."
}
```

**Verdict (Maguire bị loại):**
```json
{
  "id": "hook",
  "type": "hook",
  "voiceText": "Maguire hết cửa Tam Sư. Tuchel chốt 26 — số 5 trống.",
  "templateData": {
    "template": "hook",
    "eyebrow": "World Cup 2026",
    "eyebrowSub": "Tuyển Anh chốt 26",
    "headline": "Maguire hết cửa|Tam Sư",
    "kenBurns": "shake-on-beat"
  }
}
```

**Question (7 quyết định Tuchel):**
```json
{
  "id": "hook",
  "type": "hook",
  "voiceText": "Bảy quyết định có thể khiến tuyển Anh về sớm. Tuchel đang đứng giữa lằn ranh.",
  "templateData": {
    "template": "hook",
    "eyebrow": "World Cup 2026",
    "eyebrowSub": "Trước ngày chốt 26",
    "bigStat": "7",
    "headline": "Quyết định khó nhất|của Tuchel",
    "kenBurns": "impact-zoom"
  }
}
```

**Contradiction (vòng cuối):**
```json
{
  "id": "hook",
  "type": "hook",
  "voiceText": "Vô địch xong, nhưng cuộc đua chưa hết. Mười trận, năm cuộc đua, một Chủ Nhật.",
  "templateData": {
    "template": "hook",
    "eyebrow": "Ngoại hạng Anh",
    "eyebrowSub": "Vòng cuối — 10 trận cùng giờ",
    "bigStat": "5",
    "headline": "Cuộc đua còn lại|của Premier League",
    "kenBurns": "whip-pan"
  }
}
```

#### F. Anti-patterns — instant fail-list (run before saving the hook)

- ❌ Headline is the article topic written as a noun phrase (`"Hành trình X"`, `"Đội hình Y"`, `"Vòng cuối Z"`).
- ❌ VoiceText opens with `"Trước ngày..."`, `"Hôm nay..."`, `"Mới đây..."`, `"Trong bối cảnh..."` — these are setup verbs, not hook verbs.
- ❌ First sentence of voiceText is >10 words.
- ❌ bigStat contains more than one giant token (e.g. `"22 năm Pháo Thủ"` — that's a headline, not a bigStat).
- ❌ kenBurns is `"zoom-in"` and the content type isn't meditative / tribute. Default should be `"impact-zoom"`.
- ❌ `eyebrow` is missing — the hook loses its broadcast kicker. ALWAYS set it to the competition / context label.
- ❌ `eyebrow` or `eyebrowSub` is an urgency slogan (`"TIN NÓNG"`, `"GÂY SỐC"`) instead of competition context.
- ❌ Hook headline and outro caption say roughly the same thing — wasted opportunity, the hook should commit harder.

**Body — content-type specific patterns:**

The full taxonomy of 8 content types (RANKING, VS, MATCH ANALYSIS, PRE-MATCH PREVIEW, PLAYER PROFILE, HISTORY/CAREER, TRANSFER NEWS, TRIVIA) — including detection signals, scene structure, template sequence, voice tone, and hook patterns — lives in [`classify-football-content`](../classify-football-content/SKILL.md). Use it as your single source of truth.

The one inline rule kept here because it's enforced at script-write time:

**⚠️ stat-hero.value rule for RANKING content — pick ONE of two patterns:**

| | When to use | `value` content | Example |
|---|---|---|---|
| **A1. Metric-driven** | Ranking IS a clear number (top scorers by goals, fastest goals, most expensive transfers) | The metric itself | `"41"` (goals), `"€222M"` (fee) |
| **A2. Editorial** | Ranking is a JUDGMENT (best CBs, greatest moments, most influential) | The rank itself | `"#7"`, `"#6"`, ..., `"#1"` |

For A2, **never** put random secondary stats in `value` (age, height, transfer fee) — they confuse viewers because the number doesn't connect to the rank position. Put those in `context` (single-line, usually the club) and/or `highlights` (2–4 short trait bullets) instead.

**stat-hero `highlights` field — use this for RANKING items** (editorial sub-type especially) to show 2–4 short trait bullets between the label and the context line. Each bullet ≤ 20 chars. Pull from the most distinctive 2–4 facts about the item from the source text — age, position, signature trait, key stat. Pair with `context` set to just the club/team name for a clean two-tier display.

| Field | Example for #1 Gabriel Magalhães | Example for #7 Pau Cubarsí |
|---|---|---|
| `value` | `"#1"` | `"#7"` |
| `label` | `"Gabriel Magalhães"` | `"Pau Cubarsí"` |
| `highlights` | `["Sức mạnh", "Không chiến", "24 bàn / 32 trận"]` | `["19 tuổi", "Điềm tĩnh", "La Masia"]` |
| `context` | `"Arsenal"` | `"Barcelona"` |

Bullet style: short, punchy, no full sentences. Mix one age/biographical bullet with two trait/stat bullets when possible. For metric-driven A1 ranking, highlights are usually unnecessary (the metric is already in `value`); skip the field unless you have additional context-rich bullets.

**Engagement question (MANDATORY — always second-to-last scene, right before outro):**

Every script MUST include an `engagement-question` scene immediately before the `outro`. This is a fixed channel convention — the viewer is asked a content-derived question and prompted to comment, BEFORE the follow CTA. This boosts comment-section signal which TikTok / YouTube Shorts surface as engagement quality.

Pattern: derive the question from the video's central debate / forced choice / open uncertainty. Use the "Theo bạn, …?" / "Ai mới là …?" / "X hay Y?" lead — short, opinionated, answerable in one comment. Examples by content type:

| Content type | Engagement question example |
|---|---|
| RANKING | `"Theo bạn, ai xứng đáng đứng đầu danh sách này — Raphinha hay Mbappé?"` |
| VS | `"Theo bạn, ai mới thực sự vĩ đại hơn — Messi hay Ronaldo?"` |
| MATCH ANALYSIS | `"Theo bạn, đâu là khoảnh khắc xoay chuyển cả trận đấu?"` |
| PRE-MATCH PREVIEW | `"Theo bạn, đội nào sẽ chiến thắng đêm nay?"` |
| PLAYER PROFILE | `"Theo bạn, [Name] có xứng đáng Quả Bóng Vàng năm nay?"` |
| HISTORY/CAREER | `"Theo bạn, đâu là chương đỉnh cao nhất trong sự nghiệp của [Name]?"` |
| TRANSFER NEWS | `"Theo bạn, [Player] có thật sự hợp với [New Club]?"` |
| TRIVIA | `"Trong những sự thật trên, điều nào khiến bạn bất ngờ nhất?"` |
| Squad reveal / Tournament preview | `"Theo bạn, [Team] có lập kỳ tích lần này không?"` |

**Schema:**
```json
{
  "id": "engagement",
  "type": "body",
  "voiceText": "Theo bạn, ai mới là phát hiện lớn nhất của tuyển Pháp tại World Cup hai nghìn không trăm hai mươi sáu — Olise hay Cherki? Hãy để lại bình luận bên dưới video nhé.",
  "templateData": {
    "template": "engagement-question",
    "question": "Theo bạn, ai mới là phát hiện lớn của tuyển Pháp — Olise hay Cherki?",
    "cta": "Để lại bình luận bên dưới nhé",
    "tag": "Câu hỏi"
  }
}
```

**Rules:**
- **Always derived from THIS video's content** — never recycled / generic. The question must reference a specific player, claim, or choice that appeared in earlier scenes.
- **Forces a stance.** Yes/no, A-or-B, or a "which" question that lets the viewer commit to one side in a short comment. Avoid open-ended essays ("bạn nghĩ gì về…?" alone is too vague).
- **One question, one CTA.** Don't pack two questions into one scene.
- **voiceText** spells out numbers per the phonetic rules and ends with a spoken CTA (`"Hãy để lại bình luận bên dưới video nhé."` or similar). The visual CTA stays compact (`"Để lại bình luận bên dưới nhé"`).
- **Tag** is short — typically `"Câu hỏi"` or `"Bình luận"`. Skip if the question itself is self-evidently a prompt.
- **Don't repeat the outro's follow CTA.** The outro handles "Theo dõi Sports For All Ti Vi" — the engagement scene is purely about the comment prompt.

The engagement-question scene typically does NOT take an `imagePrompt` (gradient background is fine — the question is the focus). In plan mode, the plan doesn't need to declare it.

**Outro (always fixed format):**
```json
{
  "id": "outro",
  "type": "outro",
  "voiceText": "Theo dõi Sports For All Ti Vi để xem nhiều phân tích sâu hơn mỗi tuần.",
  "templateData": {
    "template": "outro",
    "ctaTop": "Theo dõi ngay",
    "channelName": "SportsForAllTV",
    "source": "Sưu tầm"
  }
}
```
The video renders `
: ${source}` at the end. **Always use `"Sưu tầm"`** regardless of input mode. Analysis content is editorially curated, not direct attribution to a single article.

**Brand-name phonetic rule (`SportsForAllTV`).** Visible fields (`channelName`, `metadata.channel`) display the CamelCase brand `"SportsForAllTV"`. `voiceText` writes the name **split with spaces** as `"Sports For All Ti Vi"` so VieNeu TTS reads each word distinctly and pronounces `TV` as Vietnamese `"Ti Vi"`. Three English words back-to-back is at the edge of the silence-bug threshold (see `memory/feedback_vieneu_english_silence_bug.md`) — if a test render shows VieNeu stalling, fall back to the fully transliterated phonetic `"Spo Pho Ôn Ti Vi"` (5 VN-readable syllables that sound like "Sports For All TV" to a VN listener). Run `ffprobe -i voice.mp3 -af silencedetect=...` against the outro after the first new render to confirm.

**Multi-part outro override (non-final parts only).**

When Step 1.5 marked the render as a **non-final part** (folder is `<base>-p<N>/` and sibling `<base>-p<N+1>/` exists), the closing pair changes. The standard engagement-question + outro scenes are **replaced by a single "part teaser" outro** so the viewer is pushed toward following the channel to catch the next part, not toward answering a question that will be re-asked at the end of the final part.

Schema:
```json
{
  "id": "outro",
  "type": "outro",
  "voiceText": "Phần <N+1, spelled out> sắp lên sóng. Bấm theo dõi Sports For All Ti Vi để xem ngay khi ra mắt nhé.",
  "templateData": {
    "template": "outro",
    "ctaTop": "Phần <N+1, Arabic digit> sắp lên sóng",
    "channelName": "SportsForAllTV",
    "source": "Sưu tầm"
  }
}
```

Rules for the part-teaser outro:
- **voiceText spells the part number** in Vietnamese (`hai` for part 2, `ba` for part 3, `bốn` for part 4, `năm` for part 5). Never write `"Phần 2"` in voiceText — TTS reads digits inconsistently for this construction.
- **`ctaTop` uses the Arabic digit** (`"Phần 2 sắp lên sóng"`, `"Phần 3 sắp lên sóng"`) — visible on screen is fine with digits.
- **Optional content callback (1 short sentence in voiceText before the CTA).** When the part has a strong cliffhanger (the era closing, a player's breakthrough year landing, a record being broken), you may prepend ONE narrative-bridge sentence ending in a beat — e.g. `"Và thế là, chương Barca khép lại. Phía trước là chiếc cúp duy nhất anh chưa từng chạm tay. Phần hai sắp lên sóng. Bấm theo dõi Sports For All Ti Vi để xem ngay khi ra mắt nhé."`. Cap one sentence, ≤ 25 words. Skip if the part doesn't have a clean cliffhanger — the bare two-sentence teaser is the safe default.
- **Final part (or single video) keeps the standard engagement-question + outro pair** — viewer commits opinion + follow CTA at the actual end.
- **The non-final-part outro replaces BOTH the engagement scene AND the standard outro** (it's a single scene, not two). The script's final scene count is therefore one lower for non-final parts than a comparable single-part video.
- Multi-part renders still apply density rules to the part's prose — don't pad just because a part feels short. A 60-second part is fine as long as it covers its segment cleanly.

Worked example — Part 2 of 3 of a Modric bio (`modric-bio-p2/`, sibling `modric-bio-p3/` exists):
```json
{
  "id": "outro",
  "type": "outro",
  "voiceText": "Cuối năm đó, anh giương cao Quả Bóng Vàng tại Paris. Nhưng đỉnh cao đó chưa phải hồi kết. Phần ba sắp lên sóng. Bấm theo dõi Sports For All Ti Vi để xem ngay khi ra mắt nhé.",
  "templateData": {
    "template": "outro",
    "ctaTop": "Phần 3 sắp lên sóng",
    "channelName": "SportsForAllTV",
    "source": "Sưu tầm"
  }
}
```

### On-screen reading discipline (CRITICAL for retention)

A Vietnamese short-form viewer in 2026 watches in three modes simultaneously: **(1)** audio-on with auto-captions, **(2)** sound-off scrolling, glancing at on-screen text, **(3)** audio-on plus eyes confirming what they hear. **Every `templateData` field is part of the visual reading layer. It must let a sound-off viewer grasp the scene's point in a 2-second glance.**

This is NOT achieved by pasting `voiceText` into visible fields — voice is narrative, on-screen text is substance. The two run in parallel registers and reinforce each other.

#### Core rules

1. **Identify the load-bearing item** of each scene's `voiceText` — usually the number, name, claim, or verdict. Surface it in the most prominent visible field (`value` for stat-hero, `headline` for hook, `statement` for callout).
2. **Compress, don't repeat.** If voice says *"Cao một mét chín mươi ba, mạnh mẽ trong không chiến"*, on-screen renders `"1m93"` + `"Mạnh không chiến"` as separate punchy chips — never the full sentence.
3. **Mirror voice emphasis.** Whatever word the voice stresses (the surprising number, the verdict, the name) is the biggest visible element.
4. **No dead screens.** If a scene's only visible content is a one-line context, ask: would a sound-off viewer get the point? If not — add `highlights`, upgrade to `callout` with a punchier statement, or switch to `feature-list` if the content is enumerable.

#### Per-template extraction map (voiceText → visible fields)

| Template | What viewers READ in 2 seconds | What to extract from voiceText |
|---|---|---|
| `hook` | headline (claim ≤40c) + subhead (frame ≤40c) | The opening claim, compressed: claim + framing context |
| `stat-hero` | value + label + highlights (1–4 ≤20c) + context (≤50c) | The number/rank + subject + 2–4 distinctive facts + one anchor (club/year) |
| `callout` | statement (≤80c) + tag (≤20c) | The voice's main claim, condensed to ≤80c, plus a category tag |
| `comparison` | both `value` + both `label` + winner badge | The two numbers being compared + who leads |
| `feature-list` | title (≤40c) + 1–4 bullets (≤50c each) | The unifying topic + the items the voice enumerates, mirrored as punchy lines |
| `formation-pitch` | title + formation label + 11 player names placed on a green pitch graphic | The starting XI / predicted lineup, rendered as a tactical pre-match board |
| `outro` | fixed brand card | Voice carries the CTA; visible card is the channel profile |

#### `highlights` is the workhorse field — use it across content types

The `stat-hero.highlights` field (1–4 short bullets ≤ 20c each) is a general-purpose fact-extraction layer. Use it whenever the voice mentions multiple distinct attributes about the subject, regardless of content type:

| Content type | Typical highlights pattern | Example |
|---|---|---|
| RANKING (editorial A2) | age + signature trait + key stat | `["19 tuổi", "Điềm tĩnh", "La Masia"]` |
| RANKING (metric A1) | secondary metrics that reinforce the primary | `["5 kiến tạo", "Tốc độ", "Kỹ thuật"]` (when value=`"9"` goals) |
| PLAYER PROFILE | era + role + accolade | `["2014–2026", "Tiền vệ", "QBV 2018"]` |
| HISTORY/CAREER chapter | year + event + outcome | `["2018", "World Cup", "Á quân"]` |
| TRANSFER NEWS | fee + age + role | `["120 triệu £", "23 tuổi", "Tiền đạo"]` |
| MATCH ANALYSIS moment | minute + actor + result | `["Phút 67", "Saka", "Phá bế tắc"]` |
| TRIVIA | the 2–3 facts that make the trivia memorable | `["1953", "Hungary", "Wembley 6–3"]` |

If the voice for a stat-hero only carries 1 distinct fact, use the simpler `value + label + context` form. Don't pad highlights with filler — under-utilizing is fine, fluff is not.

#### Lineup / starting XI scenes — ALWAYS use `formation-pitch`, never `feature-list`

When the source mentions a **starting lineup, predicted XI, squad reveal, or formation** (`đội hình dự kiến`, `đội hình ra sân`, `XI dự kiến`, `4-2-3-1`, `4-3-3`, `3-5-2`, "predicted XI", "starting lineup", squad announcement for a tournament), the lineup scene MUST be rendered as a `formation-pitch` template — a tactical pre-match graphic with a green pitch and player tokens placed by position. A `feature-list` of bulleted positions does NOT communicate spatial structure and looks amateur next to broadcast-quality content.

**Triggers — use formation-pitch when ANY of these apply:**
- Source explicitly names 11 players in positional groups (GK / DEF / MID / FWD).
- Source quotes a formation string (`4-2-3-1`, `4-3-3`, `3-5-2`, `5-3-2`, `3-4-3`, etc.).
- Content type is PRE-MATCH PREVIEW (per `classify-football-content`) AND the source includes lineup speculation.
- Content type is TRANSFER NEWS and the article speculates where the new player slots into the XI (use formation-pitch with the new player in their predicted position).
- Squad reveal for a tournament (World Cup, Euro, Copa, AFF Cup) — pair the squad-list voiceover with a formation-pitch showing the predicted XI from that squad.

**Skip formation-pitch (use feature-list instead) when:**
- Listing position groups *without* a full XI (e.g. "3 trụ cột phòng ngự" — only 3 players named, no lineup structure).
- Naming a tactical concept without spatial layout (e.g. "the press triggers", "key matchups").
- The source has fewer than ~7 named players — too sparse to fill a pitch convincingly.

**Schema usage:**
```json
{
  "template": "formation-pitch",
  "title": "Đội hình dự kiến",
  "formation": "4-2-3-1",
  "rows": [
    ["Maignan"],
    ["Koundé", "Upamecano", "Saliba", "T. Hernández"],
    ["Tchouaméni", "Rabiot"],
    ["Dembélé", "Olise", "Cherki"],
    ["Mbappé"]
  ]
}
```

Rows go **back to front** (GK row first, ST row last). CSS reverses display so GK lands at the bottom of the pitch and the striker at the top. Each row spreads players evenly across the pitch width. Total players should equal 11 for a standard XI; the schema accepts 2–6 rows with 1–5 players per row to support every common formation.

**Important row order rule:** Within each row, order players from **left-to-right from the viewer's perspective**. The first item in the array must be the left-most player (e.g., Left Back), and the last item must be the right-most player (e.g., Right Back). Example for Portugal defense (L to R): `["Nuno Mendes", "Inacio", "Ruben Dias", "Cancelo"]`.

**Name compression — keep tokens readable:**
- Use **surname only** when possible (`Mbappé`, `Koundé`, `Tchouaméni`, `Upamecano`).
- For first-name+surname duos that share a club (`Théo Hernández` and `Lucas Hernández`), use `"T. Hernández"` and `"L. Hernández"` to disambiguate.
- Cap is 24 chars per name but realistic max is ~14 chars — anything longer truncates with ellipsis at the rendered token width.

**voiceText for the formation-pitch scene** still names every player in spoken Vietnamese — the screen carries spatial info, the voice carries the introduction. Example:
> *"Đội hình dự kiến chạy theo sơ đồ bốn hai ba một. Maignan trấn giữ khung gỗ. Hàng thủ Koundé, Upamecano, Saliba và Théo Hernández. Tchouaméni cùng Rabiot án ngữ trục giữa. Hàng công Dembélé, Olise, Cherki vây quanh Mbappé."*

#### PRE-MATCH PREVIEW — standard shape (mirror `nhan-dinh-han-quoc-vs-sec-wc-2026`)

For a two-team pre-match preview, follow the proven structure of `video/output/nhan-dinh-han-quoc-vs-sec-wc-2026/script.json`. Two rules are mandatory:

**1. Put the predicted scoreline IN THE HOOK.** The hook leads with the result, not a generic "trận đại chiến" line. Set `bigStat` to the predicted score and open `voiceText` with it:
- `bigStat: "1-0"`, `eyebrow: "World Cup 2026"`, `eyebrowSub: "<bảng> · <sân>"`, `headline` = the marquee player matchup (`"Son đấu Schick|ở cao nguyên Mexico"`, `"Davies đấu Dzeko|trên sân nhà Canada"`).
- voiceText first sentence ≤8 words IS the prediction, and MUST flag that it's a prediction so viewers don't hear it as a result — open with `"Kênh dự đoán <đội> thắng <tỷ số spelled>."`: *"Kênh dự đoán Hàn Quốc thắng một không."* / *"Kênh dự đoán Canada thắng một không."* — then one sentence of framing (giải / sân / stakes). ⚠️ SPELL the scoreline as words (`hai một`, not `2-1` — the hyphen reads as "trừ", see phonetic rules). This is a score-shock hook (see the hook archetype table). (Feedback 2026-06-15: a bare `"Pháp thắng 2-1"` opener sounds like a final result + reads the hyphen as minus — both wrong.)

**2. The prediction/verdict card uses the `comparison` SCOREBOARD (flags + scoreline), NOT a feature-list or bare bars.** Place ONE `comparison` scene near the end (the "verdict", right before the engagement question). Give BOTH sides a `flag` — that triggers the score-prediction scoreboard render (two national flags + team names + a big centered scoreline, higher score glows as winner). The two `value`s ARE the predicted score.

> ⚠️ **MANDATORY — DO NOT SHIP A PREVIEW WITHOUT THIS SCENE.** This is the #1 recurring miss: 4 previews in a row (2026-06-14) rendered with NO verdict scoreboard scene at all — the score appeared only in the hook, the flags+scoreline card was silently dropped. The render does NOT error on a missing scene (it's schema-valid), so nothing flags it for you. The capability is fully built (`html-composer.ts:278`, CSS `.cs-flag`, schema) and works — the only failure mode is FORGETTING to emit the scene. Every `nhan-dinh-*` script.json MUST contain exactly one `comparison` scene with `flag` set on BOTH sides. See the pre-save checklist at the end of this section.

```json
{
  "id": "verdict",
  "type": "body",
  "voiceText": "Bosnia phòng ngự kỷ luật, nhưng Canada có lợi thế sân nhà. Opta nghiêng về Canada với gần sáu mươi phần trăm. Kênh chốt Canada thắng một không.",
  "templateData": {
    "template": "comparison",
    "left":  { "label": "Canada", "value": "1", "color": "cyan",   "flag": "https://flagcdn.com/ca.svg" },
    "right": { "label": "Bosnia", "value": "0", "color": "purple", "flag": "https://flagcdn.com/ba.svg" }
  }
}
```

- **`flag`** = a flag/crest image URL or local path. Default to national flags `https://flagcdn.com/<iso2>.svg` (e.g. `ca` Canada, `ba` Bosnia, `kr` S.Korea, `cz` Czechia, `br` Brazil, `es` Spain, `gb-eng` England). For a club fixture, point `flag` at a crest under `assets/` instead.
- **Both sides MUST set `flag`** or the scene falls back to the bar chart (wrong for a scoreline). The score (`value`) should match the `bigStat` in the hook — keep them consistent.
- **No `imagePrompt`** — the scoreboard is a non-image (data-driven) template, like `formation-pitch`/`group-intro`. In plan mode it's added on top of the image-eligible plan scenes; `images-for-videos` must NOT plan an image for it.
- The bar-chart `comparison` (no flags) stays the default for METRIC comparisons (goals/trophies/QBV in VS content). Flags + scoreline is specifically the predicted-result card.

**3. Recent form + head-to-head = 2–3 scenes** (from the source's "Phong độ gần đây & đối đầu" section), placed early — right after the hook. Don't cram it into one card; give it room:

- **H2H scene** (`feature-list`, title `"Lịch sử đối đầu"`): the all-time record + the standout meeting + the last meeting. If the teams have never met, a single line ("Lần đầu hai đội chạm trán") + 1–2 framing bullets is fine and this scene can be merged into the first form board instead.
- **One `match-results` board PER team** (`"<Đội> · 5 trận gần nhất"`), each listing that team's last 5 results with scorelines — most recent first. These are ACTUAL past results, so **override the prediction labels**: set `eyebrow: "Phong độ · World Cup 2026"` and `foot: "Kết quả gần đây · SportsForAllTV"` (without the override the board reads "Dự đoán", which mislabels real results). List the team first in each row; strip foreign-team diacritics (`Đức`, `Bồ Đào Nha`, `Bỉ`, `Hy Lạp`, `Maroc`).

```json
{
  "id": "h2h",
  "type": "body",
  "voiceText": "Lịch sử nghiêng hẳn về Mỹ, đội thắng 5 trong 9 lần gặp. Lần duy nhất chạm trán ở World Cup năm 1930, Mỹ thắng 3-0. Gần nhất, Mỹ cũng thắng 2-1 cuối năm ngoái.",
  "templateData": {
    "template": "feature-list",
    "title": "Lịch sử đối đầu",
    "bullets": ["9 lần gặp: Mỹ thắng 5, hòa 2, thua 2", "World Cup 1930: Mỹ thắng 3-0", "Gần nhất: Mỹ 2-1 (11/2025)"]
  }
}
```
```json
{
  "id": "form-usa",
  "type": "body",
  "voiceText": "Mỹ vào giải với phong độ chập chờn. Thua Đức và Bồ Đào Nha, nhưng vừa thắng Senegal 3-2 đầy thuyết phục.",
  "templateData": {
    "template": "match-results",
    "title": "Mỹ · 5 trận gần nhất",
    "eyebrow": "Phong độ · World Cup 2026",
    "foot": "Kết quả gần đây · SportsForAllTV",
    "matches": [
      { "home": "Mỹ", "homeScore": "1", "away": "Đức", "awayScore": "2" },
      { "home": "Mỹ", "homeScore": "3", "away": "Senegal", "awayScore": "2" },
      { "home": "Mỹ", "homeScore": "0", "away": "Bồ Đào Nha", "awayScore": "2" },
      { "home": "Mỹ", "homeScore": "2", "away": "Bỉ", "awayScore": "5" },
      { "home": "Mỹ", "homeScore": "3", "away": "Costa Rica", "awayScore": "0" }
    ]
  }
}
```

The `match-results voiceText` gives narrative colour (the run's story), NOT a read-out of all 5 scores — the board shows the digits.

**4. Keep the standout-players section BRIEF.** Each star stat-hero gets just **1–2 short voice sentences** (a quick hit, not a profile) — surface the detail in the visible `value`/`highlights`/`context`, let the voice stay punchy. E.g. *"Bên kia, Edin Dzeko ở tuổi 40 vẫn là biểu tượng của Bosnia, dẫn đầu ghi bàn vòng loại với 6 pha lập công."* The deep multi-sentence treatment is for PLAYER PROFILE / BIO content, NOT for preview stars.

A full preview thus runs: hook (score in bigStat) → **H2H feature-list + one `match-results` last-5 board per team (2–3 scenes)** → [lineups via formation-pitch] → brief star stat-heros → manager callouts → **verdict scoreboard** → engagement → outro.

##### ⚠️ Pre-save checklist (PRE-MATCH PREVIEW) — verify BEFORE writing script.json

Run this gate on every `nhan-dinh-*` script. If any box fails, fix it before saving — a missing scene renders silently (no error).

1. ☐ **Hook** has `bigStat` = predicted scoreline (e.g. `"1-0"`), and voiceText opens with `"Kênh dự đoán <đội> thắng <tỷ số spelled>"` (flag it as a prediction, NOT a bare result) — scoreline SPELLED as words (`hai một`, never `2-1`).
2. ☐ **No `X-Y` digit-hyphen-digit anywhere in any voiceText** (scores AND formations) — the hyphen reads as "trừ". `grep -E '"voiceText".*[0-9]-[0-9]'` on the script must return NOTHING. Formations spelled (`bốn hai ba một`); the visible `formation`/`bigStat`/board fields keep digits.
3. ☐ **Every `formation-pitch` row goes GK-first → ST-last** (`rows[0]` is the lone goalkeeper, `rows[-1]` the striker). Inverted rows render the team upside-down on the pitch.
4. ☐ **Exactly one `comparison` verdict scoreboard** exists near the end, and **BOTH `left.flag` AND `right.flag` are set** (`https://flagcdn.com/<iso2>.svg`). `grep -c '"flag"'` on the script should be **≥ 2**. The two `value`s match the hook's `bigStat`.
5. ☐ ISO2 codes correct for THIS fixture (verify, don't guess): e.g. Pháp `fr`, Senegal `sn`, Iraq `iq`, Na Uy `no`, Argentina `ar`, Algeria `dz`, Áo `at`, Jordan `jo`, Bồ Đào Nha `pt`, CHDC Congo `cd`, Anh `gb-eng`, Hàn Quốc `kr`, Séc `cz`. Club fixture → crest path under `assets/`.
6. ☐ Form section present: H2H `feature-list` + one `match-results` board per team (labels overridden to `eyebrow: "Phong độ · World Cup 2026"` / `foot: "Kết quả gần đây · SportsForAllTV"`). A board titled `"… 5 trận gần nhất"` MUST list 5 matches; if you only have N<5 reliable results, title it `"… phong độ gần đây"` instead (don't claim 5 and show 4).
7. ☐ The verdict scoreboard scene has **NO `imagePrompt`** (data-driven, like formation-pitch / group-intro).

A fast self-check after writing: `grep -c '"flag"' <script.json>` must be ≥ 2 (verdict) — more if a `group-intro` is also present.

#### Group-stage team reveal — use the `group-intro` template (data-driven, NOT per-team images)

When the source introduces a **World Cup / tournament group** (a bảng with its 3–4 teams + predicted finishing order), render the team reveal as ONE **`group-intro`** scene per group — a code-driven HTML/CSS card (flags/crests + team names + predicted finish), NOT a stack of per-team `stat-hero` image scenes. This is the group-stage analog of `formation-pitch`: the data is the visual, so no AI image is needed (and `images-for-videos` should NOT plan per-team posters for it).

**Triggers:** content is a group-stage preview/prediction (`Bảng A`, `Bảng F`, "Group D", squad-group reveal) listing the teams in a group with a predicted order/standing.

**Schema usage** (teams listed in predicted finishing order — index+1 is the displayed rank; `qualify:true` gold-highlights the advancing teams):
```json
{
  "template": "group-intro",
  "group": "F",
  "teams": [
    { "name": "Argentina", "flag": "https://flagcdn.com/ar.svg", "note": "Nam Mỹ · ƯCV vô địch", "result": "Nhất bảng", "qualify": true },
    { "name": "Na Uy",     "flag": "https://flagcdn.com/no.svg", "note": "Haaland dẫn dắt",      "result": "Đi tiếp",   "qualify": true },
    { "name": "Australia",  "flag": "https://flagcdn.com/au.svg", "note": "Châu Á · Socceroos",   "result": "Hạng 3" },
    { "name": "Tunisia",    "flag": "https://flagcdn.com/tn.svg", "note": "Đại bàng Carthage",    "result": "Bị loại" }
  ]
}
```
- **`flag`** = an image URL or local path. Default to `https://flagcdn.com/<iso2>.svg` (national flags; e.g. `ar`, `no`, `gb-eng` for England, `de` Germany, `jp` Japan, `kr` S.Korea, `br` Brazil, `es` Spain). For federation crests instead, drop the SVG under `assets/` (or the input folder) and point `flag` at that path.
- **`result`** ≤20 chars: `"Nhất bảng"`, `"Đi tiếp"`, `"Hạng 3"`, `"Bị loại"`. **`qualify`** true for advancing teams (gold row + gold chip).
- **No `imagePrompt`** — `group-intro` is a non-image template (like `formation-pitch`/`comparison`); in plan mode it's added on top of the image-eligible plan scenes.
- **`voiceText`** introduces the 4 teams + the prediction in spoken Vietnamese; the screen carries the table. Example: *"Bảng F là bảng của Messi. Argentina được dự đoán nhất bảng, Na Uy của Haaland đi tiếp. Australia và Tunisia chia tay sớm."*
- A group-stage part covering 2 groups (e.g. Bảng A + B) = 2 `group-intro` scenes (one per group) + hook + 1–2 highlight image scenes + engagement + outro. Don't also make per-team `stat-hero` images for those teams — that's what `group-intro` replaces.

#### Predicted match scores — use the `match-results` template (data-driven scoreline board, NO image)

When the source carries **predicted/actual match scorelines** (a group's game-by-game results, or a knockout round's results), render them as a **`match-results`** scene — a code-driven board listing each result `home  H-A  away`, NO AI image. This is the scoreline analog of `group-intro`: the scores ARE the visual.

**Triggers:** source has a "Key scores" / "Diễn biến" / game-by-game block (e.g. `Mexico 2-0 Nam Phi; Hàn Quốc 1-1 Séc; …`), OR a knockout round with multiple results. Use ONE board per group (its 6 matches) or ONE board per knockout round (its 8–16 results — cap 8 rows/board; split into 2 boards if a round has >8).

**Schema usage:**
```json
{
  "template": "match-results",
  "title": "Bảng A · Kết quả",
  "matches": [
    { "home": "Mexico",   "homeScore": "2", "away": "Nam Phi",  "awayScore": "0" },
    { "home": "Hàn Quốc", "homeScore": "1", "away": "Séc",      "awayScore": "1" },
    { "home": "Séc",       "homeScore": "1", "away": "Mexico",   "awayScore": "2", "note": "luân lưu" }
  ]
}
```
- **`title`** ≤40 (e.g. `"Bảng A · Kết quả"`, `"Vòng 16 đội"`). Optional **`subtitle`** ≤40.
- **`home`/`away`** ≤20 (team name, strip foreign diacritics per typography rules). **`homeScore`/`awayScore`** are strings ≤8 (allow `"2"`, or pen shorthand). **`note`** ≤20 optional (`"luân lưu"`, `"Nhất bảng"`).
- **2–8 matches** per board. **No `imagePrompt`** — non-image template; `images-for-videos` must NOT plan an image for it.
- **`voiceText` summarizes, does NOT read all scores** — the board shows the digits; the voice gives narrative color (who stayed unbeaten, the key result). E.g. *"Đây là toàn bộ kết quả Bảng A. Mexico bất bại, chỉ bị Hàn Quốc cầm chân. Séc vượt Nam Phi lấy vé vớt."* Reading 6 scorelines aloud is robotic — don't.
- For a group-stage part: pair each `group-intro` (standings) with a `match-results` (the 6 scores) — standings answer "ai đi tiếp", scores answer "diễn biến thế nào". For knockout parts, a `match-results` board replaces a stack of per-match `comparison` scenes when a round has many results (a round of 16 = 8 rows in ONE board, not 8 separate scenes).

#### Player lists (NOT lineups) — SPLIT into individual stat-hero scenes, don't pack into feature-list

When the source names **2-5 specific named players** as a thematic group (workers / leaders / breakout stars / trụ cột / nhân tố chìa khoá / shortlist transfer targets / vô địch chia tay đội tuyển) and each player has a **distinguishing trait or role**, render each player as their **OWN `stat-hero` (or `callout`) scene with their own image** — NOT as a single `feature-list` of bullet names.

**Why:** A list of 4 player names on a single screen reads as info dump. Each player deserves their own beat: their face, their club, their role. Sound-off viewers want to recognize each face individually. Voice gets time to characterize each name.

**Triggers — split into individual scenes when ALL of these apply:**
- 2-5 named players in the group (more than 5 → use `feature-list` with names only as a quick enumeration; viewers can't absorb 6+ individual scenes in a thematic block)
- Each player has a distinguishable trait, role, or fact (not just "they all play X position")
- Content is character-driven (HISTORY-CAREER, MATCH ANALYSIS key actors, PLAYER PROFILE supporting cast, TRANSFER NEWS shortlist, PRE-MATCH PREVIEW key matchups, TRIVIA "5 cầu thủ X")

**Skip splitting — keep as `feature-list` when:**
- 6+ players (visual fatigue if split)
- Players named only as a quick enumeration without per-player traits (e.g. "5 cầu thủ Việt Nam thi đấu ở châu Âu" → if the source just lists names without why each matters → feature-list)
- Items aren't players (transfer windows, dates, formations, tactical concepts — those belong in `feature-list`)

**Recipe — per individual scene:**
```json
{
  "id": "worker-kimmich",
  "type": "body",
  "voiceText": "Joshua Kimmich, đội trưởng và nhạc trưởng giữa sân. Người luôn xuất hiện ở pha tranh chấp quyết định.",
  "templateData": {
    "template": "stat-hero",
    "value": "Đội trưởng",
    "label": "Joshua Kimmich",
    "highlights": ["Nhạc trưởng", "Tranh chấp", "Bayern Munich"],
    "context": "Trụ cột trung tâm tuyển Đức"
  },
  "imagePrompt": "Vertical 9:16 football poster artwork featuring Joshua Kimmich..."
}
```

Each individual scene gets its own `imagePrompt` (image-eligible by template). The image-plan (`/images-for-videos`) MUST declare one scene per player, with the planned filename matching the sceneId.

**Worked example — from the Nagelsmann / Đức workers section (instead of one `workers-list` feature-list):**

| ❌ Old (one feature-list scene, no images) | ✅ New (one callout intro + 4 individual stat-hero) |
|---|---|
| `feature-list` titled "Workers tiêu biểu" with 4 name bullets | `workers` callout (group concept + image) → `worker-kimmich` stat-hero → `worker-andrich` stat-hero → `worker-ruediger` stat-hero → `worker-tah` stat-hero |
| 1 scene, no individual visuals | 5 scenes, each with own face / kit / club crest |

The cost is +3-4 scenes per player block. Stay within the density band's upper cap; if you go over, trim a less-essential reflective callout elsewhere (e.g. a generic quote scene).

**The `value` field for individual-player stat-hero — pick what's most distinctive about THAT player:**
- Role / title: `"Đội trưởng"`, `"Nhạc trưởng"`, `"Trụ cột"`
- Defining stat: `"24 bàn"`, `"60 trận"`, `"€90M"`
- Era/age: `"19 tuổi"`, `"5 mùa"`
- Achievement count: `"3 cúp"`, `"#1"`

For a thematic group like "workers," the role/title pattern reads cleanest. For ranking content, use `#N`. For metric-driven content, use the metric. Never put random secondary stats — pick the single most distinctive fact.

#### Sound-off test (run mentally before finalizing each scene)

Imagine the viewer scrolls past with no audio. In 2 seconds, can they tell why this scene exists? If no, fix one of:
- **Visible text duplicates voice** → compress to keywords/numbers.
- **Visible text is missing the load-bearing item** → surface the number/name in `value` or `statement`.
- **Template is too thin** → add `highlights` (stat-hero) or upgrade body scenes to `callout`/`feature-list`.

#### Worked example — same voiceText, two visible qualities

**Voice:** *"Hạng bảy, Pau Cubarsí. Mới mười chín tuổi nhưng đã được xem là trung vệ trẻ nhất hành tinh có mặt trong top mười thế giới. Định vị, ra quyết định và chuyền bóng đậm chất La Masia."*

| Quality | templateData | Sound-off impression |
|---|---|---|
| ❌ Bad | `value="#7", label="Pau Cubarsí", context="19 tuổi · Barcelona"` | "There's a #7. Some name. 19 years old, Barcelona. So what?" |
| ✅ Good | `value="#7", label="Pau Cubarsí", highlights=["19 tuổi", "Điềm tĩnh", "La Masia"], context="Barcelona"` | "#7 — Pau Cubarsí — 19 tuổi · điềm tĩnh · La Masia · Barcelona. Got it: a calm 19-year-old Barça product cracking the world top 7." |

The good version makes the scene viewer-completable from the screen alone. The voice fills in *why* he's rated this way; the screen tells you *what* he is.

### Typography rules — capitalization, abbreviation, line breaks

The pipeline renders Vietnamese text on a 9:16 frame at very large font sizes (up to 220px). Sloppy casing, missing diacritics, or arbitrary line wraps look amateur fast. Apply these rules to every text field in `templateData`. (`voiceText` is separate — it follows the existing TTS phonetic rules: spell out numbers, expand abbreviations.)

#### A. Capitalization

**A1. Three fields are CSS-uppercased automatically** — write them in natural sentence case, never type ALL CAPS yourself. The CSS adds the uppercase + letter-spacing for visual rhythm:
- `comparison.left.label` / `comparison.right.label` (becomes `MESSI`, `RONALDO`)
- `callout.tag` (becomes `INSIGHT`, `VERDICT`, `TWIST`)

So write `"Messi"`, `"Insight"`, `"Phong cách"` — not `"MESSI"`, `"INSIGHT"`, `"PHONG CÁCH"`.

**A2. Other fields use Vietnamese sentence case** — capitalize only the first letter of the sentence + proper nouns. Vietnamese does NOT use English-style Title Case (every word capitalized) — that looks foreign and over-formal:
- ✅ Good: `"Top 5 vua phá lưới Champions League"` — only first letter + competition name capped
- ❌ Bad:  `"Top 5 Vua Phá Lưới Champions League"` — Title Case is wrong for Vietnamese
- ✅ Good: `"Hạng nhất không phải tên bạn nghĩ"`
- ❌ Bad:  `"Hạng Nhất Không Phải Tên Bạn Nghĩ"`
- ✅ Good: `"Cờ đến tay ai?"`
- ❌ Bad:  `"Cờ Đến Tay Ai?"`

**A3. Proper nouns — always capitalized, with full diacritics and special characters:**
- Foreign players — **strip non-Vietnamese diacritics**: `Lewandowski`, `Mbappe` (NOT `Mbappé`), `Vinicius Junior` (NOT `Vinícius Júnior`), `Nedved` (NOT `Nedvěd`), `Matthaus` (NOT `Matthäus`), `Romario` (NOT `Romário`), `Muller` (NOT `Müller`), `Suarez` (NOT `Suárez`).
- Vietnamese players — **keep full dấu**: `Đặng Văn Lâm`, `Nguyễn Quang Hải`, `Nguyễn Tiến Linh`, `Quang Hải`, `Văn Hậu`.
- Clubs: `Real Madrid`, `Manchester City`, `Bayern Munich`, `Hà Nội FC`, `Công an Hà Nội`
- Competitions: `Champions League`, `Premier League`, `V-League`, `World Cup`, `Euro`, `Copa America` (NOT `Copa América`), `AFF Cup`
- Countries: foreign without exotic diacritics — `Argentina`, `Brazil`, `Czech` (NOT `Česká`); Vietnamese-localized forms keep VN dấu — `Đức`, `Việt Nam`, `Bồ Đào Nha`, `Cộng hòa Séc`.
- Stadiums: `Anfield`, `Camp Nou`, `Bernabeu` (NOT `Bernabéu`), `Mỹ Đình`, `Allianz Arena`, `San Siro`, `Stadio San Paolo`.

**A4. Common nouns are NOT capitalized** — they're descriptors, not names:
- `vua phá lưới`, `trung vệ`, `tiền đạo`, `huấn luyện viên`, `cầu thủ`, `bàn thắng`, `pha cứu thua`, `bán kết`, `lượt về`
- Exception: when one of these IS the value of `comparison.label` or `callout.tag`, write it lowercase as instructed in A1 — the CSS uppercases it.

**A5. Numbers — use Arabic digits on screen, words in voice:**
- Screen: `821 bàn`, `8 QBV`, `15+8`, `1m93` — ALWAYS digits
- Voice: `"tám trăm hai mươi mốt bàn"`, `"tám Quả Bóng Vàng"`, `"mười lăm bàn cùng tám pha kiến tạo"` — ALWAYS spelled
- Never put a spelled-out number in `value` / `context` / any visible field — it wastes character budget and reads slowly.

**A6. Avoid em dash `—` on screen — use `·` or `:` instead.**

The em dash `—` (U+2014) renders at the full width of the letter `M`. On the very large fonts this pipeline uses (64–220px), `—` becomes a long horizontal bar that visually dominates the field and looks ugly. Replace it everywhere in `templateData`. (`voiceText` is voice-only, so `—` there is harmless and can stay if you want a writer-style pause cue.)

| Field | Replace `—` with | Example |
|---|---|---|
| `stat-hero.label` | ` · ` (middle dot, U+00B7) | `"David Raya · Găng tay vàng"` |
| `feature-list.bullets[]` | ` · ` (middle dot) | `"Vitinha · kiến tạo nhiều nhất trận"` |
| `callout.statement` | `: ` (colon) — re-phrase if `:` reads as causation when the original `—` was just a pause | `"Leeds chốt trụ hạng: chỉ cần thắng Tottenham."` |
| `hook.headline` / `hook.subhead` | usually restructure or use line-break `\|` | rarely needs a dash; rewrite the line |

If `:` reads awkward (i.e. the two clauses are equal claims, not subordinate explanation), drop the connector word and split into two short sentences with a period, or use comma:
- ❌ `"Arsenal bất bại — và Donnarumma đã đi."` (em dash + "và" connecting equals)
- ✅ `"Arsenal bất bại: Donnarumma đã đi."` (drop "và" so `:` reads as natural epexegesis)
- ✅ `"Arsenal bất bại. Donnarumma đã đi."` (period also works)

Hyphen-minus `-` (U+002D) inside proper nouns (`Saint-Germain`, `2011-2013`) and stat shorthand (`-17 HS`, `15-8`) is fine — it's narrow and doesn't trigger the issue.

#### B. Abbreviations

Screen real estate is precious (huge fonts, 1080px width). Voice has time. So **abbreviate aggressively on screen, expand fully in voice**.

**B1. Standard accepted abbreviations** (use freely on screen — Vietnamese football audience knows these):
- `CLB` = Câu lạc bộ
- `ĐTQG` = Đội tuyển quốc gia
- `HLV` = Huấn luyện viên
- `QBV` = Quả Bóng Vàng
- `UCL` = Champions League (preferred over the colloquial `C1`)
- `UEL` = Europa League
- `EPL` / `NHA` = Premier League / Ngoại hạng Anh
- `WC` = World Cup (or write `World Cup` — same length)
- `vs` = đối đầu (lowercase, no period)
- `MU`, `MC`, `PSG`, `RM`, `BVB`, `CAHN` (Công an Hà Nội) — only when context is unambiguous

**B2. Stat-value shorthand** — `stat-hero.value` (cap 20, font 220px) must be ultra-compact. Common patterns:
- Single number + unit: `15`, `82%`, `€80M`, `1m93`
- Compound: `15+8` (bàn + kiến tạo), `3:1` (tỉ số), `5/6` (thắng / trận), `x4` (lần vô địch)
- Rank: `#1`, `#7`
- Currency abbreviated: `€`, `£`, `$` + `M` (million) / `K` (thousand). Never write out `triệu euro` in `value`.
- **Do NOT** put words in `value` (e.g. `"15 bàn thắng"` ← bad). Words go in `label` or `context`.

**B3. Don't invent abbreviations.** If it's not commonly seen in Vietnamese football media, write it out. `"đtq"`, `"vlk"`, `"c1qg"` — nobody parses these in 1.5 seconds.

#### C. Line breaks

The composer converts the character `|` into `<br>` for these large-font fields ONLY:
`hook.headline`, `hook.subhead`, `callout.statement`, `feature-list.title`, `stat-hero.label`.

Other fields render `|` as a literal character — don't use it there.

**C1. Default — don't manually break.** For most strings under ~25 chars, CSS auto-wraps fine; don't add `|`. Trust the layout.

**C2. When to use `|`** — only when phrasing demands it AND the string is long enough to wrap awkwardly:
- `hook.headline` (160px Anton, very wide chars) — use `|` if the headline is >25 chars and has a natural cut point.
- `callout.statement` (64px Inter, max 80 chars) — use `|` if it's >50 chars and has a natural cut point.
- `feature-list.title` / `stat-hero.label` — rarely; only when the natural CSS wrap lands mid-name.

**C3. Where to put `|` — break at phrasing boundaries:**
- ✅ `"Top 5 vua phá lưới|Champions League"` — break before the competition name
- ✅ `"Bayern thắng penalty|Thủ môn quyết định"` — break between the two clauses
- ✅ `"Cả hai đều là huyền thoại|theo cách của riêng mình"` — break at the natural pause
- ❌ `"Real|Madrid"` — never break a proper noun
- ❌ `"vua phá|lưới"` — never break a Vietnamese compound noun
- ❌ `"Top|5"` — never separate a quantifier from its number

**C4. Cap on lines:**
- `hook.headline` — max 2 lines (1 break)
- `callout.statement` — max 3 lines (2 breaks)
- Others — max 2 lines

**C5. The `|` counts toward the field's character cap.** A `headline` cap of 40 means 39 visible chars + 1 break. Plan accordingly.

#### D. Per-field reference (Vietnamese)

| Field | Cap | CSS hint | Style guide |
|---|---|---|---|
| `metadata.title` | unlimited | hidden tab title | Sentence case, full proper nouns. Not rendered on screen — used by exporters. |
| `hook.headline` | 40 | 160px Anton, center | Sentence case. `|` allowed (typically before a competition name). E.g. `"Top 7 trung vệ ITW"` , `"Bayern vs PSG|Bán kết lượt về"` |
| `hook.subhead` | 40 | 80px Inter cyan | Sentence case, supporting line. E.g. `"Champions League 24-25"`, `"Cờ đến tay ai?"` |
| `comparison.label` | 30 | 40px CSS uppercase | Write natural case (`Messi`, `Tấn công`). Keep to 1–2 words. |
| `comparison.value` | 20 | 110px Anton, colored | Numbers + ultra-short unit (`8 QBV`, `821 bàn`, `1m70`). |
| `stat-hero.value` | 20 | 220px Anton, cyan | Pure number/symbol (`15`, `5+10`, `3:1`, `€80M`, `#1`). No words. |
| `stat-hero.label` | 40 | 64px Inter | Subject (player name / metric name). Sentence case. `|` allowed if a long full name would wrap mid-name. |
| `stat-hero.context` | 50 | 44px Inter pill | Single anchor line: club, year, or metric framing (`Bàn thắng + 5 kiến tạo`, `Hơn 1 bàn / trận`, `Barcelona`). Sentence case. |
| `stat-hero.highlights[]` | 20 each, max 4 | 44px Inter | Punchy fragments — no full sentences. (`Sức mạnh`, `Không chiến`, `24 bàn / 32 trận`, `19 tuổi`) |
| `feature-list.title` | 40 | 60px Inter purple | Sentence case. `|` allowed. |
| `feature-list.bullets[]` | 50 each, max 4 | 50px Inter | Each = a clause/short sentence. Sentence case. CSS adds the dot — don't prefix `-` or `•`. |
| `formation-pitch.title` | 40 | 64px Inter | Sentence case. E.g. `"Đội hình dự kiến"`, `"Đội hình ra sân"`. |
| `formation-pitch.formation` | 12 | 56px Anton cyan | Formation label, e.g. `"4-2-3-1"`, `"4-3-3"`, `"3-5-2"`. |
| `formation-pitch.rows[][]` | 24 per name, 1–5 names/row, 2–6 rows | 26px Inter on green pitch | Player names by row, **back to front** (GK row first, ST row last). Order within rows MUST be **left-to-right from the viewer's perspective** (Left Back first, Right Back last). Use surnames only (`Mbappé`, `T. Hernández`). Total 11 for standard XI. |
| `engagement-question.question` | 120 | 60px Inter | Content-derived question. Sentence case. `|` allowed for phrase-aware line breaks. End with `?`. |
| `engagement-question.cta` | 40 | 38px Inter pill | Short comment prompt, e.g. `"Để lại bình luận bên dưới nhé"`. |
| `engagement-question.tag` | 20 | 36px CSS uppercase | Optional. Natural case (`Câu hỏi`, `Bình luận`). |
| `callout.statement` | 80 | 64px Inter | The "money line." Sentence case. `|` allowed for 2–3 line emphasis. |
| `callout.tag` | 20 | 32px CSS uppercase | Natural case (`Insight`, `Verdict`, `Twist`, `Phong cách`, `Bước ngoặt`). |
| `outro.ctaTop` | 30 | 52px Inter pill | `"Theo dõi ngay"`, `"Like + Theo dõi"` |
| `outro.channelName` | 30 | 120px Anton | `"SportsForAllTV"` (channel brand). No `|`. |
| `outro.source` | 40 | 44px Inter | Source attribution. Composer prepends `"Nguồn: "` automatically — don't include that prefix yourself. Examples: `"Sưu tầm"`, `"Tổng hợp"`, `"goal.com"`. |

#### E. Visual hygiene self-check (run before writing script.json)

For each scene, ask:
1. **Casing & diacritics:** Is anything in unwarranted ALL CAPS? Is any common noun (`Vua`, `Trung Vệ`) wrongly capitalized? Are Vietnamese proper nouns missing dấu (`Hà Nội` written `Ha Noi`)? Are **foreign** player names still carrying non-VN diacritics that should be stripped (`Nedvěd` → `Nedved`, `Matthäus` → `Matthaus`, `Mbappé` → `Mbappe`, `Vinícius Júnior` → `Vinicius Junior`)?
2. **Length:** Is `value` a number-only fragment? Is any field overshooting its cap? (Schema validation will fail loudly, but catch it earlier.)
3. **Line breaks:** Did I add `|` only on the 5 supported fields? Did I break at phrase boundaries (not mid-name, not mid-compound)?
4. **Abbreviations:** Are screen abbreviations (`CLB`, `UCL`, `QBV`, `15+8`) expanded in `voiceText` (`Câu lạc bộ`, `Champions League`, `Quả Bóng Vàng`, `mười lăm bàn cùng tám pha kiến tạo`)?
5. **Outro source:** Did I omit the `"Nguồn:"` prefix from `outro.source` (the composer adds it)?
6. **Em dash:** Did I avoid `—` (U+2014) in any visible field? Replaced with ` · ` in label/bullet, `: ` in `callout.statement`, or restructured? (See A6.)

### imagePrompt rules (CRITICAL — videos live or die by visuals)

Every hook / callout / stat-hero scene SHOULD have an `imagePrompt`. Same rules apply when this skill writes prompts in free-form mode AND when `images-for-videos` writes prompts upstream — keep both ends consistent. Default style is **football poster artwork** (NOT cinematic press photography) per `memory/feedback_image_prompts_poster_style.md` — photo-real player figure on a graphic-design backdrop with crest watermark + light bursts + club-color palette.

- **English** prompts (image models are much stronger in English).
- **Style:** football poster artwork — hero subject + graphic-design backdrop + light-burst effects + vibrant saturated colors. Like a Premier League / UCL matchday promotional poster, EA Sports FIFA cover, or Sky Sports broadcast graphic.
- **Open with:** `"Vertical 9:16 football poster artwork featuring..."` (or `"Vertical 9:16 split-frame football poster artwork showing..."` for matchup hooks).
- **80–140 words** — poster prompts run leaner than press-photo prompts because the background is "graphic backdrop" instead of a full scene description.
- Avoid **scoreboards** and **on-image text overlays / lower-thirds / broadcast graphics** (the pipeline overlays its own captions; in-image text fights that).
- **For specific named players: lean on the NAME, not facial description.** Lead with `"<Full Name>, the <Nationality> <position> for <Club> and the <National Team>"` and let the model use its training data to render the actual person. Do NOT add skin tone / hair / beard / jaw / eye descriptors — those average the face into a generic look and override the real likeness. Spend the word budget on **pose + graphic backdrop**, not the face.
- **Iconography stays — rendered as graphic elements.** DO ask for the real club crest visible on the chest of the kit (same as before), plus: a huge stylized **club crest watermark** floating faintly behind the subject as the dominant backdrop element; club-color graphic blocks / color-block shards; faint stylized fan-crowd silhouettes or fan scarves as graphic color bands at the lower edge; the captain's armband when relevant; UEFA / Premier League trophy as a stylized graphic element when the scene is about that achievement. Stadium landmarks become subtle silhouetted graphic motifs (Eiffel Tower silhouette, Allianz facade outline, Bernabéu skin abstracted) — not full photographic backdrops. End each prompt with `"The <Club> crest visible on the jersey, no on-image text or captions, no scoreboard graphics"`.
- **Hook for VS / matchup content — split-frame poster.** Vertical split-frame, one named player from each side in their real club kit with crest visible, each side's backdrop in that club's color palette + huge faint crest watermark + radiating light rays, diagonal lightning-burst slash separator down the centre seam, the competition's trophy as a stylized graphic accent between them (UCL starball / Premier League trophy / World Cup) when relevant.
- **Atmospheric variety pool — but as poster motifs.** Mix in graphic-treated atmosphere: stylized fan-crowd silhouettes flanking the subject (Yellow Wall yellow, Kop red, Virage Auteuil navy), stylized tifo banner motifs as the lower frame ribbon, club mascot as a corner graphic accent, stadium landmark silhouettes as a graphic motif behind the figure (not a photographic backdrop), the relevant trophy as a corner graphic element. One or two atmospheric scenes per video — not every callout needs to be a player figure.
- **Stack poster cues for graphic-design feel** — pick 2–3 per prompt: `"a huge stylized <Club> crest floating faintly behind him as a watermark"`, `"dramatic light rays radiating outward from behind"`, `"golden light burst"`, `"lens-flare effects"`, `"layered color-block shards in <club colors>"`, `"vibrant saturated palette"`, `"very high contrast"`, `"glossy graphic-design finish"`, `"stylized European-stars / trophy / ribbon graphic accent in the upper corner"`. Close each prompt with a poster reference matched to scene role: `"Stylized like a Premier League matchday promotional poster"` / `"UEFA Champions League knockout matchday graphic"` / `"end-of-season award broadcast graphic"` / `"trophy-lift promotional poster"`.
- **DO NOT use these old press-photo cues** — they drag the output back to realism: ❌ `"telephoto compression"` / `"85mm lens"` / `"shallow depth of field"` / `"motion blur on the ball"` / `"natural skin texture, no plastic AI smoothness"` / `"atmospheric haze drifting"` / `"matching Premier League broadcast photographs"` / `"photo-realistic press photography"`. These are deprecated.
- **"Ảnh chế" / meme scenes — 0–2 per video when content invites it.** When the source has built-in irony (manager mind-games like *Pep cổ vũ West Ham*, drama / soap-opera plots like Mbappé saga, banter / rivalry tension, absurd "still going" stats), include 1–2 humor scenes. They are NOT cartoons — **football-poster artwork (same style as other scenes) with ONE clean impossible element** (the wrong jersey, the wrong gesture, the wrong scarf). The backdrop watermark should be the **ironic club** (West Ham crest watermark on a Pep poster), doubling the joke clarity. Skip memes for tributes, sober tactical breakdowns, pure ranking countdowns, and heavy news. Tag the prompt with `(humor edit / playful what-if scene)` after the opening token. Hard cap **2 memes per video** — they REPLACE a regular image scene, not stack on top of the band. Mark `subjectHint` with `"Ảnh chế — ..."`. Full recipe + Pep / West Ham example lives in the `images-for-videos` SKILL.md.

- **Fallback for "too photo-real" output:** if Grok renders too photo-realistic instead of poster, prepend `"in the style of a stylized vector-illustration sports poster"` or `"EA Sports FIFA cover art style"` to the prompt to push further toward graphic-design treatment. Use sparingly — the default poster framing usually lands.

**Example imagePrompts for football contexts (poster style):**

| Context | Prompt |
|---|---|
| Named player celebration (Haaland) | `Vertical 9:16 football poster artwork featuring Erling Haaland, the Norwegian striker for Manchester City and the Norway national team, in a hero pose with both arms outstretched and an open-mouthed roaring shout after scoring. He wears a sky-blue Manchester City home kit with the Manchester City crest clearly visible on the chest. Background: a vivid sky-blue Manchester City graphic backdrop with a huge stylized Manchester City crest floating faintly behind him as a watermark, a dramatic golden light burst radiating outward from behind, gold particles scattered across the frame as graphic accents. Vibrant saturated sky-blue palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a Premier League matchday promotional poster. The Manchester City crest visible on the jersey, no on-image text or captions, no scoreboard graphics.` |
| Named player action (Vinicius) | `Vertical 9:16 football poster artwork featuring Vinícius Júnior, the Brazilian winger for Real Madrid and the Brazil national team, in a hero composition mid-stride driving forward with the ball, intense focused expression. He wears a white Real Madrid home kit with the Real Madrid crest clearly visible on the chest. Background: a layered white-and-gold Real Madrid graphic backdrop with a huge stylized Real Madrid crest floating faintly behind him as a watermark, the Santiago Bernabéu's metallic skin abstracted as a subtle silhouette motif in the upper background, dramatic golden light rays radiating outward. Vibrant saturated white palette with bold gold and royal-purple accents, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League matchday graphic. The Real Madrid crest visible on the jersey, no on-image text or captions, no scoreboard graphics.` |
| VS hook (Messi vs Ronaldo) | `Vertical 9:16 split-frame football poster artwork showing a generation-defining matchup. Left half: Lionel Messi, the Argentine forward and captain for the Argentina national team, in a light-blue-and-white striped Argentina kit with the AFA crest clearly visible on the chest, intense focused hero pose. Behind him, a stylized light-blue-and-white graphic backdrop with a huge faint AFA crest watermark and radiating light rays. Right half: Cristiano Ronaldo, the Portuguese forward and captain for the Portugal national team, in a dark red Portugal home kit with the FPF crest clearly visible on the chest, mirroring hero pose. Behind him, a stylized red-and-green Portugal graphic backdrop with a huge faint FPF crest watermark and radiating light rays. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow, a golden Ballon d'Or trophy hovering as a stylized graphic accent between them. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a matchday rivalry promotional poster. Both national crests visible on the jerseys, no on-image text or captions, no scoreboard graphics.` |
| Ultras / fan tribute (Dortmund) | `Vertical 9:16 football poster artwork. Centre composition: stylized fan-crowd silhouettes in a wall of bright yellow filling the lower two-thirds of the frame, scarves raised above heads as graphic color bands. Behind them, a layered yellow-and-black BVB graphic backdrop with a huge stylized Borussia Dortmund crest floating faintly as a watermark, dramatic yellow light rays radiating outward, a stylized 'BVB' tifo banner ribbon graphic across the upper frame. Vibrant saturated yellow palette with bold black accents, very high contrast, glossy graphic-design finish. Stylized like a Bundesliga matchday promotional poster. The Borussia Dortmund crest visible as the watermark, no on-image text or captions, no scoreboard graphics.` |
| Trophy lift (named captain) | `Vertical 9:16 football poster artwork featuring Lionel Messi, the Argentine captain for the Argentina national team, in a hero pose lifting the golden FIFA World Cup trophy high above his head with both hands, head tilted upward in triumph. He wears a light-blue-and-white striped Argentina kit with the AFA crest clearly visible on the chest and the captain's armband on his left arm. Background: a layered light-blue-and-white graphic backdrop with a huge stylized AFA crest floating faintly behind him as a watermark, golden confetti and gold particles scattered across the frame as graphic accents, a dramatic golden light burst radiating outward from behind the trophy. Vibrant saturated light-blue palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a trophy-lift promotional poster or champions celebration broadcast graphic. The AFA crest visible on the jersey, no on-image text or captions, no scoreboard graphics.` |

### Step 5: Self-validate before writing

- Total word count + scene count + duration are all in the band you picked at Step 2.4 based on distinct-points count — do NOT auto-expand to fill 90–180s
- Scene count between 6 (lower bound for 3–4 substantive points) and 15 (upper bound for 8+ substantive points)
- scenes[0].type === "hook"
- **second-to-last scene template === "engagement-question"** (mandatory channel convention — derived from content; see "Engagement question" rule above)
- last scene type === "outro"
- Each text field ≤ schema max (use the field caps in `script-schema.ts` — e.g., `headline ≤ 40`, `bullets[i] ≤ 50`)
- Every hook/callout/stat-hero has an `imagePrompt` — fix yourself silently if missing

### Step 6: Write script.json

Use the `Write` tool to write to `<outputDir>/script.json`.

**Plan mode extra rule:** every plan scene must appear in script.json with the EXACT same `id` and a matching `templateData.template`. Mismatched ids = staged image won't bind. `imagePrompt` field should be copied verbatim from the plan (it acts as a fallback if the staged image is later removed).

### Step 7 (plan mode only): Stage planned images

If `images-plan.json` exists alongside the source .txt, run:

```bash
npm run images:stage -- <pathToSourceTxt>
```

The script:
1. Reads `images-plan.json`
2. Verifies every planned `filename` exists in the input folder
3. **Exits non-zero** with a list of missing files (and their prompts) if any are absent
4. Otherwise copies each planned file to `video/output/<slug>/images/<sceneId>.<ext>` so the pipeline's override mechanism picks them up

If the staging step fails:
- DO NOT proceed to the pipeline.
- Surface the missing-files list verbatim to the user.
- Tell them to generate the missing images on grok.com using the listed prompts and re-run `/create-video`.

### Step 8: Run the pipeline

```bash
npm run pipeline -- <outputDir>/script.json
```

**Expected latency:** TTS ~30–60s + image gen ~30–90s (parallel) + render ~3–5min. Analysis videos take longer than news due to more scenes.

In plan mode the image generation step is essentially free — every eligible scene already has a staged file at `video/output/<slug>/images/<sceneId>.<ext>`, so the pipeline logs `MANUAL OVERRIDE` for each and skips the AI provider entirely.

### Step 9: Report success

```markdown
✓ Video:  [video.mp4](<outputDir>/video.mp4)
✓ Audio:  [voice.mp3](<outputDir>/voice.mp3) — for CapCut
✓ Script: [script.txt](<outputDir>/script.txt) — for CapCut auto-caption
Tổng thời lượng: XX.Xs
```

(Use the actual output dir — `video/output/<slug>/` in plan mode, `video/output/<slug>-<timestamp>/` in free-form mode.)

## Examples

### Example 1: List / Ranking — "Top 5 Vua phá lưới C1 mùa 2024-25"

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Top 5 Vua phá lưới Champions League mùa 2024-25",
    "source": { "url": "local", "domain": "local", "image": null },
    "channel": "SportsForAllTV"
  },
  "voice": { "provider": "ausynclab", "voiceId": "${VOICE_ID}", "speed": 0.90 },
  "scenes": [
    {
      "id": "hook", "type": "hook",
      "voiceText": "Năm cây săn bàn đáng sợ nhất Champions League mùa hai nghìn không trăm hai mươi bốn — ai đứng đầu sẽ khiến bạn bất ngờ.",
      "templateData": { "template": "hook", "headline": "Top 5 Vua phá lưới", "subhead": "Champions League 24-25", "kenBurns": "zoom-in" },
      "imagePrompt": "Vertical 9:16 football poster artwork. Centre composition: the iconic UEFA Champions League starball trophy rising hero-style from the lower frame, dramatic golden light burst radiating outward behind it. Background: a layered dark navy graphic backdrop with a huge stylized UCL starball pattern floating faintly as a watermark, multi-club scarves rendered as graphic color bands at the lower frame edge (Real Madrid white, Liverpool red, Barcelona blue-and-red, Bayern red, PSG navy). Vibrant saturated palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League knockout matchday graphic. No on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "rank-5", "type": "body",
      "voiceText": "Hạng năm, Vinicius Junior — chín bàn cùng năm pha kiến tạo, tốc độ và kỹ thuật của anh vẫn là cơn ác mộng cho mọi hàng thủ.",
      "templateData": { "template": "stat-hero", "value": "9", "label": "Vinicius Jr.", "context": "Bàn thắng + 5 kiến tạo" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Vinícius Júnior, the Brazilian winger for Real Madrid and the Brazil national team, in a hero composition mid-stride driving forward with the ball, intense focused expression. He wears a white Real Madrid home kit with the Real Madrid crest clearly visible on the chest. Background: a layered white-and-gold Real Madrid graphic backdrop with a huge stylized Real Madrid crest floating faintly behind him as a watermark, the Bernabéu's metallic skin abstracted as a subtle silhouette motif, dramatic golden light rays radiating outward. Vibrant saturated white palette with bold gold and royal-purple accents, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League matchday graphic. The Real Madrid crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "rank-4", "type": "body",
      "voiceText": "Hạng tư, Robert Lewandowski — mười bàn cho Barcelona, một tay đưa đội bóng vào bán kết.",
      "templateData": { "template": "stat-hero", "value": "10", "label": "R. Lewandowski", "context": "Bàn thắng / 11 trận" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Robert Lewandowski, the Polish striker for Barcelona and the Poland national team, in a hero pose celebrating a goal with arms outstretched and an open-mouthed shout. He wears a dark-blue-and-red striped Barcelona home kit with the FC Barcelona crest clearly visible on the chest. Background: a layered blaugrana graphic backdrop with a huge stylized FC Barcelona crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head, faint stylized fan-crowd silhouettes in blaugrana at the lower frame edge as graphic color bands. Vibrant saturated blaugrana palette with golden accents, very high contrast, glossy graphic-design finish. Stylized like a Premier League / UCL matchday promotional poster. The FC Barcelona crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "rank-3", "type": "body",
      "voiceText": "Hạng ba, Kylian Mbappe — mười một bàn trong mùa đầu khoác áo Real Madrid, tốc độ vẫn không có đối thủ.",
      "templateData": { "template": "stat-hero", "value": "11", "label": "Kylian Mbappe", "context": "Mùa đầu tại Real" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Kylian Mbappé, the French striker for Real Madrid and the France national team, in a hero composition mid-sprint with the ball at his feet, intense focused expression. He wears a white Real Madrid home kit with the Real Madrid crest clearly visible on the chest. Background: a layered white-and-gold Real Madrid graphic backdrop with a huge stylized Real Madrid crest floating faintly behind him as a watermark, the Bernabéu's metallic exterior abstracted as a subtle silhouette motif in the upper background, dramatic golden light rays radiating outward. Vibrant saturated white palette with bold gold and royal-purple accents, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League matchday graphic. The Real Madrid crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "rank-2", "type": "body",
      "voiceText": "Hạng nhì, Erling Haaland — mười ba bàn cho Manchester City, hiệu suất gần như mỗi trận một bàn.",
      "templateData": { "template": "stat-hero", "value": "13", "label": "Erling Haaland", "context": "Hơn 1 bàn / trận" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Erling Haaland, the Norwegian striker for Manchester City and the Norway national team, in a hero pose celebrating with both arms outstretched and an open-mouthed roaring shout. He wears a sky-blue Manchester City home kit with the Manchester City crest clearly visible on the chest. Background: a vivid sky-blue Manchester City graphic backdrop with a huge stylized Manchester City crest floating faintly behind him as a watermark, a dramatic golden light burst radiating outward from behind, gold particles scattered across the frame as graphic accents. Vibrant saturated sky-blue palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a Premier League matchday promotional poster. The Manchester City crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "rank-1-tease", "type": "body",
      "voiceText": "Và hạng nhất sẽ khiến nhiều người bất ngờ — không phải Mbappe, không phải Haaland.",
      "templateData": { "template": "callout", "statement": "Hạng nhất không phải tên bạn nghĩ.", "tag": "Twist" },
      "imagePrompt": "Vertical 9:16 football poster artwork. Centre composition: stylized fan-crowd silhouettes in a wall of bright yellow filling the lower two-thirds of the frame (Borussia Dortmund Yellow Wall motif), scarves raised above heads as graphic color bands, a stylized 'BVB' tifo banner ribbon graphic unfurling across the upper frame. Background: a layered yellow-and-black BVB graphic backdrop with a huge stylized Borussia Dortmund crest floating faintly as a watermark, dramatic yellow light rays radiating outward, anticipation atmosphere with question-mark accent graphic in a corner. Vibrant saturated yellow palette with bold black accents, very high contrast, glossy graphic-design finish. Stylized like a Bundesliga matchday promotional poster. The Borussia Dortmund crest visible as the watermark, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "rank-1", "type": "body",
      "voiceText": "Hạng nhất, Raphinha — mười lăm bàn thắng cùng tám pha kiến tạo, người đã khoác lên Barcelona một sức sống mới.",
      "templateData": { "template": "stat-hero", "value": "15 + 8", "label": "Raphinha", "context": "Bàn thắng + kiến tạo" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Raphinha, the Brazilian winger for Barcelona and the Brazil national team, in a hero pose celebrating with arms wide and an intense ecstatic expression. He wears a dark-blue-and-red striped Barcelona home kit with the FC Barcelona crest clearly visible on the chest. Background: a layered blaugrana graphic backdrop with a huge stylized FC Barcelona crest floating faintly behind him as a watermark, dramatic golden light burst radiating outward from behind his head, faint stylized blaugrana fan-crowd silhouettes as graphic color bands at the lower frame edge. Vibrant saturated blaugrana palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League top-scorer promotional poster. The FC Barcelona crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "context", "type": "body",
      "voiceText": "Một mùa giải mà các tiền đạo trẻ thực sự thống trị. Bốn trong năm cầu thủ này đều dưới hai mươi sáu tuổi.",
      "templateData": { "template": "callout", "statement": "Thế hệ vàng mới đã đến.", "tag": "Insight" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring a hero-line composition of multiple young European football stars side by side, each in their respective real club home kits — Real Madrid white, Manchester City sky-blue, Barcelona blaugrana stripes, PSG navy — each with their real club crests visible on the chest. Background: a layered multi-color graphic backdrop in overlapping shards of each club's primary color, dramatic golden light rays radiating outward from behind the line, faint stylized European-stars graphic accents in the upper corners (gold UEFA-style stars on a deep blue motif). Vibrant saturated palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like an end-of-season generation broadcast graphic. All club crests visible on the jerseys, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "outro", "type": "outro",
      "voiceText": "Theo dõi Sports For All Ti Vi để xem nhiều phân tích sâu hơn mỗi tuần.",
      "templateData": { "template": "outro", "ctaTop": "Theo dõi ngay", "channelName": "SportsForAllTV", "source": "Sưu tầm" }
    }
  ]
}
```

### Example 2: File mode — VS comparison from `RonaldoOrMessi.txt`

User: `/create-video RonaldoOrMessi.txt`

**Sample input file** (free-form notes, what a user typically writes):
```
Messi vs Ronaldo - ai vĩ đại hơn?

Messi:
- 8 Quả Bóng Vàng
- 821 bàn thắng sự nghiệp
- Vô địch World Cup 2022
- 44 danh hiệu chính thức
- Sút phạt: 65+ bàn
- Cao 1m70

Ronaldo:
- 5 Quả Bóng Vàng
- 924 bàn thắng sự nghiệp
- Vô địch Euro 2016 + Nations League 2019
- 35 danh hiệu chính thức
- Sút phạt: 60+ bàn
- Cao 1m87

Đỉnh cao: Messi tinh tế, Ronaldo bùng nổ.
Cả hai đều đã định nghĩa lại bóng đá hiện đại, mỗi người một cách.
```

**Skill workflow:**
1. `Read` the file → identify VS content from filename + structure.
2. Extract facts: 2 lists of stats per player.
3. Restructure: hook (claim) → 5–7 comparison scenes (one per metric) → final callout (verdict) → outro.
4. Apply phonetic rules: "8 Quả Bóng Vàng" → voiceText `"tám Quả Bóng Vàng"`; "1m70" → `"một mét bảy mươi"`; "821 bàn" → `"tám trăm hai mươi mốt bàn"`.

**Generated `script.json` (excerpt):**
```json
{
  "version": "1.0",
  "metadata": {
    "title": "Messi vs Ronaldo: Ai mới thực sự vĩ đại hơn?",
    "source": { "url": "local", "domain": "local", "image": null },
    "channel": "SportsForAllTV"
  },
  "voice": { "provider": "ausynclab", "voiceId": "${VOICE_ID}", "speed": 0.90 },
  "scenes": [
    {
      "id": "hook", "type": "hook",
      "voiceText": "Messi và Ronaldo: ai mới thực sự vĩ đại hơn? Số liệu sẽ trả lời.",
      "templateData": { "template": "hook", "headline": "Messi vs Ronaldo", "subhead": "Số liệu lên tiếng", "kenBurns": "zoom-in" },
      "imagePrompt": "Vertical 9:16 split-frame football poster artwork showing a generation-defining matchup. Left half: Lionel Messi, the Argentine forward and captain for the Argentina national team, in a light-blue-and-white striped Argentina kit with the AFA crest clearly visible on the chest and the captain's armband on his left arm, intense focused hero pose. Behind him, a stylized light-blue-and-white graphic backdrop with a huge faint AFA crest watermark and radiating light rays. Right half: Cristiano Ronaldo, the Portuguese forward and captain for the Portugal national team, in a dark red Portugal home kit with the FPF crest clearly visible on the chest and the captain's armband on his left arm, mirroring hero pose. Behind him, a stylized red-and-green Portugal graphic backdrop with a huge faint FPF crest watermark and radiating light rays. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow, a golden Ballon d'Or trophy and a glowing UCL starball trophy hovering as stylized graphic accents between them. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a matchday rivalry promotional poster. Both national crests visible on the jerseys, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "compare-balon-dor", "type": "body",
      "voiceText": "Quả Bóng Vàng — Messi tám lần, Ronaldo năm lần. Lợi thế nghiêng về số mười.",
      "templateData": {
        "template": "comparison",
        "left":  { "label": "Messi",   "value": "8 QBV", "color": "cyan" },
        "right": { "label": "Ronaldo", "value": "5 QBV", "color": "purple", "winner": false }
      },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Lionel Messi, the Argentine forward and captain for Inter Miami and the Argentina national team, in a hero pose holding a golden Ballon d'Or trophy at chest height, a calm satisfied expression. He wears a light-blue-and-white striped Argentina kit with the AFA crest clearly visible on the chest and the captain's armband on his left arm. Background: a deep navy-and-gold graphic backdrop with a huge stylized Ballon d'Or graphic floating faintly behind him as a watermark, a dramatic golden halo light burst radiating outward from above the trophy, gold particles scattered across the frame as graphic accents. Vibrant saturated navy palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a Ballon d'Or ceremony broadcast graphic. The AFA crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "compare-goals", "type": "body",
      "voiceText": "Tổng số bàn thắng — Ronaldo dẫn trước với chín trăm hai mươi bốn, Messi tám trăm hai mươi mốt.",
      "templateData": {
        "template": "comparison",
        "left":  { "label": "Messi",   "value": "821 bàn", "color": "cyan" },
        "right": { "label": "Ronaldo", "value": "924 bàn", "color": "purple", "winner": true }
      },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Al-Nassr and the Portugal national team, in his Real Madrid era — in a hero pose mid-air doing his iconic SIU jump celebration, body twisted at the peak with arms outstretched. He wears a white Real Madrid home kit with the Real Madrid crest clearly visible on the chest. Background: a layered white-and-gold Real Madrid graphic backdrop with a huge stylized Real Madrid crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward from below his airborne pose, gold particles and confetti graphic accents. Vibrant saturated white palette with bold gold and royal-purple accents, very high contrast, glossy graphic-design finish. Stylized like a UEFA Champions League knockout matchday graphic. The Real Madrid crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "compare-trophies", "type": "body",
      "voiceText": "Danh hiệu chính thức — Messi bốn mươi bốn, Ronaldo ba mươi lăm. Số mười áp đảo về sưu tập.",
      "templateData": {
        "template": "comparison",
        "left":  { "label": "Messi",   "value": "44 cúp", "color": "cyan", "winner": true },
        "right": { "label": "Ronaldo", "value": "35 cúp", "color": "purple" }
      }
    },
    {
      "id": "compare-international", "type": "body",
      "voiceText": "Đấu trường quốc tế — Messi vô địch World Cup hai nghìn không trăm hai mươi hai, Ronaldo có Euro hai nghìn không trăm mười sáu và Nations League.",
      "templateData": {
        "template": "comparison",
        "left":  { "label": "Messi",   "value": "World Cup",  "color": "cyan", "winner": true },
        "right": { "label": "Ronaldo", "value": "Euro + NL",  "color": "purple" }
      },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Lionel Messi, the Argentine captain for the Argentina national team, in a hero pose lifting the golden FIFA World Cup trophy high above his head with both hands, head tilted upward in triumph. He wears a light-blue-and-white striped Argentina kit with the AFA crest clearly visible on the chest and the captain's armband on his left arm. Background: a layered light-blue-and-white graphic backdrop with a huge stylized AFA crest floating faintly behind him as a watermark, golden confetti and gold particles scattered across the frame as graphic accents, a dramatic golden light burst radiating outward from behind the trophy. Vibrant saturated light-blue palette with bold gold accents, very high contrast, glossy graphic-design finish. Stylized like a trophy-lift promotional poster or 2022 World Cup champions celebration broadcast graphic. The AFA crest visible on the jersey, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "compare-style", "type": "body",
      "voiceText": "Phong cách — Messi tinh tế, không gian, kỹ thuật cá nhân. Ronaldo bùng nổ, thể chất, không chiến.",
      "templateData": { "template": "callout", "statement": "Messi tinh tế. Ronaldo bùng nổ.", "tag": "Phong cách" },
      "imagePrompt": "Vertical 9:16 split-frame football poster artwork showing two contrasting football styles. Left half: a stylized close-up composition of dancing footwork on the ball low to the grass, the dribbler's planted leg as the hero element, against a deep blue graphic backdrop with abstract motion-trail graphic lines curving around the ball. Right half: a powerful mid-air header at the top of a jump, neck muscles tensed, against a deep red graphic backdrop with explosive light-burst rays radiating outward from the impact point. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a matchday rivalry promotional poster. No on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "compare-physical", "type": "body",
      "voiceText": "Về thể hình — Messi cao một mét bảy mươi, Ronaldo một mét tám mươi bảy. Người ta tài năng theo những cách rất khác nhau.",
      "templateData": {
        "template": "comparison",
        "left":  { "label": "Messi",   "value": "1m70", "color": "cyan" },
        "right": { "label": "Ronaldo", "value": "1m87", "color": "purple" }
      }
    },
    {
      "id": "verdict", "type": "body",
      "voiceText": "Câu trả lời thật ra không có. Cả hai đã định nghĩa lại bóng đá hiện đại, mỗi người một cách. Chúng ta may mắn vì được sống cùng thời đại của họ.",
      "templateData": { "template": "callout", "statement": "Cả hai đều là huyền thoại — theo cách của riêng mình.", "tag": "Verdict" },
      "imagePrompt": "Vertical 9:16 football poster artwork featuring Lionel Messi and Cristiano Ronaldo together in a hero composition, exchanging a respectful handshake with quiet smiles. Messi on the left in a light-blue-and-white striped Argentina kit with the AFA crest clearly visible on the chest; Ronaldo on the right in a dark red Portugal home kit with the FPF crest clearly visible on the chest. Background: a layered split graphic backdrop — light-blue-and-white on Messi's side, red-and-green on Ronaldo's side — meeting in the centre where the two players' hands clasp, both national team crests floating faintly as huge watermarks on their respective sides, golden light rays radiating outward from the centre handshake point. Vibrant saturated palette with warm golden accents, very high contrast, glossy graphic-design finish. Stylized like a mutual-respect tribute broadcast graphic. Both national crests visible on the jerseys, no on-image text or captions, no scoreboard graphics."
    },
    {
      "id": "outro", "type": "outro",
      "voiceText": "Theo dõi Sports For All Ti Vi để xem nhiều phân tích sâu hơn mỗi tuần.",
      "templateData": { "template": "outro", "ctaTop": "Theo dõi ngay", "channelName": "SportsForAllTV", "source": "Sưu tầm" }
    }
  ]
}
```

**Notes about the transformation:**
- Source file used `8 QBV` / `1m70` / `821 bàn` → voiceText spells out `"tám Quả Bóng Vàng"` / `"một mét bảy mươi"` / `"tám trăm hai mươi mốt bàn"` per phonetic rules. The visual `templateData.value` keeps the compact original (`"8 QBV"`, `"1m70"`, `"821 bàn"`).
- 9 scenes total (1 hook + 7 body + 1 outro). Within the 5–16 schema cap and the 10–15 analysis target window.
- `winner: true` is set per metric on whichever player leads.
- The user's note "ai vĩ đại hơn" gets a balanced verdict scene rather than a forced winner — preserves the user's nuanced ending.

### Example 3: History / Career — "Cầu thủ còn thi đấu từ World Cup 2006"

Structure: hook → 1 scene per remaining player (callout with story + stat-hero with key number) → final reflection callout → outro.

Each player scene benefits from imagePrompt that names the player + club + national team and pairs it with a signature scene/pose (e.g., `"Cinematic photo of Sergio Ramos, the Spanish defender for the Spain national team, lifting the World Cup trophy in 2010..."`). Don't describe facial features.

## Edge cases

| Situation | Action |
|---|---|
| User passed a URL instead of `.txt` | Reject at Step 1; point them at `/read-rewrite <url>` first |
| `.txt` file does not exist | Reject at Step 1 with the bad path echoed back |
| `.txt` file exists but is empty / unreadable | Reject at Step 1 with a clear error |
| Source has < 3 distinct substantive points | **Bail at Step 2.4.** Tell user the source is too thin and ask for more facts/context; do NOT proceed |
| Plan has more image-eligible scenes than source supports | Surface the mismatch; recommend re-running `/images-for-videos` to refresh the plan |
| Total duration falls below the band picked at Step 2.4 | OK — sign that content is even thinner than counted; do NOT add filler scenes |
| Total duration exceeds the band picked at Step 2.4 | Cut the weakest body scene(s) or shorten voiceText — staying in band > "covering everything" |

## Channel context

This skill writes for the **SportsForAllTV** (`@bonglan0702`) channel — Vietnamese football news + analysis. Outro and metadata.channel are both `"SportsForAllTV"`. See `memory/project_channel_focus.md` for full brand context.
