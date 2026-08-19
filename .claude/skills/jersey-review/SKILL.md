---
name: jersey-review
description: Build a Vietnamese 9:16 sales/marketing video reviewing one or more football JERSEYS (kits) for a team — focused on DESIGN + IDEA, not players. Researches real design details from kit-analysis sites (Footy Headlines, Puma/Nike/adidas news), writes a desire-hook + per-jersey design breakdown + shop CTA (link góc trái + giỏ hàng) .txt under SportsForAllTV, plans product-hero images (chủ thể là CHIẾC ÁO, split-frame for multi-kit scenes), and chains into images-for-videos. The user-facing slash command is /jersey-review <team + which kits, or shop product URL(s)>.
---

# Jersey-Review Skill

Team + kit(s) → research real design → Vietnamese **sales** `.txt` (desire hook + design/idea breakdown + shop CTA) → product-hero image plan, in one command.

This is the **jersey-selling entry point** for the video pipeline — a monetization format distinct from news/preview content (see `memory/project_jersey_marketing_content.md`). The shop sells football kits with a TikTok-Shop product link (top-left sticker) + a cart under the clip; this skill turns one or more kits into a review clip that creates desire and drives the click. Unlike a ranking of many kits, this covers **1–3 specific kits in depth** (typically a team's home + away for the current season).

Three hard rules that make or break this content:
1. **The image subject is the SHIRT, not a player.** Every image is a product-hero / detail shot of the kit itself. Never plan player portraits (per `project_jersey_marketing_content.md`).
2. **Design facts MUST be researched, never guessed.** Brand, colorway, motif, and hidden details differ every season and every team switches suppliers — asserting "Nike" when it's Puma, or inventing a motif, is a factual miss. Always confirm from a kit-analysis source before writing.
3. **Use `callout`, NOT `stat-hero`, for the shirt scenes.** `stat-hero` renders `value` at 260px dead-centre — it covers the shirt's chest (crest, logo, collar), the exact thing you're selling. `callout` anchors a small caption (`statement` 62px + `tag` pill) in the lower third, leaving the whole upper frame for the shirt. See `project_jersey_marketing_content.md` (2026-07-03 layout bug).

## When to use

User runs `/jersey-review <argument>`, OR asks to make a selling/marketing clip for a football shirt. Examples:

- `/jersey-review áo Bồ Đào Nha 2026 sân nhà + sân khách`
- `/jersey-review Portugal home and away 2026 kits`
- `/jersey-review <shopee/tiktok-shop product URL>` (extract the team + kit from the listing, then research design)
- `/jersey-review áo Real Madrid sân nhà 2025/26`

If the argument is empty, ask: **which team, which season, and which kit(s)** (home / away / third), plus whether they have product photos or want AI-generated hero shots.

## Input contract

A single free-text argument naming the team + season + which kit(s), or a shop product URL. The skill works out the specific kits to cover. Default slug = `ao-<team>-<season?>` (strip Vietnamese diacritics, lowercase, `-`-separated, cap ~40 chars) — e.g. `ao-dau-bo-dao-nha`, `ao-real-madrid-2526`. New content goes under `video/input/<slug>/`.

If `video/input/<slug>/` already exists with files, **READ the existing `<slug>.txt` + `images-plan.json` first** and upgrade in place (keep filenames the user may already have generated images for) rather than making a suffixed duplicate.

## Workflow (MUST follow in order)

### Step 1: Identify the kits

Pin down exactly which shirts the video covers: **team, season/campaign, and kit types** (home / away / third / keeper / retro). Count them — this sets the video size (see Step 3). If a shop URL was given, WebFetch it once to read the listing (team, kit, season, price) as a starting anchor, then research design separately (product listings rarely explain the design story).

### Step 2: Research the design (WebSearch/WebFetch — the core step, MANDATORY)

For EACH kit, gather the real design story. **Footy Headlines is the primary source** (it publishes a design breakdown per kit); supplement with the supplier's own release (Puma / Nike / adidas / New Balance news), Football Shirt Culture, and the official store product page. Collect ALL of:

1. **Manufacturer / brand** — who makes it this season (verify; suppliers change).
2. **Colorway** — base color + accent colors, with the brand's official color names if given (e.g. "Club Red / Green Lagoon", "Aquamarine").
3. **Graphic pattern / motif** — the main visual theme printed on the shirt (e.g. wave/sea pattern, tessellation, city map) and what it represents.
4. **Special / hidden details** — the "wow" detail that sells the shirt: an inside-collar emblem (e.g. a compass), a V-cut, a commemorative tab, a jock-tag phrase, sleeve trim.
5. **Crest + branding placement** — federation/club crest, sponsor/brand logo color + position.
6. **Stated design inspiration / symbolism** — the official design story / campaign name (e.g. "Connecting Heroes", maritime heritage). This is gold for the voiceover — it turns a shirt into a story.
7. **Release date / campaign** — when it dropped, which tournament/season it's for.

Run per-kit searches in parallel: `"<team> <season> home kit Footy Headlines"`, `"<team> <season> away kit design inspiration"`, `"<team> <season> jersey <brand> release"`. Cross-check the brand + colorway across ≥2 sources when they disagree.

**If the design story genuinely can't be sourced for a kit**, describe only what's visible/verifiable (color, brand) and skip invented symbolism — never fabricate a motif or campaign name.

**Content policy:** this is commercial content — do NOT overclaim ("100% authentic", "chính hãng") unless the user confirms the product grade; describe the DESIGN (which is factual) and use generic quality language for material ("vải thoáng, thấm hút, co giãn") rather than unverifiable manufacturing claims.

### Step 3: Size the video

Scale scene/image count to how many kits + how much distinct design substance each has:

| Kits covered | Shape (image-eligible scenes) |
|---|---|
| **1 kit** | `hook` + `<kit>-tong` (overall) + 1–3 detail (motif / hidden detail / crest) + `cta-fan` → 4–6 images |
| **2 kits** | `hook` (split-frame both) + per kit: 1 overall + 1 signature-detail + `cta-fan` → ~6 images |
| **3 kits** | `hook` (split-frame 2 flagships) + per kit: 1 overall (+1 detail on the marquee kit) + `cta-fan` → ~7–8 images |

Cap at ~8 images. Each kit needs at minimum one clean **overall/product-hero** shot; give the flagship (usually home) one extra **signature-detail** shot (the hidden collar detail / motif macro) because that detail is the strongest sell. **All shirt + detail + cta scenes use the `callout` template** (small lower-third caption — shirt stays visible per hard rule 3); `stat-hero` is avoided entirely for this content.

### Step 4: Write the sales .txt (structure)

Plain markdown, UTF-8. One `##` section per kit, then a quick compare (if 2+), context, CTA. Sales-fun channel voice.

```markdown
<Title: Áo đấu <đội> <mùa>: <câu chốt cảm xúc gợi câu chuyện thiết kế>>

<Lead 1 đoạn — HOOK TẠO DESIRE mở đầu (khơi cảm giác "thiếu"/khích tướng nhẹ),
 nêu có mấy mẫu áo, hé lộ chủ đề thiết kế chung, mời xem hết clip để chọn mẫu.>

## <Tên kit 1 — vd Áo sân nhà>
- Ý tưởng / cảm hứng thiết kế: <câu chuyện thiết kế + campaign name + brand>. <Vì sao nó có ý nghĩa.>
- Màu sắc + họa tiết: <base color + accent + tên màu hãng> · <họa tiết/motif + biểu tượng>.
- Chi tiết đắt giá: <hidden detail — la bàn cổ áo / V-cut / tab kỷ niệm> + <crest + logo placement>.

## <Tên kit 2 — vd Áo sân khách>   ← nếu có
- <cùng 3 gạch: ý tưởng · màu+họa tiết · chi tiết đặc trưng>

## So sánh nhanh   ← nếu ≥2 kit
- <Kit 1 hợp gu ai> vs <Kit 2 hợp gu ai>.
- Điểm chung: <brand + cảm hứng/câu chuyện xuyên suốt>.

## Context
- Size cho nam/nữ/người lớn/trẻ em; ai mặc cũng hợp.

## CTA
- Muốn rước thì anh em bấm link góc trái màn hình nha.
- Muốn xem mẫu áo đội khác thì ghé giỏ hàng của mình, tha hồ lựa.
- Câu hỏi: <forced-choice từ nội dung — vd chọn áo sân nhà hay sân khách?> Để lại bình luận nha.

---
## Giới hạn thời lượng (cho /create-video — KHÔNG đọc lên, KHÔNG lên hình)
- Mục tiêu: 30-40 giây. Trần cứng: 45 giây. **Video bán hàng nên ngắn hơn video tin tức** — người xem quyết định mua trong 15 giây đầu.
- Tổng voiceText MỌI scene cộng lại: **≤ 150 từ** (đo thật 0,256 giây/từ trên 27 video đã render).
- **Mỗi body scene tối đa 1 câu, ≤ 16 từ** — 1 cảnh = 1 hình đứng yên ~4 giây. Hook ≤ 12 từ.
- Tổng scene: **≤ 10** (ảnh trong plan + CTA + engagement-question + outro).
- Check trước khi render: `npx tsx _validate-script.ts <script.json>` (chặn cứng, exit 1 = không render).

---
Nguồn: <domain(s) đã dùng>
Ngày: <today>
```

⚠️ **Block `## Giới hạn thời lượng` là BẮT BUỘC** (2026-08-03) — copy nguyên văn vào khu metadata. Budget ở đây **chặt hơn** các skill khác (150 từ / 40 giây thay vì 170 / 45): đây là content bán hàng, kể lể chi tiết thiết kế quá lâu thì mất người xem trước khi tới CTA. Nhiều mẫu áo → **cắt bớt số mẫu**, đừng kéo dài video.

Section rules:
- **Lead = desire hook.** Open by making the viewer feel they're missing out (the user's signature line pattern: *"Nể ông nào xem <ngôi sao> đá mà trong tủ không có nổi một chiếc áo <đội>"*), then promise the design story. Keep the star reference to WATCHING them play — do NOT pivot into shirt-number / player-name talk unless the user asks; the body is about DESIGN.
- **Per-kit section = 3 tight bullets:** (1) idea/inspiration + campaign + brand, (2) color + motif, (3) signature detail + crest/logo. Rich but not padded — each bullet is a real researched fact.
- **CTA = the user's exact model:** "link **góc trái màn hình**" (TikTok-Shop sticker) for the featured kit + "**giỏ hàng**" for other kits. Always end with a **forced-choice engagement question** built from the content (per `memory/feedback_engagement_question_scene.md`).
- **Source line:** list the kit-analysis domains used.

#### Channel typography + voice (apply before saving)
- **Strip diacritics on foreign names** (Ronaldo, aquamarine names), **keep Vietnamese diacritics**.
- **Arabic digits on screen**; voiceText phonetics handled downstream by `/create-video`.
- Sales-fun but not spammy — active voice, concrete design facts, no fake urgency, no unverifiable "chính hãng" claims.

### Step 5: Write images-plan.json (product-hero, SHIRT is the subject)

Schema = `src/image/plan-schema.ts` (`contentType` free string — use `"JERSEY-REVIEW"`; templates only `hook`/`stat-hero`/`callout`; filenames `.png/.jpg/.jpeg/.webp`). No `prompt` field — `subjectHint` only (Vietnamese, describing the SHIRT).

Per-scene rules:
- **hook** — for 2+ kits, a **split-frame** (`filename: "hook.png"`, user gens `hook-1` = kit A + `hook-2` = kit B; `images:stage` auto-merges). For 1 kit, a single product-hero of that shirt. `subjectHint` describes the shirt(s), 9:16 preferred.
- **`<kit>-tong` (callout)** — the whole shirt, flatlay/product-hero; caption names its color + motif + brand.
- **`<kit>-<detail>` (callout)** — a MACRO of the signature detail (e.g. `sannha-laban` = compass inside collar, `sankhach-vcut` = the chest V-cut). This is the money shot.
- **`cta-fan` (callout)** — fans wearing the kit(s) in a stadium; the only scene with people, and they're wearing the product.

  > The `images-plan.json` `template` field may still say `stat-hero` (it only picks the filename at stage time), but in `script.json` `/create-video` MUST emit these as `callout` — the plan template is not binding on the final render. Prefer writing `callout` in the plan too for clarity.
- Every `subjectHint` names the SHIRT + the design detail, never a player's face. Prefix nothing — these are product shots.

Use split-frame (`<id>-1` / `<id>-2`) any time you want two shirts (or a shirt front+back) in one scene — that is the "1–2 ảnh trong 1 scene" mechanism.

### Step 6: Write anh-can-tao.md

Lightweight VN checklist, one line per image the user must generate, in plan order. For split-frame scenes list BOTH `-1` and `-2` files. Lead with the note: **chủ thể là CHIẾC ÁO, không phải cầu thủ**; product photos of the real shop stock are preferred over AI when available (more trustworthy for selling). Same header boilerplate as `/images-for-videos` (flexible aspect, hook 9:16, save exact filenames).

### Step 7: (Optional) queue + hand off

Mention the user can run `/create-video video/input/<slug>/<slug>.txt` once images are saved. Only append to `video/input/queue.xlsx` if the user is running this through the batch queue workflow — a one-off jersey clip usually doesn't need queueing (ask or skip).

### Step 8: Reply concisely

```
✓ Nguồn bán hàng: video/input/<slug>/<slug>.txt (<N> mẫu áo)
✓ Image plan: video/input/<slug>/images-plan.json
✓ Checklist ảnh: video/input/<slug>/anh-can-tao.md

Thiết kế (đã research <nguồn>): <1 dòng tóm brand + cảm hứng mỗi mẫu>
<M> ảnh cần tạo (hook <split nếu 2 mẫu> + tổng thể + chi tiết mỗi mẫu + fan CTA).

Tiếp theo: gen ảnh (grok.com hoặc ẢNH SẢN PHẨM THẬT của shop — bán hàng thì ảnh thật
chuẩn hơn) → save đúng tên file → /create-video video/input/<slug>/<slug>.txt
```

## What this skill does NOT do

- Does not generate images — manual (grok.com or the shop's real product photos).
- Does not write `script.json` or render — that's `/create-video`.
- Does not invent design facts, brands, or campaign names — unsourced details are omitted, never fabricated.
- Does not plan player-portrait images — the shirt is always the subject.
- Does not make authenticity/"chính hãng" claims the user hasn't confirmed.

## Edge cases

| Situation | Action |
|---|---|
| Brand/design story unfindable for a kit | Describe visible facts (color, brand) only; skip invented symbolism |
| Shop URL given | WebFetch for team/kit/price anchor, then research design separately |
| User has real product photos | Use them — drop into folder under the planned filenames; skip AI hint |
| Only 1 kit | Single hook (no split) + overall + 1–3 details + cta (4–6 images) |
| Folder already prepped | Upgrade `.txt` + plan in place, keep existing filenames |
| Not a football kit | Bail — SportsForAllTV is football-only |

## Relationship to other skills

```
team + kit(s) ──/jersey-review──► research design (Footy Headlines + brand)
                                      │
                                      ▼
                    video/input/<slug>/<slug>.txt   (desire hook + design breakdown + shop CTA)
                                      │
                                      ├──► images-plan.json + anh-can-tao.md  (product-hero, SHIRT is subject)
                                      │            │
                                      │     user gens hero shots on grok.com  OR  drops real shop photos
                                      │            │
                                      └──/create-video (user runs)───────────► video/output/<slug>/video.mp4
```

Shares the product-hero + desire-hook + cart-CTA formula with `memory/project_jersey_marketing_content.md` (the RANKING-of-many-kits variant); this skill is the **deep-review-of-1-to-3-kits** variant.
