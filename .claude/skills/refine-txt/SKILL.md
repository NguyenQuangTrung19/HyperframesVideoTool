---
name: refine-txt
description: Polish a raw Vietnamese football notes .txt into a clean, structured, SportsForAllTV-voice file ready for /images-for-videos. Reads the user's unfiltered notes (random sentences, copy-pasted paragraphs, bullet jots), drops fluff, restructures into title + lead + Key facts + Context + (optional) Quotes, applies the channel voice and typography rules, and writes the refined version IN PLACE. The original is preserved at <slug>.raw.txt the first time the skill runs. The user-facing slash command is `/refine-txt <path-to-source.txt>`.
---

# Refine TXT Skill

Take a user's raw Vietnamese football notes and polish them into a video-ready `.txt`. This is the missing step between "I have rough notes" and `/images-for-videos`. After refinement the user reviews the file, optionally tweaks, then runs `/images-for-videos` and `/create-video`.

## When to use

- User runs `/refine-txt input/<slug>/<slug>.txt`
- The `.txt` contains: rough notes, copy-pastes from multiple sources, bullet jots, half-formed paragraphs, mixed Vietnamese + English fragments — anything not yet ready to feed into `/images-for-videos`
- For URL sources, **don't use this skill**. Use `/read-rewrite <url>` instead — it already includes the rewrite step and chains into `/images-for-videos`.

## Input contract

Single argument — a path to an existing `.txt` file.

Reject early if:
- Path doesn't exist → `"File không tồn tại: <path>"`
- Path is not `.txt` → `"Skill này chỉ nhận file .txt"`
- Path is a URL → `"Với URL bài báo, dùng /read-rewrite <url> thay vì."`

## Quality bar — what "tốt nhất có thể" means

This skill is **NOT a generic summarizer**. It's a specialist Vietnamese football editor working on a known channel brand. Hold yourself to these standards:

### Voice (SportsForAllTV brand)

| | Do | Don't |
|---|---|---|
| **Length** | Câu ngắn vừa phải, có nhịp. Mix 1 câu dài giữa 3-4 câu ngắn để đỡ đều đều. | Câu lê thê >30 từ. Đoạn 5-6 câu liên tục cùng độ dài. |
| **Tone** | Informative + light editorial. Có chỗ cho 1-2 nhận định nhẹ ("đó là một thống kê đáng nể", "khoảng cách rõ ràng") khi sự kiện đáng. | Sến (`"trong tâm trạng đầy nghẹn ngào"`), clickbait đầy đủ (`"cú sốc lớn nhất lịch sử!!!"`), formal news-wire (`"theo nguồn tin được cho là tin cậy"`). |
| **Văn nói** | Viết như nói chuyện với người Việt am hiểu bóng đá. `"thua 1-3"`, `"kém 11 điểm"`, `"loại sớm"`. | Văn viết báo cứng nhắc (`"đã nhận thất bại với tỷ số một-ba"`). |

### Anti-cliché checklist (drop these phrases on sight)

- `"Tình hình hiện tại"`, `"Mới đây"`, `"Theo nguồn tin"` — generic openers, đốt 5-7 từ không thông tin
- `"Có thể nói rằng"`, `"Không thể phủ nhận"`, `"Đáng chú ý là"` — hedging fillers
- `"Thực sự"`, `"Vô cùng"`, `"Đặc biệt"`, `"Tuyệt vời"`, `"Đáng kinh ngạc"` — generic adjectives, replace with concrete fact
- `"Trong bối cảnh..."` (when no actual context follows)
- `"Như chúng ta đã biết..."` — patronizing
- `"Câu hỏi đặt ra là..."` — old-school journalism padding
- **Doubling "nhiều / nhiều hơn"** — `"Anh thực hiện nhiều X nhiều hơn ai"` / `"Bruno tạo ra nhiều A nhiều hơn #2"` dính 2 từ "nhiều" liền, đọc lằng nhằng. Rephrase: `"dẫn đầu giải về X"`, `"X nhiều nhất giải"`, `"số X gấp đôi #2"`, hoặc giữ một "nhiều": `"X nhiều hơn #2 đến 50%"`. Cũng áp cho doubling khác: "rất ... rất", "đã ... đã", "không ... không" trong cùng câu.

### Lexicon — thuật ngữ chuyên thay văn phổ thông

SportsForAllTV writes for VN football fans who follow the sport seriously. Khi gặp các cụm phổ thông sau, swap sang phiên bản chuyên (chi tiết + lý do trong `memory/feedback_football_lexicon.md`):

| Tránh (phổ thông) | Dùng (chuyên) |
|---|---|
| đường chuyền giấu | lừa hướng / chọc khe lừa hướng |
| xuyên tuyến | chọc khe |
| kiến tạo (n.) | pha kiến tạo |
| cơ hội tạo ra cho đồng đội | pha kiến tạo cơ hội |
| đặt bóng vào đúng chỗ | đặt điểm rơi |
| số 10 (mô tả role) | nhạc trưởng |
| tham gia bàn thắng | pha tham gia bàn thắng |
| trận đầu dưới HLV X | trận đầu cầm quân của X |
| key pass | đường chuyền chìa khoá / pass tạo cú dứt điểm |
| đội bóng / CLB lặp lại | nickname club: Quỷ Đỏ (MU), Pháo Thủ (Arsenal), Gà Trống (Spurs), Lữ đoàn đỏ (Liverpool), Hùm xám (Bayern), Vua trắng (Real), Á thánh (Barca) |

Benchmark tone: Goal Vietnam, Vnexpress thể thao, Sky Sports VN, BongDaPlus, bình luận viên Quang Tùng / Anh Ngọc / Vũ Quang Huy.

### Faithfulness (CRITICAL — never violate)

1. **Never add facts the source doesn't have.** Even if you know the player has 8 Ballon d'Or, if the user's notes say only "many Ballon d'Or", DON'T fill in 8. Keep the user's wording. The user owns the facts.
2. **Never invent quotes.** If notes don't have direct attributed quotes, omit the `## Quotes` section entirely.
3. **Never invent stats / dates / numbers.** If a number is wrong vs widely-known reality, soften the wording (`"theo nguồn"`) rather than echo as definitive OR silently correct it.
4. **Preserve all distinct substantive points** the source supports. If the user has 7 facts buried in 15 paragraphs of fluff, refined output must surface all 7 as separate bullets — not merge two into one.
5. **Preserve all attributed quotes** verbatim if present. Translate to Vietnamese only if the original was in English/another language; keep the speaker attribution exact.

### Names + numbers + diacritics

- **Player names**: full diacritics on first mention (`Mbappé`, `Vinícius Júnior`, `Đặng Văn Lâm`). Subsequent mentions can drop to short form (`Mbappé`, `Vinícius`, `Văn Lâm`).
- **Club names**: canonical full form on first mention (`Manchester United`, `Real Madrid`, `Bayern Munich`). After that, short form OK (`MU`, `Real`, `Bayern`).
- **Country names**: full Vietnamese (`Việt Nam`, `Bồ Đào Nha`, `Pháp`, `Đức`).
- **Numbers**: keep Arabic digits in body (`3-1`, `82%`, `€80M`, `1m93`, `47/47`). Don't spell out — that's `/create-video`'s job at script generation. Refined `.txt` is intermediate, not final voice.
- **Decimals**: use comma (`8,5/10`) per Vietnamese convention, NOT period.
- **Dates**: prefer `2026-05-08` ISO format or natural Vietnamese (`tháng 5/2026`). Don't translate relative dates (`last Tuesday`) — convert to absolute if the source has one, else drop.

### Density preservation

Before rewriting, count "distinct substantive points" (each = an independent fact/claim worth its own scene later — see `classify-football-content` for the per-content-type definition). Refined output must surface ALL of them, no merging:

| Distinct points in source | Action |
|---|---|
| **< 3** | Refine what's there + **append explicit warning** at end of skill output: `⚠ Source chỉ có X điểm (<3) — /images-for-videos sẽ bail. Bạn cần bổ sung facts trước khi build video.` Still write the refined .txt; let the user see what they've got and add. |
| 3+ | Normal refinement — just preserve density. |

## Workflow (MUST follow these steps in order)

### Step 1: Validate input

- Single argument is a path to an existing `.txt` file. Reject otherwise (see Input contract above).
- If path looks like a URL → reject + redirect to `/read-rewrite`.

### Step 2: Detect prior runs

If `<slug>.raw.txt` already exists alongside `<slug>.txt`:
- Use `<slug>.raw.txt` as the **source of truth** (it's the original user notes). The current `<slug>.txt` is a previous refined version we're about to replace.
- Don't re-back-up — `.raw.txt` is already preserved.

If `<slug>.raw.txt` does NOT exist:
- This is the first refinement run.
- **Copy** `<slug>.txt` to `<slug>.raw.txt` (preserve original).
- Use `<slug>.txt` as source.

### Step 3: Read + classify

1. **Read the entire source file.** Don't truncate.
2. **Quick sanity check** — is it football content? Look for: club names, player names, league names, match terminology, transfer language. If clearly NOT football → bail with `"⚠ Nội dung không phải bóng đá — SportsForAllTV chỉ làm content bóng đá. Bạn check lại file nhé?"`
3. **Detect language fragments.** If source is mostly English (notes from foreign articles), translate to Vietnamese during rewrite. Mixed VN+EN sentences are normal — clean them up.
4. **Classify content type** mentally using `classify-football-content` taxonomy (RANKING / VS / MATCH ANALYSIS / PRE-MATCH PREVIEW / PLAYER PROFILE / HISTORY-CAREER / TRANSFER NEWS / TRIVIA). Don't write the type into output — but use it to decide structure (e.g., RANKING → 1 fact per item; VS → 1 fact per metric).
5. **Count distinct substantive points.** Per content-type definitions in `classify-football-content`. <3 → still proceed but flag in summary.

### Step 4: Plan the rewrite

Before typing prose, sketch (mentally — don't write to a file):

- **Title (1 line):** the 5-12-word headline. Sentence case. Lead with the strongest claim/fact.
- **Lead (1-2 sentences):** 5W in one breath. Set up everything the rest of the file unpacks. 25-60 words.
- **Key facts (4-7 bullets):** each a single distinct substantive point, ≤25 words. ALL the source's facts go here.
- **Context (2-4 bullets):** historical / standings / form / comparison framing the lead doesn't already cover. Optional but **strongly recommended** — gives `classify-football-content` more signal.
- **Quotes (only if source has direct attributed quotes):** copy verbatim with attribution. Translate to Vietnamese if needed.

### Step 5: Write under SportsForAllTV voice

For every sentence:
- Read it back mentally as if you're saying it on a Vietnamese sports podcast. Does it flow? Cut unnecessary words.
- If a sentence has 2 ideas, split into 2 short sentences. If 3 short sentences in a row → merge two into a longer one for rhythm.
- Re-check anti-cliché list. Drop any phrase that matches.
- Re-check faithfulness — does this sentence add anything beyond what the source says? If yes, cut it.

### Step 6: Apply typography + naming

Per SportsForAllTV typography rules (already enforced by memory `feedback_typography_rules.md`):
- **Vietnamese sentence case** — only first letter + proper nouns capped. Never Title Case kiểu Anh.
- **Full diacritics** on player/club/country names on first mention.
- **Arabic digits** in body (`47 bàn / 47 trận`, `kém 11 điểm`, `phí 240-250 triệu bảng`). Don't spell out.
- **Em dash `—`** is OK in body prose (signals pause). Don't use `:` where `—` reads more natural.

### Step 7: Write output

Output template (literal markdown, UTF-8, no BOM):

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
- <historical / standings / form note>
- <comparison or stat the lead doesn't cover>

## Quotes
- "<quote 1>" — <speaker, role>
- "<quote 2>" — <speaker, role>

---
## Giới hạn thời lượng (cho /create-video — KHÔNG đọc lên, KHÔNG lên hình)
- Mục tiêu: 35-45 giây. Trần cứng: 45 giây.
- Tổng voiceText MỌI scene cộng lại: **≤ 170 từ** (đo thật 0,256 giây/từ trên 27 video đã render).
- **Mỗi body scene tối đa 1 câu, ≤ 16 từ** — đây là trần quan trọng nhất: 1 cảnh = 1 hình đứng yên ~4 giây. Hook ≤ 12 từ.
- Số scene KHÔNG giảm — video ngắn đi bằng cách nói ít hơn mỗi cảnh, không phải bằng cách bỏ cảnh.
- Tổng scene: **≤ 11**.
- Fact nào không kịp nói thì cho lên `highlights`/`context` để người xem tắt tiếng vẫn đọc được.
- Check trước khi render: `npx tsx _validate-script.ts <script.json>` (chặn cứng, exit 1 = không render).

---
Nguồn: ghi chú cá nhân
Ngày: <ISO date if source has one, else "n/a">
```

⚠️ **Block `## Giới hạn thời lượng` là BẮT BUỘC** (2026-08-03) — copy nguyên văn vào khu metadata sau `---`. Khác với `/read-rewrite`, ở đây ghi chú gốc là của user nên **đừng tự ý cắt ý** — cứ giữ mọi fact họ đã ghi (họ chép vào là có chủ đích), budget siết ở bước viết `voiceText` chứ không ở bước refine.

Rules for the body:
- **Title:** 5-12 words, Vietnamese sentence case. Lead with the strongest signal — number, surprise, verdict. NOT generic ("Phân tích về X").
- **Lead:** 1-2 sentences, 25-60 words, 5W in one breath.
- **Key facts:** 4-7 bullets, ≤25 words each, every concrete fact from source. Arabic digits.
- **Context:** 2-4 bullets, optional but **strongly preferred**. Skip the section if user notes truly have no historical/comparison angle.
- **Quotes:** ONLY direct attributed quotes from source. Omit section entirely if no quotes.
- **Source/Date footer:** kept for consistency with `/read-rewrite` output.
- **Total length:** 200-500 words across the whole document. If source is longer, compress — fluff goes; facts stay.

Use `Write` to write to `<slug>.txt` (overwrite). The original is already preserved at `<slug>.raw.txt` from Step 2.

### Step 8: Reply concisely

```
✓ Refined: input/<slug>/<slug>.txt
✓ Backup: input/<slug>/<slug>.raw.txt  (file gốc của bạn, không bị sửa)

<N> distinct substantive points · ước tính video band: <X-Y scenes / Zs>

Tiếp theo:
1. Mở file refined đọc qua, chỉnh tay nếu cần
2. Chạy: /images-for-videos input/<slug>/<slug>.txt
```

Where the band comes from:
| Points | Band shown |
|---|---|
| 3-4 | "6-8 scenes / 25-33s" |
| 5-7 | "8-10 scenes / 33-41s" |
| 8+ | "9-11 scenes / 41-45s" |

⚠️ Trần cứng **11 scene / 45 giây** (siết 2026-08-19 từ 120s) — nguồn 20 điểm vẫn chỉ ra 11 scene, chọn 8 điểm mạnh nhất. Xem `classify-football-content/SKILL.md`.

If `<3` points, REPLACE the band line with the warning:
```
⚠ Source chỉ có <N> điểm (<3) — /images-for-videos sẽ bail.
   Bạn cần bổ sung thêm facts vào file refined trước khi tiếp tục.
```

If you bailed at Step 3 (not football, etc.), output just the bail message — don't write any file.

## What this skill does NOT do

- Does not chain into `/images-for-videos`. User reviews the refined file first, runs `/images-for-videos` themselves.
- Does not generate images. That's `/images-for-videos`.
- Does not write `script.json`. That's `/create-video`.
- Does not invent facts the source doesn't have. Even when refinement would "feel more polished" with more numbers/details — if it's not in source, it's not in output.
- Does not change the slug or move the file. The .txt stays at the user's chosen path.

## Edge cases

| Situation | Action |
|---|---|
| File doesn't exist | Reject with bad path echoed back |
| File is empty / whitespace only | Reject: `"File rỗng — không có gì để refine"` |
| Not a `.txt` (URL, .md, .docx) | Reject + point at correct skill (`/read-rewrite` for URL) |
| Source not football content | Reject with clear message |
| Source mostly English | Translate to Vietnamese during refinement |
| Source <3 distinct points | Refine + append explicit warning to summary |
| Source already polished (idempotent re-run) | Re-apply structure if missing, otherwise minimal edits — don't fabricate changes |
| Source has direct quotes | Preserve verbatim + attribution in `## Quotes` section |
| Source has no direct quotes | Omit `## Quotes` section entirely |
| Source has explicit date (e.g. "ngày 8/5/2026") | Capture in `Ngày:` footer as ISO `2026-05-08` |
| `<slug>.raw.txt` already exists | Use it as source of truth; don't re-back-up |

## Relationship to other skills

```
local notes ──/refine-txt──► clean .txt (in place, .raw.txt backup)
                              │
                              │ user reviews + tweaks
                              │
                              ▼
                       /images-for-videos
                              │
                              ▼
                       images-plan.json + anh-can-tao.md
                              │
                              │ user gens images on grok.com
                              │
                              ▼
                         /create-video
                              │
                              ▼
                    video/output/<slug>/video.mp4
```

`/refine-txt` lives in slot 1 of this chain — strictly between "user notes" and `/images-for-videos`. It does not auto-chain because the user wants editorial control over the refined version before image planning commits to a structure.

For URL sources, `/read-rewrite` does the equivalent of "fetch + refine" in one shot, so don't use `/refine-txt` after `/read-rewrite` — that would refine the already-refined output.
