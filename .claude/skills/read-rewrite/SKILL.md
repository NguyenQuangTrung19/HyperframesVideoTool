---
name: read-rewrite
description: Read a football article URL, rewrite it into a structured Vietnamese .txt under the SportsForAllTV brand, save it as input/<slug>/<slug>.txt, then chain into the images-for-videos skill so the user gets a complete image plan in one command. Wraps WebFetch + rewrite + images-for-videos.
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

> Extract the full article text, the headline, the publication date, and any direct quotes from named speakers. Do not summarize. Return the raw content with the quotes attributed.

If the result looks like one of these failure modes:
- Less than ~500 characters of meaningful body text
- Mostly paywall / login language (`"đăng ký"`, `"subscribe"`, `"continue reading"`, `"tiếp tục đọc"`)
- A 404 / error page / "page not found"
- Clearly bot-blocked (Cloudflare challenge, "are you human", etc.)

Then **STOP** and reply with a concrete fallback:

```
⚠ Không đọc được URL (có vẻ paywall / 404 / chặn bot).
Bạn paste nội dung bài báo vào prompt tiếp theo, mình sẽ tiếp tục từ đó.
```

Wait for the user's paste; treat it the same as a successful WebFetch result and continue from Step 2.

### Step 2: Sanity-check it's football content

Quick check: does the fetched text mention football clubs / players / matches / leagues / coaches? If clearly NOT football (random news, tech, finance, etc.), stop and tell the user:

```
⚠ URL này không phải bài bóng đá — SportsForAllTV chỉ làm content bóng đá. Bạn check lại link nhé?
```

### Step 3: Rewrite into Vietnamese under the SportsForAllTV brand

If the source is English / other language → translate to Vietnamese while rewriting. If the source is already Vietnamese → keep most of it but tighten phrasing and re-tone where the original is verbose / clickbaity / too formal.

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
- <fact 4>
- <fact 5>

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
- **Key facts:** 4–7 bullets. Each ≤ 25 words. Arabic digits (`3-1`, `82%`, `€80M`). Full proper-noun diacritics (`Mbappé`, `Vinícius Júnior`, `Việt Nam`, `Bồ Đào Nha`).
- **Context:** 2–4 bullets. Optional but **strongly preferred** — gives `classify-football-content` enough signal in Step 6 to pick the right scene structure (RANKING vs MATCH ANALYSIS vs PRE-MATCH PREVIEW etc.). If you skip context, the downstream classifier may guess wrong.
- **Quotes:** include only direct quotes that exist in the source. If the article had no quotes, **omit the entire `## Quotes` section** — don't fabricate.
- **Source line:** keep the domain + the full URL. Future tools (and you, in later sessions) can backtrack from this.
- **Date:** if WebFetch returned the publication date, include it; else write `n/a`.
- **Total length:** 200–500 words across the whole document. If the source is much longer, compress; if shorter, don't pad.

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

If `input/<slug>/` already exists AND contains files, append a counter: `<slug>-2`, `<slug>-3`, ... until you find a free name. Tell the user in the final summary that you used a suffixed slug.

Create the directory: `input/<slug>/`. Write the structured content from Step 4 to `input/<slug>/<slug>.txt` using `Write`.

### Step 6: Hand off to images-for-videos

Now invoke the [`images-for-videos`](../images-for-videos/SKILL.md) skill on the newly-created file. Pass `input/<slug>/<slug>.txt` as the argument.

That skill will:
1. Read the .txt
2. Classify the content type via `classify-football-content`
3. Plan scenes + write image prompts (English, Grok-optimized, with name+club+nation identity anchors and real club iconography per existing rules)
4. Write `images-plan.json` and `grok-prompts.md` next to the .txt

Do NOT duplicate any of that skill's logic here — just chain into it as the next step in your workflow. All existing rules (image prompt typography, real iconography, name-not-features) apply automatically because they live in that skill.

### Step 7: Reply concisely

After the chained skill completes, reply with one combined summary covering both halves of the work:

```
✓ Bài báo đã rewrite: input/<slug>/<slug>.txt
✓ Image plan: input/<slug>/images-plan.json
✓ Grok prompts: input/<slug>/grok-prompts.md  (mở file này để copy)

Phân loại: <CONTENT TYPE từ classify skill>
<N> ảnh cần tạo trên grok.com (Imagine, aspect ratio 9:16):

Tiếp theo:
1. Mở grok-prompts.md → copy từng prompt → grok.com → save về cùng folder theo đúng tên file
2. Khi đủ <N> ảnh, chạy: /create-video input/<slug>/<slug>.txt

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
| Slug collides with existing `input/<slug>/` | Append `-2`, `-3`, ... until free; mention in the final summary |
| User passes a non-URL argument | Reject; point them at `/images-for-videos <path>` for existing `.txt` files |
| WebFetch returns content but it's mostly noise (nav, ads) and very little article | Treat as a fetch failure → fallback message |

## Relationship to other skills

```
URL ──/read-rewrite──► input/<slug>/<slug>.txt
                              │
                              ├──/images-for-videos (chained automatically)──► images-plan.json + grok-prompts.md
                              │                                                        │
                              │                                              user generates images on grok.com
                              │                                                        │
                              └──/create-video (user runs after images saved)─────────► output/<slug>/script.json + final.mp4
```

`/read-rewrite` covers the first arrow only and chains the second. The user still drives the third (image gen + final video build) because (a) they want manual control over hero images per the visual-first workflow, and (b) those steps cost time/quota and shouldn't auto-run.
