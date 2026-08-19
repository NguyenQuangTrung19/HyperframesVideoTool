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

> **🔑 Nguyên tắc #1 — `.txt` là BẢN TÓM TẮT ĐỦ Ý, không phải bản lưu đầy đủ.** (Đổi 2026-08-03 theo yêu cầu user: *"đọc nội dung từ link xong soạn lại ngắn hơn, đủ tóm tắt và đủ ý thôi"*.)
>
> Viết lại vừa đổi GIỌNG vừa **rút gọn nội dung**. Mục tiêu: `.txt` chứa đúng lượng chất liệu để dựng được video 35-45 giây — không hơn. Vẫn giữ 8-11 Ý RIÊNG BIỆT (mỗi ý = 1 cảnh), chỉ là mỗi ý chỉ cần đủ chất liệu cho MỘT câu thoại 16 từ + vài con số lên hình.
>
> **Cỡ đích: 350-600 từ phần nội dung** (không tính block metadata cuối file). Bài gốc 2000 từ vẫn ra `.txt` ~500 từ.
>
> **GIỮ:** tên người + CLB/đội tuyển, mọi con số load-bearing (tỉ số, phút ghi bàn, giá chuyển nhượng, tuổi, số bàn/kiến tạo, điểm số, thứ hạng), người kiến tạo / nguyên nhân của mỗi sự kiện chính, 1-2 câu bối cảnh giải thích *vì sao chuyện này đáng nói*, trích dẫn thật sự đắt.
>
> **BỎ:** diễn biến phụ không dẫn tới bàn thắng hay bước ngoặt, cơ hội bỏ lỡ lặt vặt, danh sách thay người đầy đủ, câu phân tích vòng vo của tác giả, chi tiết lặp lại ý đã nêu, boilerplate (quảng cáo, bài liên quan, nav).
>
> **Thước đo:** mỗi ý trong `.txt` phải trả lời được câu hỏi *"ý này lên scene nào?"*. Không map được vào scene nào → bỏ. Nhắm khoảng **1,5-2 gạch đầu dòng cho mỗi scene dự kiến** (video 9 scene → ~15-18 gạch đầu dòng).
>
> ⚠️ **Nhưng đừng làm mờ.** Rút gọn = bỏ bớt Ý, KHÔNG phải làm ý còn lại chung chung. `"Hoàng Đức chọc khe cho Văn Vĩ dứt điểm góc hẹp, phút 6"` ĐÚNG; `"Việt Nam ghi bàn sớm"` SAI — mất số liệu là mất chất liệu cho `templateData`, scene sẽ trống. Xem [[feedback_onscreen_reading]].
>
> ℹ️ Link nguồn luôn nằm ở dòng `Nguồn:` cuối file, nên chi tiết đã bỏ vẫn fetch lại được nếu sau này cần mở rộng.

If the source is English / other language → translate to Vietnamese while rewriting. If the source is already Vietnamese → **vẫn phải chọn lọc xuống 350-600 từ**, đừng vì đã đúng tiếng Việt mà bê nguyên bài; chỉnh câu chữ và re-tone ở chỗ bài gốc dài dòng / clickbait / quá trang trọng.

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
- <fact N — chọn 10-14 fact mạnh nhất, ưu tiên cái có số liệu thật>

## Context
- <historical / standings / form note that frames the story>
- <relevant stat or comparison the lead doesn't already cover>

## Quotes
- "<quote 1>" — <speaker, role>
- "<quote 2>" — <speaker, role>

---
## Giới hạn thời lượng (cho /create-video — KHÔNG đọc lên, KHÔNG lên hình)
- Mục tiêu: 35-45 giây. Trần cứng: 45 giây.
- Tổng voiceText MỌI scene cộng lại: **≤ 170 từ** (đo thật 0,256 giây/từ trên 27 video đã render).
- **Mỗi body scene tối đa 1 câu, ≤ 16 từ** — đây là trần quan trọng nhất: 1 cảnh = 1 hình đứng yên ~4 giây. Hook ≤ 12 từ.
- Số scene KHÔNG giảm — video ngắn đi bằng cách nói ít hơn mỗi cảnh, không phải bằng cách bỏ cảnh.
- Tổng scene: **≤ 11** (N ảnh trong plan + 1 feature-list + engagement-question + outro).
- Fact nào không kịp nói thì cho lên `highlights`/`context` để người xem tắt tiếng vẫn đọc được — đừng nhồi vào voiceText. Lớp chi tiết thứ 2-3 giờ BẮT BUỘC lên hình.
- Check trước khi render: `npx tsx _validate-script.ts <script.json>` (chặn cứng, exit 1 = không render).

---
Nguồn: <domain> · <full URL>
Ngày: <publication date if known, else "n/a">
```

**⚠️ Block `## Giới hạn thời lượng` là BẮT BUỘC, copy nguyên văn vào mọi `.txt`** (2026-08-03, user: *"video gần đây quá dài"*). Nó nằm SAU dấu `---`, chung khu metadata với `Nguồn:`/`Ngày:`, nên không lẫn vào prose và không trôi vào voiceText. Đặt ở đây chứ không đợi bước script vì tới lúc viết `script.json` thì ràng buộc đã trôi mất — đó chính xác là cách 3 video ngày 2/8 lọt ra ở 205–220s. Chỉnh con số nếu user yêu cầu độ dài khác cho bài cụ thể; mặc định thì giữ nguyên.

⚠️ **Đừng nhầm block này với việc tóm tắt `.txt`.** Độ dài `.txt` KHÔNG quyết định độ dài video — `/create-video` chỉ *chọn* từ `.txt`. Cắt `.txt` chỉ mất dữ liệu mà video vẫn dài. Nguyên tắc #1 (giữ đủ 100% thông tin) vẫn có hiệu lực đầy đủ; budget siết ở `voiceText`, không phải ở nguồn.

Rules for the body:

- **Title (line 1):** 5–12 words, the rewritten Vietnamese headline. Sentence case (only first letter + proper nouns capped, per typography rules). E.g. `"Bayern loại PSG ở bán kết Champions League"`, NOT `"Bayern Loại PSG Ở Bán Kết Champions League"`.
- **Lead:** 1–2 sentences, 25–60 words. The "5W in one breath."
- **Key facts:** chọn **10-14 fact mạnh nhất** — ưu tiên cái có số liệu thật (tỉ số, phút, giá, tuổi, số bàn) và cái là bước ngoặt của câu chuyện. Mỗi bullet ≤ 25 từ. Arabic digits (`3-1`, `82%`, `€80M`). Full proper-noun diacritics (`Mbappé`, `Vinícius Júnior`, `Việt Nam`, `Bồ Đào Nha`). Fact thứ 15 trở đi thường là chi tiết phụ — bỏ. **Bullet giữ lại phải giữ nguyên độ cụ thể**, đừng gộp 3 fact thành 1 câu mờ.
- **Context:** **3-5 gạch đầu dòng**, chọn cái khung được câu chuyện: vì sao chuyện này đáng nói, thứ hạng / thành tích liên quan, đối đầu lịch sử, hệ quả sắp tới. Đủ để `classify-football-content` ở Step 6 chọn đúng cấu trúc scene. Bỏ context chỉ lặp lại điều lead đã nói.
- **Quotes:** chọn **tối đa 2-3 câu đắt nhất** — câu có thái độ, có cam kết, hoặc có thông tin mới. Bỏ quote xã giao ("chúng tôi sẽ cố gắng hết sức"). Nếu bài gốc không có quote nào, **bỏ hẳn mục `## Quotes`** — đừng bịa.
- **Source line:** keep the domain + the full URL. Future tools (and you, in later sessions) can backtrack from this.
- **Date:** if WebFetch returned the publication date, include it; else write `n/a`.
- **Total length:** nhắm **350-600 từ** phần nội dung (không tính block metadata cuối file). Bài gốc dài bao nhiêu không quan trọng — 2000 từ vẫn ra ~500 từ. Nếu vượt 600 từ, quay lại bỏ bớt Ý (không phải làm câu ngắn lại): xem ý nào không map được vào scene nào thì cắt.

#### ⚠️ Selection check (MANDATORY before saving .txt)

Đây là bước **chọn lọc**, không phải bước đối chiếu đủ/thiếu. Trước khi ghi file, đọc lại `.txt` và tự hỏi:
- [ ] Mỗi bullet map được vào một scene cụ thể chưa? Không map được → bỏ.
- [ ] Tổng số bullet có nằm khoảng **1,5-2 bullet / scene dự kiến** không? (video 9 scene → ~15-18 bullet)
- [ ] Nhân vật chính + mọi con số load-bearing (tỉ số, phút, giá, tuổi, thứ hạng) còn nguyên chứ? Đây là thứ **không được** hy sinh khi rút gọn.
- [ ] Có bullet nào bị "tóm tắt thành câu mờ" không? `"ghi bàn sớm"` / `"chơi ấn tượng"` → SAI, phải có số. Bỏ hẳn một ý còn hơn giữ nó ở dạng mờ.
- [ ] Phần đã bỏ có gì thật sự tiếc không? Nếu có → nó nên thay chỗ một bullet yếu hơn, chứ không thêm vào cho dài ra.

⚠️ **Cân bằng:** rút quá tay thì `/create-video` không đủ chất liệu cho `templateData`, scene sẽ trống rỗng (xem [[feedback_onscreen_reading]] — mỗi scene phải qua được sound-off test). Rút không đủ thì video dài lê thê. Điểm đúng là **đủ chất liệu cho đúng số scene đã plan, không dư một ý nào.**

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
- ... (chọn lọc — xem quy tắc ngay dưới template)

## Chấm điểm cầu thủ — <Team B>
- <Player Name> — <N>/10: <1-line performance summary>
- ... (chọn lọc)

## Context
- <historical significance, records broken, trophy count>
- <upcoming implications>

## Quotes
- "<quote>" — <speaker, role>

---
Nguồn: <domain> · <full URL>
Ngày: <date>
```

**⚠️ MATCH RECAP — chọn 6-7 cầu thủ, KHÔNG phải tất cả** (sửa 2026-08-03). Bài chấm điểm thường có 20-22 người; `images-for-videos` cấp tối đa **9 ảnh/plan** và `/create-video` chặn ở 45 giây, nên liệt kê đủ 22 người chỉ tạo ra một `.txt` mà 15 bullet trong đó không bao giờ lên hình.

Chọn theo thứ tự: **điểm cao nhất trận** → **điểm thấp nhất trận** (phản diện tạo kịch tính) → **người ghi bàn / kiến tạo** → **thủ môn nếu có pha cứu thua quyết định**. Mỗi người được chọn giữ nguyên điểm số + 1 dòng mô tả cụ thể (hành động thật, không phải tính từ). Số còn lại: bỏ, hoặc gom 1 dòng tổng kiểu `"Phần còn lại của hàng thủ đều 6/10"`.

> 🔄 Ghi đè hướng dẫn cũ *"EVERY rated player MUST have their own bullet, nếu gộp 10 người thành 5 bullet là chất lượng không chấp nhận được"* (2026-05-31). Feedback đó chống việc **gộp người vào bullet list mờ** — điều đó vẫn cấm. Cái được phép bây giờ là **bỏ hẳn người không đáng lên hình**. Người đã chọn thì vẫn phải có bullet riêng, có số, có chi tiết.

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

**⚠️ NEWS DRAMA — chọn 6-7 phản ứng đáng nhất, mỗi cái một bullet riêng.** Ưu tiên: tài khoản CLB chính thức > cầu thủ có tên > phản ứng có số liệu tương tác > fan vô danh. Phản ứng đã chọn phải nêu **cụ thể ai, nói/đăng gì** — tuyệt đối không viết `"nhiều fan phản ứng"` (câu mờ thì scene trống). Phản ứng ngoài top 7: bỏ.

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
<N> ảnh cần tạo trên grok.com (Imagine; hook 9:16 full-bleed, body ngang/dọc đều được — vào thẻ đúng tỉ lệ):
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
| Article is very short (<200 words of body) | Still rewrite + structure; warn the user that the source may be too thin to support a full 9–11-scene analysis video |
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
