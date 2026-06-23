---
name: read-rewrite
description: Read a football article URL, rewrite it into a structured Vietnamese .txt under the SportsForAllTV brand, save it as video/input/<slug>/<slug>.txt, then chain into the images-for-videos skill so the user gets a complete image plan in one command. Wraps WebFetch + rewrite + images-for-videos.
---

# Read-Rewrite Skill

URL → structured Vietnamese source → image plan, in one command. Removes the manual "copy article into a .txt by hand" step that previously sat between reading a source and running `/images-for-videos`.

## When to use

User runs `/read-rewrite <url>`. Examples:

- `/read-rewrite https://vnexpress.net/bayern-loai-psg-3-1-...`
- `/read-rewrite https://www.goal.com/en/news/...`
- `/read-rewrite https://thethao247.vn/...`

This is the **URL-driven entry point for the video pipeline.** Output is a `.txt` source + `images-plan.json`, both ready for the user to (a) generate planned images on grok.com, then (b) run `/create-video` to assemble the final video.

## Input contract

Single argument — a `http://` or `https://` URL pointing to a football article (Vietnamese or international). Reject anything that isn't a URL with a clear pointer: "Skill cần URL bài báo. Với file `.txt` có sẵn, dùng `/images-for-videos`."

## Workflow (MUST follow these steps in order)

### Step 1: Fetch the article

Use `WebFetch` with a prompt like:

> Return the COMPLETE article verbatim — every paragraph in order, preserving ALL names, numbers, dates, statistics, scores, and direct quotes exactly as written. Do NOT summarize, condense, paraphrase, or skip paragraphs. If the article is long, return all of it; do not stop early. Also return the headline and publication date. Attribute each quote to its speaker.

**⚠️ Insist on completeness — WebFetch (read_url_content) often silently summarizes or fails on JS-rendered pages.** Even when the page loads fine, the fetch can come back condensed or blank. 
- **JS-rendered page fallback:** If the fast fetch (`read_url_content`) returns blank/thin text (under 500 characters) due to Client-Side Rendering (Next.js/React like Goal.com match pages), **you MUST automatically use `browser_subagent`** to open the URL, wait for it to render completely, and extract the page text (`document.body.innerText`).
- If the returned text looks summarized or noticeably shorter than the real article would be, **re-run the fetch ONCE** with an even more explicit demand for the full verbatim text. Never proceed to rewrite from a summary — a lossy fetch guarantees a lossy `.txt`.

If both fetch methods result in one of these failure modes:
- Less than ~500 characters of meaningful body text
- Mostly paywall / login language (`"đăng ký"`, `"subscribe"`, `"continue reading"`, `"tiếp tục đọc"`)
- A 404 / error page / "page not found"
- Clearly bot-blocked (Cloudflare challenge, "are you human", etc.)

Then **STOP** and reply with a concrete fallback:

```
⚠ Không đọc được URL (có vẻ paywall / 404 / chặn bot).
Bạn paste nội dung bài báo vào prompt tiếp theo, mình sẽ tiếp tục từ đó.
```

Wait for the user's paste; treat it the same as a successful fetch result and continue from Step 2.

### Step 2: Sanity-check it's football content

Quick check: does the fetched text mention football clubs / players / matches / leagues / coaches? If clearly NOT football (random news, tech, finance, etc.), stop and tell the user:

```
⚠ URL này không phải bài bóng đá — SportsForAllTV chỉ làm content bóng đá. Bạn check lại link nhé?
```

### Step 3: Rewrite into Vietnamese under the SportsForAllTV brand

> **🔑 Nguyên tắc #1 — rewrite đổi GIỌNG, KHÔNG đổi LƯỢNG THÔNG TIN.**
> Viết lại là để câu chữ gọn, đúng tone, đúng lexicon — **không phải để rút ngắn nội dung**. Mọi thông tin có trong bài gốc phải còn nguyên trong `.txt`: từng tên người, số liệu, tỉ số, mốc thời gian, diễn biến, so sánh, hệ quả, trích dẫn. "Gọn" = bỏ chữ thừa / câu lặp / boilerplate (quảng cáo, bài liên quan, nav), **TUYỆT ĐỐI không bỏ fact**. Khi phân vân giữ hay bỏ một chi tiết → **GIỮ**. Thà `.txt` dài còn hơn mất thông tin — `/create-video` sẽ tự chọn cái nào lên hình, nhưng nó chỉ chọn được từ những gì có trong `.txt`. Không có "tóm tắt cho ngắn".

If the source is English / other language → translate to Vietnamese while rewriting. If the source is already Vietnamese → keep most of it but tighten phrasing and re-tone where the original is verbose / clickbaity / too formal. **Tightening = câu chữ, không phải lược bỏ thông tin.**

Channel voice ("SportsForAllTV") — **nhà báo bóng đá VN chuyên nghiệp**:

- **Gọn, có nhịp.** Câu ngắn, một ý / câu. Không lê thê, không câu ghép nhiều mệnh đề.
- **Active voice, fact lead.** "Bruno chọc khe cho Mbeumo" thay "Đường chuyền được Bruno thực hiện cho Mbeumo". Lead với fact + số liệu, không cảm thán mở bài.
- **Lexicon chuyên thay phổ thông** (xem chi tiết `memory/feedback_football_lexicon.md` + section "Journalistic voice" trong `/create-video`):
  - "đường chuyền giấu" → "lừa hướng / chọc khe lừa hướng"
  - "xuyên tuyến" → "chọc khe"
  - "kiến tạo" → "pha kiến tạo"; "cơ hội tạo ra" → "pha kiến tạo cơ hội"
  - "đặt bóng vào đúng chỗ" → "đặt điểm rơi"
  - "số 10" (mô tả style) → "nhạc trưởng"
  - "tham gia bàn thắng" → "pha tham gia bàn thắng"
  - Đa dạng nickname club khi lặp lại: Quỷ Đỏ (MU), Pháo Thủ (Arsenal), Gà Trống (Spurs), Lữ đoàn đỏ (Liverpool), Hùm xám (Bayern), Vua trắng (Real), Á thánh (Barca).
- **Specific over generic.** Đừng "đặc biệt / tuyệt vời / ấn tượng" alone — back ngay bằng số liệu hoặc hành vi cụ thể.
- **Attribution rõ.** "Theo Opta", "theo Sky Sports", "Carrick nói" — câu chứa số liệu hoặc trích dẫn cần nguồn rõ.
- **Tránh:** clickbait ("không thể tin nổi", "chấn động", "sốc" — trừ khi event thật sự xứng); câu chữ thừa ("có thể nói rằng", "phải nói rằng"); ALL CAPS; "em / mình / bạn" (3rd person trừ direct CTA).
- **Drop boilerplate** WebFetch trả về: ads, related-articles, social-share buttons, footer, comment, "Đọc thêm:".
- **Benchmark tone:** Goal Vietnam, Vnexpress thể thao, Sky Sports VN, BongDaPlus, bình luận viên Quang Tùng / Anh Ngọc / Vũ Quang Huy. File .txt phải đọc như một bài viết của họ.

#### ⚠️ Semantic / ambiguity filter — đọc lên thành tiếng trước khi save

Mọi câu trong `.txt` rewrite phải đi qua pass đọc-lên-thành-tiếng. Tone chuyên + lexicon đúng không đủ — câu phải **hợp nghĩa, parse một nghĩa duy nhất**. Bug điển hình thấy đi thấy lại (xem `memory/feedback_vietnamese_voicetext_ambiguity.md`):

1. **`phải` body-side vs `phải` modal** — *"dây chằng đầu gối phải đứt"* parse mặc định là "knee MUST tear" thay vì "right-knee tore". **Drop side info hoặc dùng `bên phải`**, và dùng `bị` cho event chấn thương:
   - ❌ `"dây chằng đầu gối phải đứt"` / `"vai phải gãy"` / `"chân phải đau"`
   - ✅ `"anh bị đứt dây chằng đầu gối"` / `"anh dính chấn thương dây chằng"` / `"chấn thương ở bên phải"`
2. **`bị` cho unfortunate events** (chấn thương, đứt, gãy, treo giò, dính thẻ, mất điểm, lỡ giải) — không bao giờ subject-less:
   - ❌ `"Dây chằng đứt. Mổ sụn chêm."`
   - ✅ `"Anh bị đứt dây chằng. Phải mổ sụn chêm."`
3. **Fragment sentences cần subject rõ** khi tiếp nối — đặc biệt sau câu đổi chủ thể:
   - ❌ `"Brazil thua Uruguay. Đứt dây chằng đầu gối."` ← Brazil đứt dây chằng?
   - ✅ `"Brazil thua Uruguay. Sau trận đó, Neymar bị đứt dây chằng."`
4. **Quote 1st person phải có signal verb / dấu hai chấm** — đừng để `tôi` / `mình` xuất hiện đột ngột:
   - ❌ `"Ancelotti dứt khoát. Tôi không phải nhà ảo thuật."`
   - ✅ `"Ancelotti nói thẳng: 'Tôi không phải nhà ảo thuật.'"` / `"Ông không tự nhận là nhà ảo thuật."` (3rd person reframe)
5. **`của` possessive xa subject — dễ ambiguous**:
   - ❌ `"Brazil của Neymar vào bán kết"` (Brazil thuộc về Neymar?)
   - ✅ `"Brazil cùng Neymar vào bán kết"` / `"Selecao có Neymar trong đội hình"`
6. **`hơn cả X` vs `hơn X`** — `cả` thừa khi không nhấn cụ thể:
   - ❌ `"hơn cả Pele 2 bàn"`  ✅ `"hơn Pele đúng 2 bàn"` / `"vượt Pele 2 bàn"`
7. **Pronouns repeat trong 2 câu liên tiếp** — `"Tôi không... Tôi đã..."` đọc rất dở. Gộp câu hoặc reframe 3rd person.

**Self-check trước khi `Write`:**
- [ ] Đọc cả file lên trong đầu — câu nào parse 2 nghĩa? Câu nào nghe gượng? Câu nào subject mờ?
- [ ] Mỗi `phải` — modal, body-side, hay copula? Body-side → swap qualifier hoặc drop.
- [ ] Mỗi fragment / câu rút gọn — subject có rõ không?
- [ ] Quote → có signal verb không? Hoặc reframe 3rd person.
- [ ] Bài này nếu Quang Tùng hoặc BTV Goal Vietnam đọc lên, có nghe tự nhiên không? Nếu không → sửa.

Apply existing typography rules (capitalization, full diacritics on proper nouns, Arabic digits) — they're already in memory and the `create-video` skill.

### Step 4: Structure the .txt

Output template — this is the literal file content (plain markdown, UTF-8):

```markdown
<Vietnamese rewritten title — sentence case, 5-12 words>

<1-2 sentence lead — the headline news in one breath, 25-60 words>

## Key facts
- <fact 1>
- <fact 2>
- <fact 3>
- ...
- <fact N — extract ALL substantive facts from the source>

## Context
- <historical / standings / form note that frames the story>
- <relevant stat or comparison the lead doesn't already cover>

## Quotes
- "<quote 1>" — <speaker, role>
- "<quote 2>" — <speaker, role>

---
Nguồn: <domain> · <full URL>
Ngày: <publication date if known, else "n/a">
```

Rules for the body:

- **Title (line 1):** 5–12 words, the rewritten Vietnamese headline. Sentence case (only first letter + proper nouns capped, per typography rules). E.g. `"Bayern loại PSG ở bán kết Champions League"`, NOT `"Bayern Loại PSG Ở Bán Kết Champions League"`.
- **Lead:** 1–2 sentences, 25–60 words. The "5W in one breath."
- **Key facts:** Extract **ALL** substantive facts from the source — every stat, name, score, date, event, comparison. Each bullet ≤ 25 words. Arabic digits (`3-1`, `82%`, `€80M`). Full proper-noun diacritics (`Mbappé`, `Vinícius Júnior`, `Việt Nam`, `Bồ Đào Nha`). **Do NOT cap at a fixed number** — a source with 15 distinct facts gets 15 bullets. Only drop truly redundant/restated facts.
- **Context:** Extract **ALL** relevant context from the source — historical standings, form notes, head-to-head records, upcoming fixtures, wider implications. **Strongly preferred** — gives `classify-football-content` enough signal in Step 6 to pick the right scene structure. If you skip context, the downstream classifier may guess wrong.
- **Quotes:** include **ALL** direct quotes that exist in the source, not just 1-2. If the article had no quotes, **omit the entire `## Quotes` section** — don't fabricate.
- **Source line:** keep the domain + the full URL. Future tools (and you, in later sessions) can backtrack from this.
- **Date:** if WebFetch returned the publication date, include it; else write `n/a`.
- **Total length:** Length is whatever it takes to keep every distinct piece of information — do NOT target a word count, and do NOT compress to hit one. **Rule: preserve ALL unique information from the source, regardless of how long the article is.** The ONLY things you ever drop are literal repetition, filler phrasing, and boilerplate (ads, related-articles, nav, "Đọc thêm") — never a distinct fact, stat, name, date, score, quote, or context point. A long article simply yields a long `.txt`; that is correct and expected, not a problem to "fix" by trimming. If tightening for tone would remove a fact, keep the fact and tighten elsewhere.

#### ⚠️ Completeness check (MANDATORY before saving .txt)

Before writing the file, re-read the source and the .txt side by side. Check:
- [ ] Every named person in the source appears in the .txt (player, coach, official)
- [ ] Every stat/number in the source appears in Key facts or Context
- [ ] Every direct quote in the source appears in Quotes
- [ ] Every distinct event/development in the source has a corresponding bullet
- [ ] No fact was "summarized away" into a vague statement — specifics beat summaries
- [ ] **Count check:** tally the distinct facts / numbers / names / quotes in the source vs the `.txt`. The `.txt` count must be **≥** the source count. If the `.txt` carries noticeably less information than the source, you compressed too hard — go back and restore the missing items before saving.

If you find missing info, add it. The downstream `/create-video` skill can select what to include in the video — but it can only select from what's IN the .txt. Missing info here = missing info in the final video. **When unsure whether a detail "matters enough" to include — include it.** Curation happens downstream, not here.

#### ⚠️ Content-specific .txt templates (2026-05-31)

The general template above works for most content. For these specific types, use an **extended template** that preserves more granular data:

**MATCH RECAP (player ratings articles — e.g. Goal.com player ratings):**

```markdown
<Vietnamese rewritten title — e.g. "PSG bảo vệ ngôi vương Champions League qua loạt luân lưu">

<1-2 sentence lead — score, key outcome, headline moment>

## Diễn biến chính
- <key event 1 — goal, penalty, red card with minute>
- <key event 2>
- ...

## Chấm điểm cầu thủ — <Team A>
- <Player Name> — <N>/10: <1-line performance summary, key action>
- <Player Name> — <N>/10: <1-line performance summary>
- ... (EVERY rated player gets their own bullet)

## Chấm điểm cầu thủ — <Team B>
- <Player Name> — <N>/10: <1-line performance summary>
- ... (EVERY rated player)

## Context
- <historical significance, records broken, trophy count>
- <upcoming implications>

## Quotes
- "<quote>" — <speaker, role>

---
Nguồn: <domain> · <full URL>
Ngày: <date>
```

**⚠️ CRITICAL for MATCH RECAP:** Every named player with a rating MUST have their own bullet under `## Chấm điểm`. The downstream `images-for-videos` skill creates 1 image per rated player. If you compress 10 players into 5 bullets, the video will only have 5 player images — and the user has explicitly flagged this as unacceptable quality.

**NEWS DRAMA (social media reactions, troll posts, rivalry banter):**

```markdown
<Vietnamese rewritten title — e.g. "Chelsea troll Arsenal sau chung kết Champions League">

<1-2 sentence lead — who did what, the reaction>

## Sự kiện kích hoạt
- <what happened that triggered the drama — match result, post, statement>

## Phản ứng
- <Reaction 1 — club/person, what they posted/said, engagement metrics if available>
- <Reaction 2 — each distinct reaction gets its own bullet>
- ...

## Lịch sử / Bối cảnh
- <why this matters — historical rivalry context, past trophies, head-to-head>
- <notable individual context — e.g. player who switched clubs>

## Context
- <broader implications — season summary, future outlook>

## Quotes
- "<quote>" — <speaker>

---
Nguồn: <domain> · <full URL>
Ngày: <date>
```

**⚠️ CRITICAL for NEWS DRAMA:** Each distinct reaction/moment gets its own bullet. Don't summarize "many fans reacted" — list the specific club accounts, named players, and notable fan reactions individually. The downstream skill creates 1 image per distinct moment.

### Step 5: Pick the slug + create the input folder

Slugify the rewritten Vietnamese title:

1. **Strip diacritics** — `ạ→a`, `ả→a`, `ấ→a`, `ầ→a`, `ậ→a`, `ằ→a`, `ắ→a`, `ặ→a`, `ẳ→a`, `é→e`, `ê→e`, `ế→e`, `ệ→e`, `ề→e`, `ễ→e`, `ó→o`, `ô→o`, `ố→o`, `ổ→o`, `ộ→o`, `ơ→o`, `ờ→o`, `ớ→o`, `ợ→o`, `ú→u`, `ủ→u`, `ư→u`, `ứ→u`, `ự→u`, `ý→y`, `ỳ→y`, `í→i`, `ị→i`, `đ→d`. (Be thorough — Vietnamese has many diacritic combinations.)
2. **Lowercase**, replace spaces with `-`.
3. **Strip non-alphanumeric** except `-`. Collapse repeated `-`.
4. **Cap to 40 chars** at a word boundary. Strip trailing `-`.

Examples:
- `"Bayern loại PSG ở bán kết Champions League"` → `bayern-loai-psg-o-ban-ket-cl`
- `"Top 5 bàn thắng đẹp nhất tháng 5"` → `top-5-ban-thang-dep-nhat-thang-5`
- `"Mbappé chấn thương: Real Madrid lo lắng"` → `mbappe-chan-thuong-real-madrid-lo`
- `"Đặng Văn Lâm tỏa sáng giúp Việt Nam thắng"` → `dang-van-lam-toa-sang-giup-vn-thang` (manually compress `viet-nam` → `vn` if at the boundary)

**Output directory convention (as of 2026-05-23):** new motion-graphic football content goes under `video/input/<slug>/`. Podcast inputs (`.txt` + 9:16 footage `.mp4`) live under `podcast/input/<slug>/` — that's a different skill, not this one. Legacy folders directly under `input/<slug>/` are kept in place; only new content uses the subfolder layout.

If `video/input/<slug>/` already exists AND contains files, append a counter: `<slug>-2`, `<slug>-3`, ... until you find a free name. Tell the user in the final summary that you used a suffixed slug.

Create the directory: `video/input/<slug>/`. Write the structured content from Step 4 to `video/input/<slug>/<slug>.txt` using `Write`.

### Step 6: Hand off to images-for-videos

Now invoke the [`images-for-videos`](../images-for-videos/SKILL.md) skill on the newly-created file. Pass `video/input/<slug>/<slug>.txt` as the argument.

That skill will:
1. Read the .txt
2. Classify the content type via `classify-football-content`
3. Plan scenes + write image prompts (English, Grok-optimized, with name+club+nation identity anchors and real club iconography per existing rules)
4. Write `images-plan.json` (full English prompts in each scene's `prompt`) + `anh-can-tao.md` (lightweight VN checklist) next to the .txt

Do NOT duplicate any of that skill's logic here — just chain into it as the next step in your workflow. All existing rules (image prompt typography, real iconography, name-not-features) apply automatically because they live in that skill.

### Step 6.5: Record the source in the video queue (queue.xlsx)

After the image plan is written, append this source to the batch render queue so it shows up in `/video-queue` and the worksheet tracks every prepped source in one place. ALWAYS do this once the `.txt` + `images-plan.json` exist.

1. **Read the queue** to find the next free row and avoid duplicates:
   ```bash
   npm run video-queue --silent -- list
   ```
   Parse the JSON. Let `maxRow` = the largest `rowIdx` (or `1` if the queue is empty / only the header exists). The next free row is `maxRow + 1`.
2. **Dedup:** if any existing row's `source` already equals `video/input/<slug>/<slug>.txt`, do NOT add a duplicate. Leave it as-is and skip to Step 7 (mention it was already queued). One exception: if that row's `status` is `done`/`error`, leave it for the user to reset — don't silently re-queue.
3. **Append the row** with the base `.txt` as `source` and `status=planned`. `planned` is exactly the "prepped, waiting for images" state `/video-queue` Pass 2 expects (the `.txt` + `images-plan.json` exist but the user still has to gen images). Always write the BASE source path even if `/images-for-videos` auto-split into parts (`<slug>-p1/`, `-p2/`, …) — the queue fans out parts itself in Pass 2:
   ```bash
   npm run video-queue --silent -- set <maxRow+1> source=video/input/<slug>/<slug>.txt status=planned notes="read-rewrite"
   ```
   Only write `source`, `status`, `notes` — leave `result`/`error` empty.
4. If the helper errors (e.g. queue.xlsx open/locked in Excel), do NOT fail the whole skill — note it in the reply and continue; the user can add the row manually.

### Step 7: Reply concisely

After the chained skill completes, reply with one combined summary covering both halves of the work:

```
✓ Bài báo đã rewrite: video/input/<slug>/<slug>.txt
✓ Image plan: video/input/<slug>/images-plan.json  (prompt English ở field `prompt`)
✓ Checklist ảnh: video/input/<slug>/anh-can-tao.md  (xem cần tạo ảnh gì)

Phân loại: <CONTENT TYPE từ classify skill>
<N> ảnh cần tạo trên grok.com (Imagine, aspect ratio 9:16):
✓ Đã thêm vào hàng đợi render: video/input/queue.xlsx (row <N>, status=planned)

Tiếp theo:
1. Mở anh-can-tao.md → xem cần ảnh gì (prompt English đầy đủ ở images-plan.json) → grok.com → save về cùng folder theo đúng tên file
2. Khi đủ <N> ảnh, chạy: /create-video video/input/<slug>/<slug>.txt — hoặc gen ảnh hết rồi chạy /video-queue để render cả loạt

⚠ Tone đã rewrite theo brand SportsForAllTV — đọc qua file .txt nếu muốn chỉnh trước khi gen ảnh.
```

If you used a suffixed slug (`<slug>-2`, etc.) because the original was taken, mention it explicitly:

```
ℹ Slug "<original>" đã có rồi, dùng "<original>-2" thay.
```

If the WebFetch failed and the user pasted the article, mention it once at the top:

```
ℹ Đọc URL không được, đã rewrite từ nội dung bạn paste.
```

## What this skill does NOT do

- Does not generate images itself — that's manual on grok.com (per the existing visual-first workflow).
- Does not write `script.json` — that's `/create-video`'s job, run AFTER the user has saved their generated images.
- Does not republish the source verbatim — content is rewritten and editorially curated under the SportsForAllTV brand. Always attribute the source in the `Nguồn:` line.
- Does not handle non-football URLs, paywalls, or 404s automatically — bails with a helpful message.

## Edge cases

| Situation | Action |
|---|---|
| URL paywalled / 404 / bot-blocked | Bail with the fallback message; wait for user to paste content; continue from Step 2 |
| Article isn't football | Bail with a clear message; do not proceed |
| Article is in English / other language | Translate to Vietnamese while rewriting (Step 3) |
| Article has no direct quotes | Omit the `## Quotes` section entirely — never fabricate |
| Article is very short (<200 words of body) | Still rewrite + structure; warn the user that the source may be too thin to support a full 10–15-scene analysis video |
| Slug collides with existing `video/input/<slug>/` (or legacy `input/<slug>/`) | Append `-2`, `-3`, ... until free; mention in the final summary |
| User passes a non-URL argument | Reject; point them at `/images-for-videos <path>` for existing `.txt` files |
| WebFetch returns content but it's mostly noise (nav, ads) and very little article | Treat as a fetch failure → fallback message |

## Relationship to other skills

```
URL ──/read-rewrite──► video/input/<slug>/<slug>.txt
                              │
                              ├──/images-for-videos (chained automatically)──► images-plan.json + anh-can-tao.md
                              │                                                        │
                              │                                              user generates images on grok.com
                              │                                                        │
                              └──/create-video (user runs after images saved)─────────► video/output/<slug>/script.json + video.mp4
```

`/read-rewrite` covers the first arrow only and chains the second. The user still drives the third (image gen + final video build) because (a) they want manual control over hero images per the visual-first workflow, and (b) those steps cost time/quota and shouldn't auto-run.
