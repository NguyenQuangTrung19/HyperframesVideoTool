---
name: news-roundup
description: Build a Vietnamese 16:9 (landscape, YouTube) football news roundup from 5-7 article URLs in one command. Fetches every link, drops the ones that are dead/duplicate/off-topic, orders the surviving stories strongest-first, writes ONE roundup .txt under video/input/<slug>/, and plans the LANDSCAPE images each item needs (images-plan.json with aspect 16:9 + anh-can-tao.md). Every scene is a two-column layout — text left, photo in a framed slot right; nothing is full-bleed. The user generates the planned images on grok.com, then runs /create-video to render. Distinct from /read-rewrite — that turns ONE url into ONE 9:16 short; this merges MANY urls into ONE landscape bulletin. The user-facing slash command is `/news-roundup <url1> <url2> … <url7>`.
---

# News-Roundup Skill

Many links → one landscape bulletin. `/read-rewrite` maps one article to one 9:16 short; this skill takes the 5–7 stories of a news cycle and builds a single **16:9 video for YouTube**, item by item, the way a TV sports bulletin runs.

## When to use

User runs `/news-roundup <url1> <url2> …`. Examples:

- `/news-roundup https://goal.com/... https://theanalyst.com/... https://bongdaplus.vn/...`
- `/news-roundup` + a pasted list of links, one per line

**Do NOT use this skill** when:
- there is only ONE link → `/read-rewrite` (a 9:16 short)
- the links are all about the SAME match/story → `/read-rewrite` on the richest one; a roundup needs distinct stories
- the user wants a 9:16 short from several links → `/read-rewrite`, per [[project_read_rewrite_multi_url_merge]] (default is SPLIT, merge only rescues thin articles)

## Input contract

Two or more `http(s)://` URLs, whitespace- or newline-separated. Sweet spot is 5–7; accept 3–8.

- **< 3 usable links** → stop, don't write anything: *"Chỉ còn <N> bài dùng được — bản tin cần ít nhất 3 tin. Gửi thêm link hoặc dùng /read-rewrite cho bài lẻ."*
- **> 8 links** → take the 8 strongest, tell the user which ones you dropped and why.

## What makes this video different from every other skill's output

| | 9:16 skills (`/create-video`, `/read-rewrite`, …) | `/news-roundup` |
|---|---|---|
| Canvas | 1080×1920 | **1920×1080** (`metadata.aspect: "16:9"`) |
| Ceiling | 45 s, ~11 scenes (16 từ/cảnh) | **360 s (6 phút), ≤ 24 scenes** — luật nhịp short KHÔNG áp |
| Full-bleed | hook only | **never** — not even the hook |
| Every scene | photo centred, text under it | **two columns** — text left, photo in a framed slot right |
| Image orientation | portrait/any | any — the slot changes shape (ngang 908×605 · vuông 780² · dọc 640×834), the photo is never cropped to fit |
| Split-frame | used for VS / pair scenes | **never** — one subject per image |
| Source | one article | 5–7 articles, one section each |

The landscape geometry lives in `src/render/templates/styles-landscape.css`; you never edit it from here.

## Workflow (MUST follow these steps in order)

### Step 1: Dedupe against the queue BEFORE fetching

Per [[feedback_read_rewrite_check_queue_before_writing]], read the queue first — fetching 7 articles only to find 3 were already made is pure waste:

```bash
npm run video-queue --silent -- list
```

Drop any URL that already appears in a row's `source` slug or notes. A row with `status=planned` is *waiting for images*, not free to overwrite. **Trùng CHỦ ĐỀ ≠ trùng BÀI** — a genuine sequel (the next beat of a running saga) still counts as a new item; only the same article is a duplicate.

Tell the user which links you dropped and why, then continue with the rest.

### Step 2: Fetch every surviving article

One `WebFetch` per URL, sequentially, with the same completeness demand `/read-rewrite` Step 1 uses:

> Return the COMPLETE article verbatim — every paragraph in order, preserving ALL names, numbers, dates, statistics, scores, and direct quotes exactly as written. Do NOT summarize. Also return the headline and publication date.

Known traps, all already recorded:
- **YouTube links can't be fetched** ([[feedback_youtube_url_not_fetchable]]) — ask the user to paste the content; keep processing the other links meanwhile.
- **The Sun is blocked** ([[reference_thesun_fetch_blocked]]) — ask for a paste or a different source.
- **bongdaplus opinion pieces** come back as a summary; a fetch whose result contains `##` headings is broken ([[reference_bongdaplus_fetch_returns_summary]]).
- **Re-fetching the same URL returns the cached condensed text** — bust it with `?utm_source=raw` ([[feedback_webfetch_cache_bust_query_param]]).

A link that fails twice gets **dropped**, not guessed at. Never invent facts to fill an item.

### Step 3: Screen and rank the items

For each fetched article decide:

1. **Is it football, and is it a distinct story?** Two links covering the same transfer = ONE item built from both (cite the richer one as the source, mention both in the notes).
2. **Does it carry a hard number?** Fee, score, minutes, age, ranking, record. An item with no number is a weak item — it can still run, but never lead.
3. **Rank strongest-first.** Order = the order they appear in the video. Lead with the biggest name / biggest number / most surprising verdict, because the hook is built from item 1. Never lead with the "and finally…" item.

Keep 5–7 items. If two items are both weak, merge them into one "tin nhanh" item covered by a single image-less `feature-list` scene at the end.

### Step 4: Decide the shape — items → scenes → words

Every item gets **one opener** and **0–2 detail scenes**:

| Scene | Template | Image | Job |
|---|---|---|---|
| Item opener | `callout` (a verdict/claim) or `stat-hero` (a number) | ✅ required | The item's headline moment — the claim on the left, the face on the right |
| Item detail | `stat-hero` / `callout` | ✅ required | The numbers behind the claim |
| Item detail (no image) | `feature-list` | ❌ | 2–4 peer bullets in a two-column card grid — use when the detail is a list, not a subject |

Every one of these is the same two-column frame; what marks a new item is the corner chip (`marker`) and the voice, not a change of layout. A `stat-hero`/`callout` scene **without** an image leaves the right half of the frame empty — either give it an image or make it a `feature-list`.

**Length budget** — 0,26 s/từ ([[feedback_plan_image_count_drives_video_length]]), and this ceiling is real: the pipeline warns past 380 s and the schema refuses past 40 scenes.

| Số tin | Scene tổng | Từ tổng (voiceText) | Từ / tin | Thời lượng ước |
|---|---|---|---|---|
| 5 | 13–16 | 800–1 000 | 150–195 | 3'40"–4'30" |
| 6 | 15–19 | 950–1 150 | 155–190 | 4'20"–5'10" |
| 7 | 17–22 | 1 100–1 250 | 150–175 | 5'00"–5'35" |

**Trần cứng: 1 250 từ / 24 scene / 360 giây.** Scene tổng = hook + Σ(scene mỗi tin) + engagement-question + outro. Nguồn dày hơn KHÔNG nghĩa là video dài hơn — nghĩa là chọn kỹ hơn trong cùng ngân sách.

**Image budget: hook + 1 opener/tin + 0–1 detail/tin, trần 12 ảnh.** 7 tin = 1 + 7 + tối đa 4. Vượt 12 thì chuyển bớt detail scene sang `feature-list` không ảnh.

#### Hook của bản tin — BẮT BUỘC mang ngày phát hành

Một bản tin không đề ngày thì không phải bản tin. Cảnh hook dùng đúng 4 field này:

| Field | Nội dung | Ví dụ |
|---|---|---|
| `eyebrow` | Buổi phát, chữ thường (cap 30) | `"Bản tin sáng"` · `"Bản tin chiều"` · `"Điểm tin tối"` |
| `eyebrowSub` | **Ngày, dd/mm/yyyy** (cap 24) | `"10/08/2026"` |
| `bigStat` | Số tin trong bản tin (cap 20) | `"6 TIN"` |
| `headline` | Tin mạnh nhất, rút cực gọn (cap 40) | `"Arsenal chốt Yildiz"` |
| `subhead` | 2 tin kế, ngăn bằng dấu phẩy (cap 40) | `"Real đổi tướng, MU hụt Sesko"` |

Trong khung ngang, `eyebrowSub` được render **54px chữ đen** ngay dưới nhãn buổi phát — đó là dòng ngày to mà người xem thấy đầu tiên, không phải caption mờ như bản dọc. Đừng nhét ngày vào `headline`; headline để bán tin số 1.

⚠️ **Ngày viết bằng chữ số `dd/mm/yyyy`**, không viết "mùng 10 tháng 8" — voiceText mới cần đọc thành lời ("ngày mười tháng tám"), field hiện hình thì dùng chữ số (xem [[feedback_typography_rules]]).

### Step 5: Templates that are safe in 16:9

Only these are laid out for the landscape canvas:

`hook` · `stat-hero` · `callout` · `feature-list` · `comparison` (bars + flag scoreboard) · `engagement-question` · `outro`

**Do NOT emit** `big-quote`, `bracket`, `tactics-board`, `form-compare`, `group-intro`, `match-results`, `formation-pitch`, `timeline` in a 16:9 script. Those are fixed pixel geometry for a 1080-wide frame — and `big-quote` additionally puts its portrait photo full-bleed behind the text, which is the one treatment this canvas doesn't use. In landscape they are only *contained*, not designed (see the closing block of `styles-landscape.css`). A pull quote becomes a `callout`; a fixture board becomes `comparison` with a flag on both sides.

### Step 6: Write the roundup .txt

Path: `video/input/<slug>/<slug>.txt`. Slug = `ban-tin-<dd-mm>` of today's date (e.g. `ban-tin-09-08`); if that folder exists and is non-empty, append `-2`, `-3`, …

Template — this is the literal file content:

```markdown
<Tiêu đề bản tin — sentence case, 5-12 từ, nêu số tin + chủ đề chung>

<Lead 1-2 câu, 25-60 từ: tin mạnh nhất + hứa hẹn phần còn lại>

## Tin 1 — <tiêu đề tin, 4-9 từ>
- <fact có số liệu>
- <fact 2>
- <fact 3-5>
Nguồn: <domain> · <URL>

## Tin 2 — <tiêu đề tin>
- ...
Nguồn: <domain> · <URL>

... (một khối `## Tin N` cho MỖI tin, đúng thứ tự đã xếp hạng ở Step 3) ...

## Context
- <bối cảnh khung được cả bản tin: vòng đấu, kỳ chuyển nhượng, giai đoạn mùa giải>
- <2-4 gạch đầu dòng>

## Quotes
- "<quote>" — <người nói, vai trò> (Tin <N>)
- <tối đa 3 quote cho cả bản tin; không có thì BỎ HẲN mục này>

---
## Giới hạn thời lượng (cho /create-video — KHÔNG đọc lên, KHÔNG lên hình)
- Khung hình: **16:9 (1920×1080)** — `metadata.aspect: "16:9"`.
- Mục tiêu: <X> phút. Trần cứng: 360 giây (6 phút).
- Tổng voiceText MỌI scene: **≤ 1 250 từ** (0,26 giây/từ).
- Tổng scene: **≤ <N>** (hook + <scene mỗi tin> + engagement-question + outro).
- Mỗi scene tối đa **3 câu** voiceText.
- Chỉ dùng template: hook · stat-hero · callout · feature-list · comparison · big-quote · engagement-question · outro.

---
Ngày: <dd/mm/yyyy>
Buổi: <sáng | chiều | tối>
Số tin: <N>
```

`Ngày` + `Buổi` không phải trang trí — cả ba thứ đọc chúng: hook (`eyebrow`/`eyebrowSub`), thumbnail (`--date`) và tiêu đề video. Ghi sai một chỗ là lệch cả ba. Mặc định lấy ngày hôm nay; user nói khác thì theo user.

Rules for the body — same house style as `/read-rewrite`, so read that skill's Step 4 for the full detail. The ones that bite hardest here:

- **Full Vietnamese diacritics in prose**, strip them only from Western proper nouns ([[feedback_rewrite_txt_keep_vietnamese_diacritics]]).
- **Arabic digits** for every number; `3-1`, `82%`, `€80M`.
- **4–6 bullets per item**, each ≤ 25 words, each with something concrete. A bullet like `"chơi ấn tượng"` is worthless — cut it or give it a number.
- **Every item keeps its own `Nguồn:` line.** A roundup that can't attribute item 4 is unusable.
- Total 700–1 400 words of prose. This is the SOURCE, not the script — `/create-video` selects from it.

### Step 7: Write images-plan.json (landscape) + anh-can-tao.md

Written next to the .txt. Schema is `src/image/plan-schema.ts` — note the three fields that only this skill sets:

```json
{
  "version": "1.0",
  "aspect": "16:9",
  "source": "ban-tin-09-08.txt",
  "contentType": "NEWS ROUNDUP",
  "title": "Bản tin bóng đá 9/8 — 6 tin nóng",
  "createdAt": "2026-08-09T10:00:00.000Z",
  "scenes": [
    { "id": "hook", "template": "hook", "filename": "hook.png",
      "subjectHint": "Tổng hợp — 6 tin nóng, không khí phòng thay đồ Ngoại hạng Anh" },
    { "id": "tin1-open", "template": "callout", "filename": "tin1-open.png",
      "marker": "TIN 1/6",
      "subjectHint": "Bruno Fernandes — Manchester United" },
    { "id": "tin1-so-lieu", "template": "stat-hero", "filename": "tin1-so-lieu.png",
      "marker": "TIN 1/6",
      "subjectHint": "Bruno Fernandes ăn mừng — Manchester United" },
    { "id": "tin2-open", "template": "callout", "filename": "tin2-open.png",
      "marker": "TIN 2/6",
      "subjectHint": "Xabi Alonso — Real Madrid" }
  ]
}
```

- **`aspect: "16:9"` is what tells `/create-video` to build a landscape script.** Forget it and you get a 9:16 short from landscape images.
- **`marker` is the same string for every scene of one item** — `"TIN 3/6"` — so the corner chip counts news items, not scenes. Image-less scenes get their marker from `/create-video` directly, not from the plan.
- **NO split-frame in this skill. One subject per image.** The 9:16 skills merge two single-person images into a `left | seam | right` frame for VS scenes; a landscape slot is 908px wide and already shows a normal photo at a comfortable size, so splitting it in half just makes two cramped half-photos. A scene that needs two people gets a real two-person photo, or becomes two scenes.
- **sceneId convention:** `tin<N>-open` / `tin<N>-<chủ-đề>`. Never `tin1-1` / `tin1-2` — a `-1`/`-2` suffix is the split-frame marker, and `combineSplitImages` runs automatically inside `images:stage`, so two files named that way get silently merged into one ([[feedback_scene_id_dash_number_collides_with_split_frame]]).
- **No English `prompt` field** ([[feedback_dont_author_image_prompts]]) — `subjectHint` only, naming the subject + club/nation.

Then `anh-can-tao.md`, with the orientation line rewritten for landscape:

```markdown
# Ảnh cần tạo — <title> (<N> ảnh) · KHUNG 16:9

Video này là **16:9 ngang (YouTube)**. Mọi ảnh vào **thẻ bo góc bên phải khung** — không có
ảnh nào phủ kín khung, nên **tỉ lệ nào cũng dùng được**: ngang 16:9 vào thẻ 908×605, vuông
vào 780×780, dọc vào 640×834. Thẻ tự đổi slot theo tỉ lệ, ảnh không bị cắt không bị méo.
Ngang cho thẻ to nhất nên vẫn là lựa chọn mặc định.
**Mỗi ảnh MỘT chủ thể** — bản tin này không dùng ảnh ghép đôi.
Save đúng tên file dưới đây vào folder này; đuôi .png/.jpg/.jpeg/.webp/.avif đều được.

- [ ] `hook.png` — <subjectHint>
- [ ] `tin1-open.png` — <subjectHint>
- [ ] `tin1-so-lieu.png` — <subjectHint>
...
```

### Step 8: Record it in the queue

Same as `/read-rewrite` Step 6.5 — append one row, `status=planned`:

```bash
npm run video-queue --silent -- set <maxRow+1> source=video/input/<slug>/<slug>.txt status=planned notes="news-roundup 16:9 · <N> tin"
```

Put `16:9` in the notes so `/video-queue` Pass 2 doesn't render it expecting a short. If the helper errors (queue.xlsx open in Excel), say so in the reply and continue — don't fail the skill.

### Step 9: Reply concisely

```
✓ Bản tin: video/input/<slug>/<slug>.txt  (<N> tin, <M> scene dự kiến, ~<T> phút)
✓ Image plan 16:9: video/input/<slug>/images-plan.json
✓ Checklist ảnh: video/input/<slug>/anh-can-tao.md
✓ Queue: row <R>, status=planned

Thứ tự tin: 1. <tin 1>  2. <tin 2>  …
Bỏ: <url> (<lý do>)          ← chỉ khi có link bị bỏ

⚡ <K> ảnh cần gen trên grok.com — mở <K> tab cùng lúc, bấm generate ĐỒNG LOẠT rồi mới chờ.
   Tỉ lệ nào cũng vừa (mọi ảnh vào thẻ bên phải khung, không cắt); ngang 16:9 cho thẻ to nhất.
   Save về video/input/<slug>/ đúng stem. Xong → /create-video video/input/<slug>/<slug>.txt
   Render xong sẽ có thêm thumbnail + tiêu đề để đăng (Step 10).
```

### Step 10 (SAU khi render): thumbnail + tiêu đề video

Steps 1–9 stop at the image-gen pause. Once the user has generated the images and `/create-video` has produced `video/output/<slug>/video.mp4`, **the job is not finished until this step has run.** A landscape bulletin ships as three things, not one: the video, a cover, and a title someone can paste.

**1. Chọn 2–4 ảnh cho thumbnail.** Not the first three in the folder — pick deliberately:
- Ảnh của **tin số 1** luôn có mặt (nó là tin bán được).
- Thêm 1–2 ảnh của tin có **gương mặt dễ nhận** nhất (ngôi sao lớn, HLV quen mặt). Ảnh áo đấu, sân bãi, đồ họa → bỏ.
- Ảnh gần giống nhau (2 cầu thủ cùng CLB, cùng tông màu) → chỉ giữ 1. Ở 210px, hai ảnh na ná nhau đọc thành một.
- **3 ảnh là điểm ngọt**: bố cục 1 ảnh lớn trái + 2 ảnh xếp phải. 2 ảnh cũng đẹp; 4 là trần.

**2. Chạy script.** Nó dựng cover 1280×720 qua đúng headless Chrome + bảng màu của video, rồi ghi luôn tiêu đề ra file:

```bash
npm run thumbnail:roundup -- video/output/<slug> \
  --title "<tiêu đề video>" \
  --date "Bản tin <buổi> <dd/mm/yyyy>" \
  --images tin1-open.png,tin3-open.png,tin5-open.png
```

Output: `video/output/<slug>/thumbnail.jpg` + `video/output/<slug>/tieu-de.txt`. `--images` nhận tên file trong `images/` (hoặc trần sceneId). Bỏ `--images` thì nó tự lấy 3 ảnh đầu theo thứ tự tên — **đừng dựa vào cái đó**, bước chọn lọc ở trên là việc chính.

⚠️ `npm run thumbnail` (không có `:roundup`) là script khác — nó trích một frame của cảnh hook trong video đã render, đúng cho short 9:16 nhưng sai cho bản tin ngang.

**3. Viết tiêu đề video.** Đây là thứ user copy-paste lên YouTube, nên nó phải tự đứng được ngoài ngữ cảnh:

- **Công thức:** `<Tin số 1 rút gọn>, <tin số 2 rút gọn> | Bản tin <buổi> <dd/mm>`
- **60–70 ký tự** cho phần trước dấu `|`. YouTube cắt quanh 70 ký tự trên mobile — thứ bị cắt phải là phần ngày, không phải tên cầu thủ.
- **Tên riêng đứng trước** — người ta lướt tìm tên CLB/cầu thủ, không tìm chữ "bản tin".
- Chữ số Ả Rập, đủ dấu tiếng Việt, **không viết hoa toàn bộ**, không nhồi emoji, không câu view lố ("SỐC", "KHÔNG THỂ TIN NỔI").
- Ví dụ đạt: `Arsenal chốt Yildiz, Real Madrid đổi tướng | Bản tin sáng 10/08`
- Ví dụ hỏng: `BẢN TIN BÓNG ĐÁ SÁNG NAY 10/08/2026 CÓ GÌ HOT?` — không có một cái tên nào, viết hoa hết, và hứa suông.

**4. Trả kết quả** — dán tiêu đề ra dạng copy được ngay, kèm đường dẫn thumbnail:

```
✓ Video:     video/output/<slug>/video.mp4  (<T>)
✓ Thumbnail: video/output/<slug>/thumbnail.jpg  (1280×720, ghép <K> ảnh: <tên>)
✓ Tiêu đề:   video/output/<slug>/tieu-de.txt

Tiêu đề (copy-paste):
<tiêu đề video>
```

Gửi kèm ảnh thumbnail cho user xem (đọc file lên), giống luật gửi thumbnail của [[feedback_video_queue_send_hook_thumbnail]].

## What this skill does NOT do

- Does not generate images — it plans them, the user generates them on grok.com.
- Does not write `script.json` — `/create-video` does, reading `aspect` from the plan.
- Does not run the pipeline or render.
- Does not touch the 9:16 path: no existing skill, script, or stylesheet changes behaviour because this skill exists.

## Edge cases

- **A link 404s / is paywalled / is bot-blocked** → drop the item, name it in the reply, continue. 5 solid items beat 7 with a hollow one.
- **Two links, same story** → one item, both URLs on the `Nguồn:` line.
- **Only 3–4 usable items** → build the video anyway at 5–6 scenes/item's worth of depth; expect ~3 minutes. Say so in the reply.
- **An item is rich enough to carry its own video** (a full tactical breakdown, a long ranking) → say so and offer to `/read-rewrite` it separately as a 9:16 short instead of burying it at position 5.
- **User wants the same links as a 9:16 short** → that's `/read-rewrite`, default SPLIT.
- **User re-runs on the same links** → Step 1 catches it; ask before overwriting a `planned` row's folder.

## Relationship to other skills

- `/read-rewrite` — one URL → one 9:16 short. This skill is its landscape, many-URL sibling; they share the `.txt` house style and the queue conventions.
- `/create-video` — consumes what this skill writes. It reads `aspect` from `images-plan.json` and switches to landscape mode (see its "16:9 roundup mode" section).
- `/images-for-videos` — the 9:16 planner. This skill does its own planning because the roundup shape (opener + details per item, `fullBleed`, `marker`) has no equivalent there.
- `/video-queue` — batch renderer. A roundup row runs through it like any other, as long as the images are staged.
