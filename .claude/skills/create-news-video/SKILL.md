---
name: create-news-video
description: Tạo video tin tức ngắn 9:16 (~60s) từ URL bài báo hoặc file .txt tiếng Việt. Trigger khi user yêu cầu tạo video tin tức, làm short news, làm bản tin video, render tin thành video, làm TikTok tin tức. Output: video.mp4 + voice.mp3 + script.txt cho CapCut.
---

# Create News Video Skill

Generate a Vietnamese 9:16 motion-graphic news video from a URL or .txt file.

## Input

Single argument: a news article URL (starts with `http://` or `https://`) OR a path to a `.txt` file.

## Workflow (MUST follow these steps in order)

### Step 1: Detect input type

- Starts with `http://` or `https://` → URL mode
- Otherwise → file mode

### Step 2: Fetch content

**URL mode:**
- Use `WebFetch` with prompt:
  ```
  Trích xuất từ trang này:
  - title (string): tiêu đề bài báo
  - content (string): nội dung chính, ~500-1500 từ
  - ogImage (string|null): URL ảnh og:image (meta og:image hoặc ảnh đầu bài)
  - domain (string): domain của URL (vd "vnexpress.net")
  Trả về JSON với 4 field trên.
  ```
- If WebFetch fails (paywall, JS-rendered, 4xx) → tell user to save content to a .txt file and pass that instead. Stop.

**File mode:**
- Use `Read` to read the .txt file
- Title = first non-empty line (strip whitespace, max 80 chars)
- Content = remaining lines joined
- ogImage = `null`
- domain = `"local"`
- **Optional but recommended for non-trivial files:** consult [`classify-football-content`](../classify-football-content/SKILL.md) to confirm content type (single-headline / match recap / transfer news / etc.) and apply its hook pattern + structure. News is short-form (5–8 scenes) so most of the classifier's structural advice gets compressed, but its hook patterns and tone guidance translate directly.

### Step 3: Create slug + output directory

- slug = lowercase ASCII (strip Vietnamese diacritics, đ→d), replace non-alphanumeric with `-`, trim dashes, max 40 chars
- timestamp = current local time as `YYYYMMDD-HHmm`
- outputDir = `output/<slug>-<timestamp>/`
- Use Bash: `mkdir -p <outputDir>`

### Step 4: Generate script.json

Following the schema in `docs/superpowers/specs/2026-04-29-auto-news-video-design.md` Section 4. Key rules:

**Script content (Vietnamese):**
- Total voiceText: ~150–200 words → ~55–65s spoken at speed 1.0
- Number of scenes: **5–8** (1 hook + 3–6 body + 1 outro)
- Each scene voiceText is 1-3 short sentences, văn nói (spoken style, not formal)
- No emoji, no markdown in voiceText

### ⚠️ CRITICAL: Vietnamese TTS Phonetic Rules

The `voiceText` field is read aloud by LucyLab/ElevenLabs Vietnamese TTS. **Numbers and symbols are read literally** — if you write "5.5", TTS may say "năm rưỡi" (five and a half — WRONG for version numbers). **Always spell out numbers in Vietnamese phonetic form** in `voiceText`. The `templateData` fields (visual text on screen) can keep the original "5.5" / "82.7%" formatting.

**Mandatory rules for `voiceText`:**

| Number form | WRONG (TTS misreads) | RIGHT (spell out in Vietnamese) |
|---|---|---|
| Decimal version | `GPT 5.5` → "năm rưỡi" ❌ | `GPT năm chấm năm` ✅ |
| Decimal stat | `82.7%` | `tám mươi hai phẩy bảy phần trăm` |
| Version | `iPhone 17` | `iPhone mười bảy` (or `iPhone 17` works for whole numbers) |
| Version with point | `iOS 18.2` | `iOS mười tám chấm hai` |
| Tech spec | `200MP` | `hai trăm megapixel` |
| Battery | `5000mAh` | `năm nghìn miliampe giờ` |
| Tokens | `1M tokens` / `1000000 tokens` | `một triệu token` |
| Price VND | `21 triệu đồng` | `hai mươi mốt triệu đồng` |
| Price USD | `$5` | `năm đô la` (or `năm đô`) |
| Multiplier | `2x` | `gấp đôi` (more natural than "hai lần") |
| Year | `2026` | `hai nghìn không trăm hai mươi sáu` (or just `năm 2026` reads OK) |
| Percentage with decimal | `30%` | `ba mươi phần trăm` |
| Time | `60 giây` | `sáu mươi giây` |
| Frequency | `5G` | `năm gờ` (be careful — TTS often says "năm-gờ") |

**Notation choices:**
- For decimal point use `chấm` (more spoken/natural) or `phẩy` (formal). Both work; pick consistent.
- For comma separator, use `phẩy` (e.g. "1,000" → "một nghìn")
- For ratio "3:1" → say `ba trên một` or `ba so với một`

**English brand names — keep as-is**, TTS handles them OK:
- `Apple`, `Google`, `OpenAI`, `Microsoft`, `TikTok`, `YouTube` ✅

**English acronyms — write phonetically if TTS misreads:**
- `AI` → usually OK, sometimes write `ây ai` for clarity
- `API` → write `ây pi ai` if matter
- `GPT` → usually OK; if not, write `gí pi tí`
- `iOS` → write `ai ô ét` if matter

**Symbols to AVOID in voiceText:**
- `→` `&` `%` `$` `#` `+` `=` (TTS may say literal name or skip)
- `!` `?` at end of sentence is OK — they create natural intonation
- Emoji: NEVER (TTS pronounces or skips inconsistently)
- URLs: NEVER (TTS reads dot/slash literally)

**End each `voiceText` sentence with `.` or `?`** for natural pause/intonation.

**Examples — full scene:**

WRONG (will sound bad):
```json
{ "voiceText": "GPT 5.5 đạt 82.7% trên Terminal-Bench, vượt GPT 5.4 (75.1%)." }
```
→ TTS reads: "GPT năm rưỡi đạt tám mươi hai chấm bảy phần trăm trên Terminal-Bench..."

RIGHT (natural):
```json
{ "voiceText": "GPT năm chấm năm đạt tám mươi hai phẩy bảy phần trăm trên Terminal Bench, vượt phiên bản năm chấm bốn ở mức bảy mươi lăm phẩy một." }
```

**Note**: `templateData` (text on screen) CAN use original formatting — the visual is separate from spoken:
```json
{
  "voiceText": "GPT năm chấm năm đạt tám mươi hai phẩy bảy phần trăm.",
  "templateData": {
    "template": "stat-hero",
    "value": "82.7%",                 ← Visual: keep readable formatting
    "label": "Terminal-Bench"
  }
}
```

**Hook (most important — gets first 3 seconds of viewer attention):**
- Must contain a claim, statistic, or curious question
- NEVER generic ("Hôm nay chúng ta sẽ nói về..." is wrong)
- ALWAYS include at least 1 effect: `flash-white-3f` or `particle-burst`

**Visual rules:**
- For image scenes: `background.src = "$source.image"` (literal — CLI substitutes)
- Vary `kenBurns` across scenes (don't use `zoom-in` for every scene)
- Vary text `animation` (don't use `slide-up` for every line)
- Each line ≤ 25 characters
- Each scene 1-3 lines

**Outro (always fixed format):**
```json
{
  "id": "outro",
  "type": "outro",
  "voiceText": "Theo dõi Bóng lăn để xem bản tin mới mỗi ngày.",
  "templateData": {
    "template": "outro",
    "ctaTop": "Theo dõi ngay",
    "channelName": "Bóng lăn",
    "source": "Sưu tầm"
  }
}
```
The video renders `Nguồn: ${source}` at the end. **Always use `"Sưu tầm"`** regardless of input mode (URL, file, topic) — content is editorially curated under the Bóng lăn brand, not direct attribution to a single article.

### ⚠️ AI scene image prompts (recommended for football videos)

To make videos visually rich (not just text on gradient), add an `imagePrompt` field at the **scene level** (sibling of `voiceText` and `templateData`). Pipeline calls OpenAI `gpt-image-1` to generate a 1024×1536 background photo per scene.

**Only effective for templates:** `hook`, `callout`, `stat-hero`. Ignored on `comparison`, `feature-list`, `outro` (those have strong UI of their own).

**Auto-skipped when:** scene is `hook` AND article has `og:image` (real photo from article wins — usually best). For body scenes, AI gen always runs if `imagePrompt` is set.

**Prompt rules (write in English — GPT-Image is much stronger in English):**
- Sports photography style — cinematic, action, atmospheric. NOT cartoon/illustration.
- Include vertical hint: `"vertical 9:16 composition"` or `"portrait orientation"`.
- 30–100 words. Too short → generic; too long → ignored.
- Real player/coach names usually OK, but DON'T describe specific club logos/crests (model may refuse or render text).
- Avoid asking for **text in image** (scoreboards, captions) — your video already overlays text.

**Examples for football news:**
```json
{
  "id": "hook",
  "imagePrompt": "Cinematic action photo of a football player in red and white kit celebrating a goal at a packed European stadium at night, dramatic stadium floodlights, fans blurred in background, intense emotion, vertical 9:16 composition, sports photography, photo-realistic, shallow depth of field"
},
{
  "id": "body-2",
  "templateData": { "template": "callout" },
  "imagePrompt": "Football coach on touchline at modern European stadium, intense focused expression, wearing dark suit, gesturing toward the pitch, evening match lighting, blurred crowd, vertical 9:16 portrait, sports photography, dramatic mood"
},
{
  "id": "body-4",
  "templateData": { "template": "stat-hero" },
  "imagePrompt": "Wide low-angle shot of a European football stadium at night, packed stands, floodlights piercing fog, dramatic atmosphere, vertical 9:16, cinematic sports photography"
}
```

**When to OMIT imagePrompt:**
- Hook scene + article `og:image` available → omit (og:image used automatically).
- Body scene with `feature-list` or `comparison` template → omit (pipeline ignores it anyway).
- Quick news where text-on-gradient is fine.

**No `OPENAI_API_KEY`?** Pipeline silently falls back to gradient backgrounds — your script still renders.

### Step 5: Self-validate before writing

Check:
- Total word count ~150-200
- Every line.content ≤ 25 chars
- 5-8 scenes total
- scenes[0].type === "hook"
- last scene type === "outro"
- All enum values valid (see spec Section 4.2)

If invalid, fix yourself silently. Up to 2 self-correction passes. After that, write anyway — the CLI's Zod validation will produce a precise error message that the user can act on.

### Step 6: Write script.json

Use the Write tool (not Bash) to write the validated JSON to `<outputDir>/script.json`.

### Step 7: Run the pipeline

Use Bash, **foreground** (not background), stream output:

```bash
npm run pipeline -- <outputDir>/script.json
```

If exit code != 0:
- Report the error message clearly
- Tell user the output dir path so they can inspect intermediate files

### Step 8: Report success

If successful, report to user with markdown links:

```markdown
✓ Video:  [video.mp4](output/<slug>-<timestamp>/video.mp4)
✓ Audio:  [voice.mp3](output/<slug>-<timestamp>/voice.mp3) — for CapCut
✓ Script: [script.txt](output/<slug>-<timestamp>/script.txt) — for CapCut auto-caption
Tổng thời lượng: XX.Xs
```

## Examples

### Example 1: Football URL with og:image (vnexpress sport)

User: `/create-news-video https://vnexpress.net/arsenal-vao-chung-ket-c1-5070388.html`

Generated `script.json` (excerpt — full script has 5–8 scenes total):
```json
{
  "version": "1.0",
  "metadata": {
    "title": "Arsenal vào chung kết Champions League sau 20 năm",
    "source": {
      "url": "https://vnexpress.net/arsenal-vao-chung-ket-c1-5070388.html",
      "domain": "vnexpress.net",
      "image": "https://i1-vnexpress.vnecdn.net/arsenal-celebrate.jpg"
    },
    "channel": "Bóng lăn"
  },
  "voice": { "provider": "lucylab", "voiceId": "${VIETNAMESE_VOICEID}", "speed": 1.0 },
  "scenes": [
    {
      "id": "hook", "type": "hook",
      "voiceText": "Arsenal lập kỳ tích, vào chung kết Champions League lần đầu sau gần hai mươi năm chờ đợi.",
      "templateData": {
        "template": "hook",
        "headline": "Arsenal lập kỳ tích!",
        "subhead": "Vào chung kết C1!",
        "bgSrc": "$source.image",
        "kenBurns": "zoom-in"
      }
    },
    {
      "id": "body-1", "type": "body",
      "voiceText": "Bukayo Saka ghi bàn duy nhất giúp Arsenal hạ Atletico Madrid một không trong trận lượt về đầy kịch tính.",
      "templateData": {
        "template": "stat-hero",
        "value": "1-0",
        "label": "Saka ghi bàn vàng",
        "context": "Atletico Madrid bị loại"
      },
      "imagePrompt": "Cinematic action photo of a young English football winger in red and white kit celebrating a goal at Emirates Stadium at night, arms outstretched, intense joy, packed crowd blurred behind, dramatic floodlights, vertical 9:16 portrait, photo-realistic sports photography"
    },
    {
      "id": "body-2", "type": "body",
      "voiceText": "Huấn luyện viên Arteta xúc động chia sẻ ông không thể tự hào hơn về toàn đội và người hâm mộ.",
      "templateData": {
        "template": "callout",
        "statement": "Arteta: Không thể tự hào hơn về toàn đội.",
        "tag": "Arteta"
      },
      "imagePrompt": "Football coach in dark jacket on touchline at packed European stadium at night, intense focused expression, gesturing toward pitch, blurred crowd in background, dramatic floodlights, vertical 9:16 portrait, photo-realistic sports photography, dramatic mood"
    }
    /* ... 1–3 more body scenes + outro ... */
  ]
}
```

Notes:
- Hook uses `bgSrc: "$source.image"` to slot the article's og:image. No `imagePrompt` needed because the real photo is more authentic than AI gen.
- Body scenes (callout, stat-hero) get `imagePrompt` for atmospheric AI imagery.

### Example 2: .txt file with no image (local source)

User: `/create-news-video news/v-league-round12.txt`

Generated `script.json` (excerpt):
```json
{
  "metadata": {
    "title": "V-League vòng 12: Hà Nội FC dẫn đầu sau chiến thắng kịch tính",
    "source": { "url": "local", "domain": "local", "image": null },
    "channel": "Bóng lăn"
  },
  "scenes": [
    {
      "id": "hook", "type": "hook",
      "voiceText": "Hà Nội FC ngược dòng kịch tính ở phút bù giờ, chiếm lại ngôi đầu V-League.",
      "templateData": {
        "template": "hook",
        "headline": "Hà Nội FC ngược dòng!",
        "subhead": "Bàn thắng phút 90+",
        "kenBurns": "zoom-in"
      },
      "imagePrompt": "Cinematic wide shot of a Vietnamese football stadium at sunset, fans in purple and white packed in stands, dramatic golden lighting, anticipation atmosphere, vertical 9:16 composition, photo-realistic sports photography"
    }
    /* ... 3–6 body scenes + outro with source: "Sưu tầm" ... */
  ]
}
```

Notes:
- No og:image → hook gets `imagePrompt` for AI-generated atmospheric photo.
- All body scenes that benefit from imagery (callout, stat-hero) should include `imagePrompt`.
- Outro `source` field = `"Sưu tầm"` always — never echo the input domain.

## Sound Effects (SFX)

**You almost never need to set the `sfx` field.** The pipeline has a smart 3-tier selector that picks the right SFX for each scene automatically:

1. **If `scene.sfx` is set** → use exactly that (override).
2. **Else, scan `voiceText` for semantic keywords**:
   - `cảnh báo / rủi ro / nguy hiểm / warning` → `alert/`
   - `kỷ lục / vượt / xuất sắc / breakthrough / success` → `success/`
   - `thất bại / sai / lỗi / fail / wrong` → `fail/`
   - `ra mắt / công bố / lần đầu / launch / unveil` → `reveal/`
   - `đếm ngược / tích tắc / countdown` → `countdown/`
   - `hùng vĩ / hoành tráng / cinematic / epic` → `cinematic/`
   - `hồi hộp / chờ đợi / drumroll / suspense` → `drumroll/`
3. **Else, fall back to template default category**:
   - `hook` → `transition/` or `cinematic/`
   - `comparison` → `transition/` or `emphasis/`
   - `stat-hero` → `emphasis/` or `success/`
   - `feature-list` → `transition/` or `emphasis/`
   - `callout` → `alert/` or `drumroll/`
   - `outro` → `outro/` or `success/`

Within a category, the actual file is picked **deterministically** by hashing the scene id — same script gives same SFX (idempotent), but different scenes in the same video get different files (variety).

**This means:** in 95% of cases you should OMIT the `sfx` field entirely. Just write good Vietnamese voiceText with natural keywords (warning, breakthrough, launch, etc.) and the pipeline will pick the right sound.

### When to add explicit `sfx` override

Only when you want to FORCE a specific sound that the keyword matcher won't infer:
- Scene needs a particular signature sound (e.g., always a gong on important scenes)
- Disable SFX for a particular scene: `"sfx": { "name": "none" }`
- Use a specific file: `"sfx": { "name": "transition/whoosh-sfx", "volume": 0.4 }`

Example (rarely needed):
```json
{
  "id": "body-3",
  "voiceText": "...",
  "templateData": { ... },
  "sfx": { "name": "drumroll/snare-roll", "volume": 0.5, "startOffsetSec": 0.2 }
}
```

The pipeline auto-mixes a sound effect at each scene start based on the template type:

| Template | Default SFX | Sound character |
|---|---|---|
| `hook` | `transition/whoosh-soft` | Dramatic entrance |
| `comparison` | `transition/swoosh` | Side-by-side reveal |
| `stat-hero` | `emphasis/ding` | Number reveal |
| `feature-list` | `transition/pop` | Bullet appearance |
| `callout` | `alert/notification` | Important info |
| `outro` | `outro/tada` | Ending signature |

**You usually do NOT need to add a `sfx` field** — defaults work for 95% of cases.

**ONLY add an explicit `sfx` override when content STRONGLY suggests a different mood:**

| Content cue (in voiceText) | Override |
|---|---|
| "cảnh báo", "rủi ro", "đáng lo", "nguy hiểm" | `{ "name": "alert/notification", "volume": 0.4 }` |
| "vượt", "kỷ lục", "xuất sắc", "tăng mạnh" (positive stat) | `{ "name": "emphasis/chime", "volume": 0.35 }` |
| Want to disable SFX for this scene | `{ "name": "none" }` |

Place `sfx` at the same level as `voiceText` and `templateData`:

```json
{
  "id": "body-3",
  "type": "body",
  "voiceText": "Cảnh báo: AI tự chủ có thể đặt ra rủi ro về an ninh mạng.",
  "templateData": { "template": "callout", ... },
  "sfx": { "name": "alert/notification", "volume": 0.4 }
}
```

Available SFX categories (any `<name>` subfolder in `assets/sfx/<category>/<name>.mp3`):
- `transition/` — whoosh, swoosh, swish, pop, punch, page-flip, slide, riser
- `emphasis/` — ding, tick, chime, ping, bong, pop, punch
- `alert/` — notification, alert, alarm, warning
- `success/` — applepay, achievement, win, xbox, steam, jet-set
- `fail/` — wrong-answer-buzzer, incorrect, error, dank-meme
- `outro/` — tada, win31, noooo
- `reveal/` — magic-fairy, anime-girl, hey-female-voice
- `drumroll/` — snare, drum-roll, boom
- `countdown/` — beep, timer
- `cinematic/` — rise, impact

Browse `assets/sfx/<category>/` to see exact filenames. Reference WITHOUT the `.mp3` extension. Example:
```json
{ "sfx": { "name": "success/xbox-360-achievement-sound", "volume": 0.4 } }
```

## Edge cases

| Situation | Action |
|---|---|
| URL paywall / JS-rendered → WebFetch returns no content | Tell user: "Không đọc được URL (có thể do paywall hoặc JS). Hãy lưu nội dung vào file .txt rồi gọi lại." Stop. |
| URL content < 200 words | Warn "Tin gốc ngắn, video có thể không đủ chất liệu", continue anyway |
| URL content > 2000 words | Summarize to key points, fit ~150-200 words script |
| File mode + file empty/missing | Error message, don't create output dir |
| Pipeline fails | Report error message + output dir path; user can re-try `npm run pipeline -- <path>` after fixing |
