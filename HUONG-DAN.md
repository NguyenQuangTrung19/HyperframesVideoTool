# Hướng dẫn sử dụng — SportsForAllTV Auto Create Video

Tài liệu hướng dẫn toàn bộ pipeline tạo video 9:16 cho kênh **SportsForAllTV**. Có 2 pipeline chính:

- **VIDEO pipeline (motion-graphic)** — script + AI poster image + template động. Mọi loại content non-podcast đi qua đây: tin tức, ranking, VS, preview, transfer, trivia, tiểu sử cầu thủ, lịch sử CLB / ĐTQG / giải đấu.
- **PODCAST pipeline (footage user-supplied + voice + karaoke caption)** — .txt prose + video clip thật → TTS phủ lên + karaoke caption burn-in.

Music video là pipeline phụ thứ 3, dùng song audio do user cung cấp.

---

## Quick start

```bash
# 1. Setup 1 lần (xem section 1)
npm install
cp .env.example .env.local && $EDITOR .env.local   # điền AUSYNCLAB_API_KEY

# 2. Tạo video từ URL bài báo
/read-rewrite https://www.goal.com/vn/news/some-article/12345
# → tự sinh .txt + images-plan.json + list prompts

# 3. Mở grok.com (cần SuperGrok), mở N tab song song, gen ảnh,
#    save vào video/input/<slug>/ với filename theo plan.

# 4. Build video
/create-video video/input/<slug>/<slug>.txt
# → output: video/output/<slug>/video.mp4
```

---

## Mục lục

- [0. Tổng quan](#0-tổng-quan)
- [1. Cài đặt + setup ban đầu](#1-cài-đặt--setup-ban-đầu)
- [2. Cấu trúc folder](#2-cấu-trúc-folder)
- [3. Quyết định dùng skill nào](#3-quyết-định-dùng-skill-nào)
- [4. Pipeline VIDEO (motion-graphic)](#4-pipeline-video-motion-graphic)
  - [4.1 /read-rewrite — URL → .txt + plan ảnh](#41-read-rewrite--url--txt--plan-ảnh)
  - [4.2 /refine-txt — Polish ghi chú thô](#42-refine-txt--polish-ghi-chú-thô)
  - [4.3 /images-for-videos — Lên plan ảnh](#43-images-for-videos--lên-plan-ảnh)
  - [4.4 /create-video — Build motion-graphic video](#44-create-video--build-motion-graphic-video)
  - [4.5 /video-queue — Batch Excel queue](#45-video-queue--batch-excel-queue)
  - [4.6 /classify-football-content — Diagnostic](#46-classify-football-content--diagnostic)
- [5. Pipeline PODCAST](#5-pipeline-podcast)
  - [5.1 /create-podcast — Build 1 clip podcast](#51-create-podcast--build-1-clip-podcast)
  - [5.2 /podcast-queue — Batch Excel queue](#52-podcast-queue--batch-excel-queue)
- [6. Pipeline MUSIC VIDEO](#6-pipeline-music-video)
- [7. Workflows điển hình từ A-Z](#7-workflows-điển-hình-từ-a-z)
- [8. Env variables](#8-env-variables)
- [9. Troubleshooting](#9-troubleshooting)
- [10. Tips chất lượng](#10-tips-chất-lượng)
- [11. Channel context + brand](#11-channel-context--brand)
- [Phụ lục A — npm scripts](#phụ-lục-a--npm-scripts)
- [Phụ lục B — Slash commands](#phụ-lục-b--slash-commands)
- [Phụ lục C — Folder cheat sheet](#phụ-lục-c--folder-cheat-sheet)

---

## 0. Tổng quan

### Kênh + brand

- **SportsForAllTV** — kênh TikTok/Reels/FB bóng đá tiếng Việt, handle `@bonglan0702`.
- Brand visible: `SportsForAllTV` (CamelCase, không dấu).
- Voice TTS đọc: `"Sports For All Ti Vi"` (3 từ riêng, `TV` thành `Ti Vi`).

### Pipeline overview

```
                 ┌──────────────────────┐
                 │  Nguồn nội dung      │
                 │  (URL / .txt notes)  │
                 └──────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  /read-rewrite       /refine-txt        Tự viết .txt
  (URL → .txt)        (notes → .txt)
        │                   │                   │
        └─────────┬─────────┴─────────┬─────────┘
                            ▼
                  /images-for-videos
                  (plan ảnh + gen Grok manual)
                            │
                            ▼
                     /create-video
                  (news / ranking / VS / preview /
                   bio / history / trivia / transfer)
                            │
                            ▼
                  video/output/<slug>/video.mp4

Podcast (footage thật):
   ┌─────────────────────────┐
   │ .txt + sibling video    │ → /create-podcast → podcast/output/<slug>/<slug>.mp4
   └─────────────────────────┘
                                  │
   Batch: podcast/input/queue.xlsx + concept folders → /podcast-queue
```

### Sản phẩm cuối

- **Format:** 9:16 vertical, 1080×1920, h264 mp4, AAC audio 192k
- **Frame rate:** 30fps
- **Length:** 30s–3min (tùy content type + density)
- **Upload đích:** TikTok, Instagram Reels, Facebook Reels, YouTube Shorts

---

## 1. Cài đặt + setup ban đầu

### 1.1 Yêu cầu hệ thống

- **Windows 11** (đã test). Linux/Mac có thể chạy với điều chỉnh path.
- **Node.js 20+** — kiểm tra: `node --version`.
- **ffmpeg + ffprobe** trong PATH — kiểm tra: `ffmpeg -version`.
- **uv + Python** — chỉ cần nếu dùng VieNeu fallback hoặc karaoke caption.
- **VieNeu-TTS project** — clone riêng, đường dẫn set qua `VIENEU_PROJECT_DIR` (default `../VieNeu-TTS`).

### 1.2 Cài dependencies Node

```bash
npm install
```

### 1.3 Cài faster-whisper (cho karaoke caption)

Trong folder VieNeu-TTS project:

```bash
cd $VIENEU_PROJECT_DIR
uv add faster-whisper
```

Lần chạy đầu sẽ tự tải Whisper model (~150MB cho `small`, ~500MB cho `medium`).

### 1.4 Setup .env.local

```bash
cp .env.example .env.local
$EDITOR .env.local
```

Các biến chính:

```bash
# TTS — AusyncLab paid (default)
TTS_PROVIDER=ausynclab
AUSYNCLAB_API_KEY=<key của bạn>
AUSYNCLAB_VOICE_ID=1914439                 # An Khôi — default kênh
AUSYNCLAB_MODEL_NAME=myna-2                # cho /create-video (prosody giàu)
PODCAST_AUSYNCLAB_MODEL_NAME=myna-1-turbo  # cho /create-podcast riêng
PODCAST_AUSYNCLAB_VOICE_ID=1915475         # voice riêng cho podcast (optional)

# TTS — VieNeu fallback (local, free)
VIENEU_PROJECT_DIR=../VieNeu-TTS

# Image generation (chỉ fallback — channel ưu tiên manual Grok)
GEMINI_API_KEY=<optional>
OPENAI_API_KEY=<optional>
XAI_API_KEY=<optional>

# Brand
TIKTOK_DISPLAY_NAME=SportsForAllTV
TIKTOK_HANDLE=@bonglan0702
TIKTOK_FOLLOWERS=1.2M followers
```

### 1.5 Verify

```bash
npm run typecheck                # TypeScript compile OK
npm run pipeline -- --help       # motion-graphic CLI load OK
npm run podcast -- --help        # podcast CLI load OK
```

---

## 2. Cấu trúc folder

Type-major layout (sau refactor 2026-05-25):

```
repo-root/
├── .claude/skills/             ← Claude Code skill definitions (SKILL.md mỗi skill)
│   ├── create-video/
│   ├── create-podcast/
│   ├── podcast-queue/
│   ├── create-music-video/
│   ├── images-for-videos/
│   ├── read-rewrite/
│   ├── refine-txt/
│   └── classify-football-content/
│
├── src/                        ← TypeScript source code
│   ├── pipeline.ts             ← motion-graphic pipeline entry
│   ├── podcast/pipeline.ts     ← podcast pipeline entry
│   ├── music/pipeline.ts       ← music video pipeline entry
│   └── render/                 ← script schema, HTML composer, templates
│
├── scripts/                    ← npm-runnable utility scripts
│   ├── podcast-queue.ts        ← batch podcast runner
│   ├── stage-planned-images.ts ← stage Grok-manual images
│   └── list-image-prompts.ts   ← reprint image prompts từ script.json
│
├── video/                      ← motion-graphic data (news/ranking/bio/history/…)
│   ├── input/<slug>/<slug>.txt     ← source + images-plan.json + ảnh manual
│   └── output/<slug>/              ← finished mp4 + voice.mp3 + script.json + …
│
├── podcast/                    ← podcast data
│   ├── input/
│   │   ├── story/*.txt             ← podcast scripts (reserved folder name)
│   │   ├── queue.xlsx              ← queue cho /podcast-queue
│   │   └── <concept>/*.mp4         ← clip library (flat — `football/`, `world/`, `neymar/`, …)
│   ├── _runs/<slug>/               ← workdir tạm cho /podcast-queue
│   └── output/<slug>/<slug>.mp4    ← finished podcast mp4
│
├── assets/                     ← shared assets
│   ├── beat/                       ← background music (mp3/m4a/wav/mp4)
│   ├── sfx/                        ← motion-graphic transition SFX
│   └── logoPodcast.png             ← optional brand logo overlay
│
├── .env.local                  ← config local (KHÔNG commit)
├── package.json
└── HUONG-DAN.md                ← file này
```

**Legacy:** `input/<slug>/<slug>.txt` (pre-2026-05-25) vẫn được nhận cho /create-video. Resolver chấp nhận cả 2 layout.

---

## 3. Quyết định dùng skill nào

### 3.1 Theo loại nội dung

| Loại nội dung | Ví dụ | Skill |
|---|---|---|
| Tin tức / phân tích trận | "Arsenal 2-1 Real, Saka tỏa sáng" | `/create-video` |
| Ranking / Top N | "Top 5 vua phá lưới UCL 24-25" | `/create-video` |
| VS / so sánh | "Messi vs Ronaldo: ai vĩ đại hơn?" | `/create-video` |
| Pre-match preview / squad reveal | "Đội hình dự kiến Đức cho WC 2026" | `/create-video` |
| Player profile (stats deep-dive) | "Bruno Fernandes mùa này: số liệu chi tiết" | `/create-video` |
| Transfer news | "Bom tấn: Mbappe đến Real" | `/create-video` |
| Trivia / Did-you-know | "5 kỷ lục lạ lùng nhất Premier League" | `/create-video` |
| Player biography | "Hành trình Modric: từ chiến tranh đến QBV" | `/create-video` |
| Club / NT / tournament history | "100 năm Real Madrid", "Champions League qua các thời kỳ" | `/create-video` |
| Podcast (1 footage + voice phủ lên) | "Tôi nghĩ Pep sai khi..." | `/create-podcast` |
| Music video (karaoke lyric) | Bài hát + footage | `/create-music-video` |

### 3.2 Theo nguồn nội dung

| Nguồn ban đầu | Bước trung gian | Skill build cuối |
|---|---|---|
| URL bài báo (Goal/Vnexpress/etc.) | `/read-rewrite <url>` → .txt + images-plan.json | `/create-video` |
| Ghi chú thô (paste linh tinh) | `/refine-txt <path.txt>` → clean .txt | `/images-for-videos` → `/create-video` |
| Đã có .txt sạch | `/images-for-videos <path.txt>` → images-plan.json | gen ảnh grok.com → `/create-video` |
| Nhiều .txt video sources | đặt path vào `video/input/queue.xlsx` | `/video-queue` (2-pass) |
| .txt podcast + 1 video clip | (nothing) | `/create-podcast <path.txt>` |
| Excel queue podcast | đặt path .txt vào queue.xlsx | `/podcast-queue` |

### 3.3 Decision tree

```
Source là URL?
├── Yes → /read-rewrite <url>  (tự chain /images-for-videos)
│         → gen ảnh grok.com → /create-video <txt>
└── No
    │
    Nguồn là ghi chú thô?
    ├── Yes → /refine-txt <path.txt>
    │         → /images-for-videos → gen ảnh → /create-video
    └── No (đã có .txt sạch)
        │
        Loại nội dung?
        ├── Podcast (1 footage)  → /create-podcast
        ├── Music video          → /create-music-video
        └── Mọi cái còn lại      → /images-for-videos → /create-video

Batch processing?
├── Motion-graphic video batch (>1 row) → /video-queue (2-pass: prep → gen ảnh manual → render)
└── Podcast batch (>1 row) → /podcast-queue
```

---

## 4. Pipeline VIDEO (motion-graphic)

Build video 9:16 với motion-graphic templates: `hook`, `stat-hero`, `callout`, `comparison`, `feature-list`, `formation-pitch`, `timeline`, `big-quote`, `engagement-question`, `outro`. Render bằng HyperFrames + HTML composer.

### 4.1 /read-rewrite — URL → .txt + plan ảnh

**Mục đích:** URL bài báo → fetch nội dung → rewrite sang .txt structured channel-voice → tự chain vào `/images-for-videos`.

**Khi nào dùng:**
- Có URL bài cụ thể, muốn nhanh chóng có draft.
- Cần channel voice + structure chuẩn (title + lead + Key facts + Context + Quotes).

**Cú pháp:**

```
/read-rewrite <URL>
```

**Workflow tự động:**
1. Fetch HTML bài báo (WebFetch).
2. Strip header/footer/ads, lấy body chính.
3. Classify content type (RANKING/VS/MATCH ANALYSIS/etc. — qua `/classify-football-content`).
4. Rewrite tiếng Việt theo channel voice:
   - Title sentence-case
   - Lead 1-2 câu hook
   - **Key facts:** bullet list số liệu/sự kiện
   - **Context:** 1-2 đoạn giải thích
   - **Quotes:** nếu có, attribution rõ
5. Slug = lowercase ASCII của title, max 50 chars.
6. Lưu tại `video/input/<slug>/<slug>.txt`.
7. **Tự chain `/images-for-videos`** → sinh `images-plan.json` cạnh .txt.

**Sau khi xong:** nhận path .txt + path images-plan.json + danh sách prompts. Mở grok.com, gen ảnh song song trên nhiều tab, save vào `video/input/<slug>/` với filename trong plan, rồi chạy `/create-video`.

**Ví dụ:**

```
/read-rewrite https://www.goal.com/vn/news/messi-record-2026/12345
```

Output:
```
✓ Rewritten: video/input/messi-record-2026/messi-record-2026.txt
✓ Images planned: video/input/messi-record-2026/images-plan.json
  → 6 ảnh cần gen, mở grok.com và xử song song trên 6 tab:
    1. hook.jpg — Vertical 9:16 football poster artwork featuring Lionel Messi...
    2. rank-1.jpg — ...
```

**Lưu ý:**
- Bio/history dài-kỳ thường ít có URL tương ứng — viết .txt tự tay (hoặc qua `/refine-txt`) hợp hơn.
- URL paywall / geo-block → fail. Fallback: copy nội dung bài + `/refine-txt`.

---

### 4.2 /refine-txt — Polish ghi chú thô

**Mục đích:** Ghi chú thô (paste linh tinh từ FB, copy paragraph, bullet jots) → polish thành .txt structured channel-voice, ready cho `/images-for-videos`.

**Khi nào dùng:**
- Ghi chú nhiều nhưng cấu trúc lộn xộn.
- Văn không chuyên — nhiều câu thừa, từ phổ thông cần thay bằng thuật ngữ bóng đá.
- Cần normalize phonetic (số → digit form, abbreviation → spell out trong voice).

**Cú pháp:**

```
/refine-txt <path/to/source.txt>
```

**Workflow:**
1. Read source .txt.
2. Backup gốc thành `<slug>.raw.txt` (chỉ lần đầu — chạy lại không overwrite backup).
3. Drop fluff: `"Có thể nói rằng…"`, `"Đáng chú ý là…"`, `"Theo nguồn tin…"`, `"tuyệt vời"`/`"đặc biệt"`/`"ấn tượng"` treo lửng.
4. Restructure: Title / Lead / **Key facts:** / **Context:** / **Quotes:**
5. Apply channel voice (xem section 11).
6. Apply phonetic rules (digit form cho số nguyên, spell out cho decimal).
7. Ghi đè .txt **IN PLACE**.

**Ví dụ source thô:**

```
Bruno Fernandes mùa này quá hay
Tổng cộng có 19 kiến tạo PL — gần kỷ lục
Trận đầu Carrick lên thay Amorim, Bruno về số 10 cổ điển, hồi sinh ngay lập tức
Cunha nói "Bruno là một trong những số 10 tốt nhất tôi từng chơi cùng"
```

Output sau `/refine-txt`:

```
Bruno Fernandes: 19 kiến tạo, sát kỷ lục Premier League

Mười chín pha kiến tạo của Bruno Fernandes mùa này chỉ kém kỷ lục Ngoại hạng Anh đúng một đường chuyền.

Key facts:
- 19 pha kiến tạo Premier League — kỷ lục giải là 20.
- Trận đầu dưới quyền Carrick: Bruno trở về vai trò số 10 cổ điển.
- Hồi sinh ngay trận đầu sau khi Amorim bị sa thải.

Context:
Khi Carrick lên thay Amorim, Bruno được trả về vị trí số 10 cổ điển — vai trò thường xuyên trên sân Manchester United. Sự thay đổi này lập tức cho thấy hiệu quả: anh chỉ huy nhịp tấn công, tạo ra nhiều cơ hội rõ rệt hơn.

Quotes:
- Cunha (đồng đội): "Bruno là một trong những số 10 tốt nhất tôi từng được chơi cùng."
```

**Sau khi xong:** tiếp tục với `/images-for-videos <path.txt>`.

**Lưu ý:** nếu source < 100 từ → skill có thể bail (quá thiếu để polish hữu ích).

---

### 4.3 /images-for-videos — Lên plan ảnh

**Mục đích:** Phân tích .txt → quyết định scene nào cần ảnh riêng → viết prompt tiếng Anh chất lượng cho từng ảnh → ghi `images-plan.json` cạnh .txt. **Bạn gen ảnh manual trên grok.com**, save vào input folder, sau đó `/create-video` sẽ tự stage.

**Khi nào dùng:**
- Sau `/read-rewrite` (đã chain tự động) hoặc `/refine-txt` (chạy thủ công).
- Trước `/create-video` — để có ảnh chất lượng cao thay vì AI fallback chung chung.
- Áp dụng cho mọi content type — kể cả bio / history.

**Cú pháp:**

```
/images-for-videos <path/to/source.txt>
```

**Workflow:**
1. Read .txt + count chars.
2. **Auto-split check:** nếu source ≥ 4 000 chars → split thành N phần (4–8k=2, 8–12k=3, 12–16k=4, ≥16k=5 cap). Cut tại paragraph/sentence boundary gần balanced nhất. Cho từng part, tạo folder con `video/input/<slug>-p1/`, `<slug>-p2/`, … mỗi cái chứa `.txt` của part + `images-plan.json` riêng. Source .txt gốc giữ nguyên. Skip nếu < 4 000 chars.
3. Classify content type (cho từng part nếu multi).
4. Đề xuất scene structure theo type.
5. Cho mỗi scene image-eligible (hook/callout/stat-hero), viết prompt:
   - **Style mặc định:** Vertical 9:16 football poster artwork (NOT cinematic press photo).
   - **Lean on names:** `"Lionel Messi, the Argentine forward for Argentina national team..."` — KHÔNG describe skin/hair/jaw.
   - **Iconography:** club crest watermark, light bursts, fan scarves, stadium silhouette.
   - **Avoid:** scoreboards, in-image text, broadcast graphics, weapons / flares / blood.
6. Ghi `images-plan.json`:
   ```json
   {
     "scenes": [
       {
         "id": "hook",
         "filename": "hook.jpg",
         "template": "hook",
         "prompt": "Vertical 9:16 football poster artwork featuring...",
         "subjectHint": "Hook ảnh"
       }
     ]
   }
   ```
5. In ra danh sách prompts cho bạn copy.

**Sau khi xong:**
- Mở grok.com (cần SuperGrok subscription).
- **Mở N tab song song** — sequential ~10–15 phút, parallel ~3–5 phút.
- Paste prompt vào mỗi tab, gen ảnh.
- Save mỗi ảnh vào `video/input/<slug>/<filename>` theo plan.
- Format: `.png` / `.jpg` / `.jpeg` / `.webp` đều OK.
- Chạy `/create-video <path.txt>` — verify ảnh tồn tại trước khi build.

**"Ảnh chế" / meme scenes:**
- Khi content có irony built-in (Pep cổ vũ West Ham, drama transfer, banter) — plan có 0–2 ảnh chế.
- Marker: `subjectHint: "Ảnh chế — ..."` trong plan.
- Cap: 2 ảnh chế / video, REPLACE 1 ảnh thường (không stack).

**Chuẩn ảnh chất lượng:**
- 1080×1920 portrait (9:16).
- Subject ở phần trên frame (để captions không che mặt).
- Sharp, không AI smoothness rõ.
- Club crest đúng team (Grok đôi khi crest sai — kiểm tra trước upload).

**Lưu ý:**
- Thiếu ảnh khi chạy /create-video → skill halt với danh sách missing. Gen tiếp + re-run.
- Plan có thể edit manually nếu prompt cần tweak.

---

### 4.4 /create-video — Build motion-graphic video

**Mục đích:** Skill chính build video 9:16 motion-graphic từ .txt source. Length tự scale theo content density (6–15 scenes, 45–180s).

**Khi nào dùng:**
- Mọi content type non-podcast — bao gồm bio + history (cùng pipeline AI image, không có /create-bio-video riêng nữa).
- Bio: treat milestones như từng scene độc lập (timeline + stat-hero + callout).

**Auto-split cho source dài (CHỈ bio / history):**
- Chính sách 2026-05-26: chỉ **BIO-PLAYER + HISTORY-CLUB/NATIONAL-TEAM/TOURNAMENT** được auto-split. Mọi type khác (RANKING/MATCH/TRANSFER/PREVIEW/TRIVIA/PROFILE/VS) → SINGLE long video bất kể độ dài source.
- Lý do: news/ranking/analysis là 1 lập luận liền mạch, split phá thesis. Bio/history phân chương tự nhiên theo era.
- Khi `/images-for-videos` classify thành BIO-* / HISTORY-* và source ≥ 4 000 chars → split N phần (4–8k=2, 8–12k=3, 12–16k=4, ≥16k=5 cap), tạo folder con `video/input/<slug>-p1/`, `<slug>-p2/`, …
- User chạy `/create-video` per part `.txt`. Mỗi part render thành 1 video riêng.
- `/create-video` tự detect: folder name match `<X>-pN/` + sibling `<X>-p(N+1)/` tồn tại → **non-final part**. Closing scenes đổi thành outro teaser duy nhất `"Phần <N+1> sắp lên sóng. Bấm theo dõi Sports For All Ti Vi để xem ngay khi ra mắt nhé."` thay engagement-question + outro chuẩn.
- Part cuối (không có sibling `-p(N+1)/`) hoặc single-video render → engagement-question + outro chuẩn như mọi script.
- URL bài báo dài (Goal/Sky/Vnexpress) → /read-rewrite → /images-for-videos → classify (RANKING/PROFILE/etc.) → KHÔNG split, làm 1 video dài duy nhất, lean upper-end density 11-15 scenes / 180s.

**Cú pháp:**

```
/create-video <path/to/source.txt>
```

**2 modes:**

| Mode | Trigger | Output dir | sceneIds | Images |
|---|---|---|---|---|
| **Plan mode** (khuyến nghị) | `images-plan.json` tồn tại cạnh .txt | `video/output/<slug>/` (no timestamp) | match plan's id | Pre-staged từ input folder |
| **Free-form mode** | Không có plan | `video/output/<slug>-<timestamp>/` | free choice | AI gen runtime (fallback gradient) |

**Workflow:**
1. Validate .txt + đọc full content.
2. Classify (nếu chưa có plan).
3. **Pre-flight density check:**
   - Count "distinct substantive points" — mỗi point là 1 fact/claim độc lập đáng 1 scene.
   - < 3 points → **bail.** Yêu cầu user bổ sung content.
   - 3–4 points → 6–8 scenes / 45–75s
   - 5–7 points → 8–11 scenes / 75–120s
   - 8+ points → 11–15 scenes / 120–180s
4. Restructure cho spoken video (1–2 câu/scene voiceText, phonetic rules apply).
5. Build hook scene đúng archetype (stat-shock / question / verdict / contradiction).
6. Body scenes theo content-type pattern.
7. **Engagement-question scene mandatory** (second-to-last).
8. Outro scene mandatory (last).
9. Self-validate: scene count + word count + duration in target band.
10. Write `script.json` vào output dir.
11. **Plan mode:** chạy `npm run images:stage -- <txt-path>` để copy ảnh manual từ input → output/images/.
12. Chạy `npm run pipeline -- <output>/script.json`:
    - Generate TTS (AusyncLab default).
    - Generate ảnh AI cho scene KHÔNG có ảnh staged.
    - Render từng scene HTML → image frame → ffmpeg compose.
    - Mux audio + transitions + SFX.
13. Output: `video.mp4` + `voice.mp3` + `script.json` + `script.txt` + `meta.json` + `hyperframes.json`.

**Expected latency:**
- TTS: 30–60s
- Image gen: 30–90s (parallel) — nếu plan mode + stage thì 0s
- Render: 3–5 phút cho 60–90s video

**Templates chính:**

| Template | Dùng cho | Field chính |
|---|---|---|
| `hook` | Scene 1, opener | `headline`, `subhead`, `bigStat`, `kenBurns` |
| `stat-hero` | Big number / key stat / per-rank item | `value`, `label`, `context`, `highlights[]` |
| `callout` | Money line / verdict / insight | `statement`, `tag` |
| `comparison` | VS scenes | `left{label,value,color}`, `right{label,value,color,winner}` |
| `feature-list` | 1–4 bulleted items | `title`, `bullets[]` |
| `formation-pitch` | Lineup / squad reveal | `formation`, `rows[][]` |
| `timeline` | 3–5 milestones year+event | `title`, `items[{year,event}]` |
| `big-quote` | Pull quote ≤200 chars | `quote`, `attribution` |
| `engagement-question` | Second-to-last scene | `question`, `cta`, `tag` |
| `outro` | Last scene | `ctaTop`, `channelName`, `source` |

Chi tiết field caps + line break rules: `.claude/skills/create-video/SKILL.md` section "Typography rules".

**Ví dụ output:**

```
✓ Video:  video/output/messi-record-2026/video.mp4
✓ Audio:  video/output/messi-record-2026/voice.mp3 — cho CapCut
✓ Script: video/output/messi-record-2026/script.txt — cho CapCut auto-caption
Tổng thời lượng: 87.3s
```

**Idempotency:**
- Re-chạy không xóa output trước; ghi đè files.
- Force fresh: `rm -rf video/output/<slug>/` rồi re-run.

---

### 4.5 /video-queue — Batch Excel queue

**Mục đích:** Xử lý batch nhiều video sources cùng lúc qua Excel queue. Mirrors `/podcast-queue` nhưng cho motion-graphic pipeline. **2-pass** vì có bottleneck gen ảnh manual ở giữa.

**Khi nào dùng:**
- Có 2+ video sources muốn render trong session.
- Muốn worksheet track stage (pending → planned → done) của từng source.

**Cú pháp:**

```
/video-queue
```

Hoặc trực tiếp xlsx helper:

```bash
npm run video-queue --silent -- list
npm run video-queue --silent -- set <rowIdx> <key>=<value>
```

**File queue:** `video/input/queue.xlsx` (auto-create rỗng nếu chưa có).

> 📖 **Hướng dẫn điền chi tiết từng cột + 4 pattern điển hình + helper CLI + Q&A:** xem [`video/input/queue-guide.md`](video/input/queue-guide.md) (đặt cạnh xlsx để mở Excel xong thấy ngay).

**Schema cột:**

| Column | Required | Purpose |
|---|---|---|
| `source` | YES | Path tới base .txt (`video/input/<slug>/<slug>.txt`) — KHÔNG paste part .txt; queue tự fan-out parts |
| `refine` | optional | `yes` / `no` / empty (=no). Nếu `yes` → chạy /refine-txt trước khi plan |
| `title` | optional | Override title. Empty = derive từ .txt title line |
| `notes` | optional | User notes free-text. Queue ignore — chỉ để user tự tổ chức |
| `status` | output | `pending` (empty) / `planned` / `done` / `error` |
| `result` | output | Per-part mp4 paths joined `; ` (multi-part) hoặc single path |
| `error` | output | Error message nếu fail |

**Status flow:**

```
pending  → row chưa xử lý
planned  → /refine + /images-for-videos xong. Chờ user gen ảnh.
done     → /create-video xong, mọi part mp4 ở result column
error    → fail ở step nào đó
```

**Workflow (2-pass, user chạy /video-queue 2 lần):**

```
[Pass 1 — prep + plan]
1. User add rows vào queue.xlsx (chỉ điền source, optionally refine/title/notes).
2. Chạy /video-queue.
3. Per pending row, queue chạy:
   - /refine-txt (nếu refine=yes)
   - /images-for-videos → auto-split nếu ≥4 000 chars
   - Set status=planned
   - Print list folder cần gen ảnh
4. Queue dừng. User mở grok.com, gen ảnh per part folder.

[Pass 2 — render]
5. User chạy /video-queue lần nữa.
6. Per planned row, queue:
   - Verify mọi planned image tồn tại
   - Thiếu ảnh? → giữ planned, list missing, skip row
   - Đủ ảnh? → /create-video per part .txt (multi-part fan out)
   - Set status=done, result=<paths joined `; `>
7. Done rows skip. Tiếp tục cho tới khi mọi row done hoặc cần ảnh.
```

**Multi-part handling:**
- 1 row = 1 source = 1-5 outputs (tùy auto-split).
- `result` column gom tất cả part mp4 paths joined `; `.
- Status row chỉ = `done` khi toàn bộ part render xong.
- Một part fail → status=error, result=<succeeded paths>, error=<msg part fail>.

**Retry workflow:**

| Tình huống | Fix |
|---|---|
| Row error → muốn retry | Clear `status` + `error` cell, chạy /video-queue lại |
| Done row muốn re-render | Clear `status` cell |
| Muốn re-plan (re-split): | Xóa các folder `<slug>-pN/` (giữ source .txt gốc), clear status, /video-queue lại |

**Ví dụ workflow:**

```bash
# 1. Viết bio scripts:
$EDITOR video/input/modric-bio/modric-bio.txt    # ~9 000 chars
$EDITOR video/input/top10-trivia/top10-trivia.txt # ~2 800 chars
$EDITOR video/input/messi-vs-ronaldo/messi-vs-ronaldo.txt # ~3 500 chars

# 2. Open queue.xlsx, add rows:
#    Row 2: source=video/input/modric-bio/modric-bio.txt, refine=yes
#    Row 3: source=video/input/top10-trivia/top10-trivia.txt
#    Row 4: source=video/input/messi-vs-ronaldo/messi-vs-ronaldo.txt

# 3. /video-queue (Pass 1)
#    → Row 2: refined + split 3 parts (modric-bio-p1/p2/p3)
#    → Row 3: single plan, 8 ảnh
#    → Row 4: single plan, 5 ảnh
#    → Tất cả status=planned

# 4. Mở grok.com, gen ảnh cho 5 folder (3 part Modric + top10 + Messi-vs-Ronaldo)

# 5. /video-queue (Pass 2)
#    → Row 2: render 3 parts → result="modric-bio-p1/video.mp4; modric-bio-p2/video.mp4; modric-bio-p3/video.mp4"
#    → Row 3: render → result="top10-trivia/video.mp4"
#    → Row 4: render → result="messi-vs-ronaldo/video.mp4"
#    → Tất cả status=done
```

---

### 4.6 /classify-football-content — Diagnostic

**Mục đích:** Phân loại 1 .txt vào 11 content types và đề xuất scene structure, KHÔNG generate video.

**Khi nào dùng:**
- Preview structure trước khi commit `/create-video`.
- Debug khi không chắc proposed shape.

**Cú pháp:**

```
/classify-football-content <path/to/source.txt>
```

**11 content types — tất cả render qua `/create-video`:**

| # | Type |
|---|---|
| 1 | RANKING |
| 2 | VS |
| 3 | MATCH ANALYSIS |
| 4 | PRE-MATCH PREVIEW |
| 5 | PLAYER PROFILE (stats deep-dive) |
| 6 | BIO-PLAYER (chronological career arc) |
| 6b | HISTORY-CLUB |
| 6c | HISTORY-NATIONAL-TEAM |
| 6d | HISTORY-TOURNAMENT |
| 7 | TRANSFER NEWS |
| 8 | TRIVIA |

**Output:** markdown report với type + confidence + proposed structure + suggested hook + notes.

---

## 5. Pipeline PODCAST

1 .txt prose + 1 (hoặc nhiều) video file thật → voice TTS phủ lên + karaoke caption burned-in. Không có motion-graphic templates — visual là footage thật.

### 5.1 /create-podcast — Build 1 clip podcast

**Cú pháp:**

```
/create-podcast <path/to/source.txt> [music-file]
```

**Input requirements:**

```
podcast/input/<slug>/
├── <slug>.txt          ← script prose
├── <slug>.mp4          ← background video #1 (bắt buộc; mov/webm/mkv/m4v cũng OK)
├── <slug>2.mp4         ← background video #2 (optional, nối khi #1 hết)
└── <slug>3.mp4         ← #3, ...
```

- Numbering: natural-sort (`<slug>10.mp4` sau `<slug>2.mp4`).
- Mọi sibling videos PHẢI cùng resolution + codec (concat demuxer không transcode).
- Re-encode nếu khác: `ffmpeg -i x.mov -c:v libx264 -c:a aac x.mp4`.
- Pipeline tự auto-normalize siblings off-spec vào `<slug>/.normalized/` (fixes black-frame bug từ concat demuxer mismatch).

**Arg 2 optional — music file:**
- `npm run podcast -- file.txt input2.m4a` → resolve `assets/beat/input2.m4a`.
- `npm run podcast -- file.txt C:/music/song.mp3` → absolute path OK.

**Workflow:**
1. Validate .txt + tìm sibling video(s).
2. Generate TTS voice (provider override via `PODCAST_TTS_PROVIDER`).
3. Run `align_worker.py` (faster-whisper) → per-word timestamps.
4. Build `captions.ass` — karaoke caption.
5. ffmpeg compose:
   - Concat all sibling videos (loop nếu TTS dài hơn).
   - Drop source audio.
   - 9:16 reformat theo layout:
     - **`fullbleed` (default):** source fill 1080×1920 cover-crop, corner-text trên-trái, lower-third caption.
     - **`card`:** 880×880 rounded card centered, brand wordmark trên, caption dưới.
     - **`vignette` (legacy):** blurred bg + sharp card + chrome.
     - **`landscape` (auto khi source 16:9):** 16:9 strip on black, caption inside strip.
   - Burn karaoke `captions.ass`.
   - Mux TTS audio + optional bg music.
6. Output: `podcast/output/<slug>/<slug>.mp4`.

**Idempotency:**
- `voice.mp3` re-used. Delete → force re-TTS.
- `words.json` re-used. Delete → force re-align.
- `captions.ass` always regenerated.
- Final mp4 always regenerated.

**Default quality (sau update 2026-05-25, gần lossless):**
- `PODCAST_CRF=18`
- `PODCAST_PRESET=slow`
- `PODCAST_LAYOUT=fullbleed`
- `PODCAST_FULLBLEED_DIM=0` (no dim overlay)
- `PODCAST_FPS=30`
- `PODCAST_OUTRO_ENABLED=false` + `PODCAST_TAIL_SEC=10`

Trade-off: file ~2× lớn hơn + render ~2× lâu hơn vs preset cũ.

**Tunable env quan trọng** (set trong `.env.local`):

| Env | Default | Effect |
|---|---|---|
| `PODCAST_TTS_PROVIDER` | (global) | Override TTS: `ausynclab` / `elevenlabs` / `vieneu` |
| `PODCAST_AUSYNCLAB_VOICE_ID` | (global voice) | Voice riêng cho podcast |
| `PODCAST_LAYOUT` | `fullbleed` | `card` / `vignette` / `fullbleed` |
| `PODCAST_LAYOUT_MODE` | `auto` | `auto` / `landscape` / `portrait` |
| `PODCAST_CAPTION_MODE` | `sentence` | `sentence` (full current sentence) / `word` (3-word sliding) / `chunks` |
| `PODCAST_TAIL_SEC` | `10` | Giây video tail sau voice |
| `PODCAST_BG_MUSIC` | (auto detect) | Path nhạc nền; empty = disable |
| `PODCAST_BG_MUSIC_VOLUME` | `1.0` | 0..2 (0.15 = whisper, 1.0 = rival voice) |

Full list: section 8.

---

### 5.2 /podcast-queue — Batch Excel queue

**Mục đích:** Xử lý nhiều podcast rows cùng lúc qua Excel queue. User viết .txt vào `story/`, paste path vào xlsx, script tự pick video từ concept folders, render, ghi status.

**Cú pháp:**

```
/podcast-queue
```

Hoặc trực tiếp:

```bash
npm run podcast-queue
```

**Concept model (flat folder = concept):**

```
podcast/input/
├── story/              ← podcast .txt scripts (reserved folder name)
│   ├── neymar-quote.txt
│   └── deep-thought.txt
├── football/           ← concept: football
│   └── *.mp4
├── naruto/             ← concept: naruto
├── world/              ← concept: world (scenery, city, culture)
├── neymar/             ← concept: neymar (player-specific)
└── queue.xlsx
```

Folder name = concept name. Tự tạo bao nhiêu concept tùy ý (chỉ `story/` reserved).

**File queue:** `podcast/input/queue.xlsx`

| Column | Required | Purpose |
|---|---|---|
| `story` | YES | Path tới .txt under `podcast/input/story/` |
| `concept` | optional | Folder name. Empty / `random` → uniform pick across non-empty concepts |
| `orientation` | optional | `landscape` / `portrait` / empty/`auto` (ffprobe-detect) |
| `videos` | optional + output | Manual playlist override; hoặc auto-filled sau khi run |
| `status` | output | `Done` / `Error` |
| `result` | output | Output path hoặc error message |

**Row pending:** `story` set + `status` rỗng.

**Workflow per row:**
1. Resolve story .txt path.
2. Parse concept → folder.
3. Estimate TTS duration (~12 chars/sec, safety 1.1) + tail buffer (`PODCAST_TAIL_SEC`).
4. Pick videos random từ concept folder **không lặp trong cùng row**, cumulative duration ≥ target. Cap 50 clips/row. ffprobe orientation filter.
5. **No-repeat tracker 2 tầng:**
   - **Per-row:** trong cùng 1 row không pick lại video.
   - **Cross-row (batch-scoped):** videos đã dùng row trước cũng skip row sau trong cùng invocation.
6. Materialize workdir `podcast/_runs/<slug>/`: copy .txt + hardlink picked videos → `<slug>.ext`, `<slug>2.ext`, …
7. Run `npm run podcast` per row.
8. Verify `podcast/output/<slug>/<slug>.mp4` exists.
9. Write status + result + videos vào row, save xlsx (crash-safe per row).

**Ví dụ pick logic:**
- Voice estimate 90s, tail 10s → target = 90 × 1.1 + 10 = 109s.
- Library 8 clips: [25, 30, 15, 40, 20, 35, 18, 22]s.
- Picker (shuffle): A(25) → 25, B(30) → 55, C(15) → 70, D(40) → 110. Đạt target → stop.
- 4 clips unique, không lặp trong row.

**Manual override `videos` column:**
- Non-empty trước khi run → treat as explicit playlist (split `;`/`,`/newline). Skip random picker + ignore concept.
- Use case: re-run với videos cũ; hand-curate clip combo.
- Force fresh random pick on retry: clear BOTH `status` AND `videos`.

**Orientation behavior:**

| `orientation` | Pick behavior | Pipeline layout |
|---|---|---|
| empty / `auto` | Any | ffprobe auto |
| `landscape` / `16:9` / `horizontal` | Chỉ 16:9 | Force landscape |
| `portrait` / `9:16` / `vertical` | Chỉ 9:16 | Force portrait |

**Chỉ chạy 1 row cụ thể:** clear `status` chỉ row đó; các row khác giữ status sẽ skip.

---

## 6. Pipeline MUSIC VIDEO

**Mục đích:** Build clip music TikTok 9:16: 1 song .mp3 + 1 background video → mux song thay audio gốc, karaoke caption lyric burn-in.

**Khi nào dùng:**
- Cover song, lyric video, music share.
- KHÁC `/create-podcast`: dùng song audio user-supplied (không TTS), align lyric đã có sẵn.

**Cú pháp:**

```
/create-music-video <path-to-input-dir>
```

**Input requirements:**

```
input/<slug>/
├── song.mp3            ← song audio
├── background.mp4      ← background video
└── lyrics.txt          ← timed or untimed lyrics
```

**Workflow:**
1. Load song + background + lyrics.
2. Mux song vào background (drop original audio).
3. Reformat background 9:16 với blurred bg fit nếu source khác aspect.
4. Align lyrics → per-word timestamps (Whisper hoặc dùng timed manually).
5. Burn karaoke caption (active word highlight).

**Detailed spec:** `.claude/skills/create-music-video/SKILL.md`.

---

## 7. Workflows điển hình từ A-Z

### 7.1 Tin tức nhanh từ URL bài báo

```
1. Lấy URL: vd https://www.goal.com/vn/news/some-news/abc123

2. /read-rewrite <url>
   → tạo video/input/<slug>/<slug>.txt
   → tự chain /images-for-videos → images-plan.json
   → in ra 5-8 prompts ảnh

3. Mở grok.com, mở 5-8 tab song song, paste 1 prompt/tab, gen ảnh
   → save vào video/input/<slug>/ với filename theo plan
   (.png/.jpg/.jpeg/.webp đều OK)

4. /create-video video/input/<slug>/<slug>.txt
   → halt nếu thiếu ảnh (báo list missing)
   → render TTS + pipeline + mp4
   → output: video/output/<slug>/video.mp4

5. Upload lên TikTok/Reels/FB
```

Thời gian tổng: 15–25 phút (gen ảnh là bottleneck).

---

### 7.2 Refine ghi chú thô thành video

```
1. Paste ghi chú vào file:
   $EDITOR video/input/bruno-19-kien-tao/bruno-19-kien-tao.txt

2. /refine-txt video/input/bruno-19-kien-tao/bruno-19-kien-tao.txt
   → backup raw + polish thành structured channel-voice

3. /images-for-videos video/input/bruno-19-kien-tao/bruno-19-kien-tao.txt
   → tạo images-plan.json + danh sách prompts

4. Mở grok.com → gen song song → save filename theo plan

5. /create-video video/input/bruno-19-kien-tao/bruno-19-kien-tao.txt
   → render mp4
```

---

### 7.3 Bio cầu thủ / Lịch sử CLB (có auto-split nếu dài)

```
1. Viết bio .txt vào video/input/modric-bio/modric-bio.txt
   (tự viết tay vì hiếm có URL bài báo bio full)

2. (Optional) /refine-txt nếu notes thô

3. /images-for-videos video/input/modric-bio/modric-bio.txt
   ┌── Source < 4 000 chars → single plan tại folder gốc → bước 4
   └── Source ≥ 4 000 chars → AUTO-SPLIT:
       → tạo video/input/modric-bio-p1/modric-bio-p1.txt + images-plan.json
       → tạo video/input/modric-bio-p2/modric-bio-p2.txt + images-plan.json
       → (... tùy char count, max 5 part)
       → .txt gốc tại modric-bio/ giữ nguyên làm source of truth

4. Gen ảnh grok.com song song (mở N tab cho từng prompt trong từng
   part folder), save theo filename plan của part đó.

5. Single-video: /create-video video/input/modric-bio/modric-bio.txt
   Multi-part:   /create-video video/input/modric-bio-p1/modric-bio-p1.txt
                 /create-video video/input/modric-bio-p2/modric-bio-p2.txt
                 ...
   → /create-video tự detect part-N pattern, non-final part dùng
     outro "Phần N+1 sắp lên sóng..." thay engagement+outro chuẩn.
   → Output: video/output/modric-bio-p1/video.mp4
            video/output/modric-bio-p2/video.mp4

6. Upload Part 1 trước, Part 2-N cách nhau 12-24h (TikTok algo
   thưởng watch-time + retention; series viral hơn single 3-min clip).
```

---

### 7.4 Batch motion-graphic videos qua /video-queue

```
[Pass 1 — prep + plan]
1. Soạn nhiều .txt sources:
   $EDITOR video/input/modric-bio/modric-bio.txt        # ~9k chars
   $EDITOR video/input/top10-trivia/top10-trivia.txt    # ~2.8k chars
   $EDITOR video/input/messi-vs-ronaldo/messi-vs-ronaldo.txt

2. Mở queue:
   $EDITOR video/input/queue.xlsx
   (auto-create rỗng nếu chưa có — chạy `npm run video-queue -- list` 1 lần)
   # Row 2: source=video/input/modric-bio/modric-bio.txt, refine=yes
   # Row 3: source=video/input/top10-trivia/top10-trivia.txt
   # Row 4: source=video/input/messi-vs-ronaldo/messi-vs-ronaldo.txt

3. /video-queue
   → Row 2: refined + auto-split 3 parts (modric-bio-p1/p2/p3)
   → Row 3: single plan, 8 ảnh
   → Row 4: single plan, 5 ảnh
   → Tất cả status=planned
   → Queue in ra list folder cần gen ảnh

[Manual]
4. Mở grok.com, mở N tab song song, gen ảnh cho từng folder
   (5 folder = 3 part Modric + top10 + Messi-vs-Ronaldo).
   Save filename theo plan trong từng folder.

[Pass 2 — render]
5. /video-queue (lần 2)
   → Row 2: render 3 parts (p1 + p2 non-final outro, p3 standard outro)
            result="video/output/modric-bio-p1/video.mp4; ...; .../modric-bio-p3/video.mp4"
   → Row 3: render single → result="video/output/top10-trivia/video.mp4"
   → Row 4: render single → result=".../messi-vs-ronaldo/video.mp4"
   → Tất cả status=done

6. Upload lần lượt. Part 1 trước, Part 2-3 cách nhau 12-24h cho bio Modric.
```

Nếu chỉ một part thiếu ảnh khi chạy Pass 2 → row đó vẫn `planned`, queue list missing files, các row khác vẫn render bình thường. Gen nốt rồi /video-queue lại.

---

### 7.5 Podcast clip nhanh (1-off)

```
1. Viết script podcast:
   $EDITOR podcast/input/neymar/neymar.txt

2. Drop 1 video file cạnh .txt:
   cp ~/Downloads/some-video.mp4 podcast/input/neymar/neymar.mp4
   (mp4/mov/webm/mkv/m4v đều OK)

3. /create-podcast podcast/input/neymar/neymar.txt
   → output: podcast/output/neymar/neymar.mp4

Done. ~3-5 phút cho 60-90s clip.
```

---

### 7.6 Batch podcast với concept folders

```
1. Viết nhiều scripts vào /story:
   $EDITOR podcast/input/story/script1.txt
   $EDITOR podcast/input/story/script2.txt
   $EDITOR podcast/input/story/script3.txt

2. Đảm bảo có concept folders với videos:
   ls podcast/input/football/        # → có *.mp4
   ls podcast/input/world/
   ls podcast/input/neymar/

3. Mở queue:
   $EDITOR podcast/input/queue.xlsx
   # Row 2: story=podcast/input/story/script1.txt, concept=football
   # Row 3: story=podcast/input/story/script2.txt, concept=world
   # Row 4: story=podcast/input/story/script3.txt, concept=neymar, orientation=landscape

4. npm run podcast-queue (hoặc /podcast-queue)
   → process tuần tự, save xlsx per row (crash-safe)
   → output ở podcast/output/<slug>/<slug>.mp4

5. Xem xlsx → upload các mp4 status=Done
```

---

## 8. Env variables

### 8.1 Pipeline chung

| Env | Default | Used by | Purpose |
|---|---|---|---|
| `TTS_PROVIDER` | `ausynclab` | All | Default TTS: `ausynclab` / `vieneu` |
| `AUSYNCLAB_API_KEY` | — | AusyncLab | API key (required) |
| `AUSYNCLAB_VOICE_ID` | `1914439` | /create-video | An Khôi default |
| `AUSYNCLAB_MODEL_NAME` | `myna-2` | /create-video | Model — prosody giàu |
| `VIENEU_PROJECT_DIR` | `../VieNeu-TTS` | All | Path tới VieNeu Python project |
| `TIKTOK_DISPLAY_NAME` | `SportsForAllTV` | All | Brand name trên outro card |
| `TIKTOK_HANDLE` | `@bonglan0702` | All | Handle |
| `TIKTOK_FOLLOWERS` | `1.2M followers` | All | Follower count display |

### 8.2 /create-video pipeline

| Env | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | Fallback image gen |
| `GEMINI_API_KEY` | — | Fallback image gen |
| `XAI_API_KEY` | — | Fallback image gen (Grok API) |
| `IMAGE_PROVIDER` | `xai` | Provider cho scene không có manual override |

### 8.3 /create-podcast pipeline

**TTS + voice:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_TTS_PROVIDER` | (global) | Override TTS chỉ cho podcast |
| `PODCAST_AUSYNCLAB_VOICE_ID` | (global) | Voice riêng |
| `PODCAST_AUSYNCLAB_MODEL_NAME` | `myna-1-turbo` | Model riêng |
| `ELEVENLABS_API_KEY` | — | Nếu dùng ElevenLabs |
| `ELEVENLABS_VOICE_ID` | — | Voice ID |
| `ELEVENLABS_MODEL` | `eleven_multilingual_v2` | Model |
| `ELEVENLABS_STABILITY` | `0.5` | 0..1 expressive vs monotone |
| `ELEVENLABS_SIMILARITY_BOOST` | `0.75` | 0..1 match source voice |
| `ELEVENLABS_STYLE` | `0.0` | 0..1 dramatic |
| `PODCAST_ALIGN_LANG` | `vi` | Whisper language |
| `PODCAST_ALIGN_MODEL` | `small` | `small` / `medium` (better diacritic, 3× compute) |

**Layout + caption:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_LAYOUT` | `fullbleed` | `card` / `vignette` / `fullbleed` |
| `PODCAST_LAYOUT_MODE` | `auto` | `auto` / `landscape` / `portrait` |
| `PODCAST_CAPTION_MODE` | `sentence` | `sentence` / `word` / `chunks` |
| `PODCAST_CAPTION_FONT` | `Segoe UI` | Font family |
| `PODCAST_CAPTION_FONTSIZE` | auto | px |
| `PODCAST_CAPTION_MAX_WORDS` | `8` | Cap words/caption |
| `PODCAST_CAPTION_MAX_CHARS` | `30` | Cap chars (sentence/word mode) |
| `PODCAST_CAPTION_MAX_CHARS_CHUNKS` | `22` | Cap chars (chunks mode) |
| `PODCAST_CAPTION_Y` | auto | Vertical position fraction |
| `PODCAST_CAPTION_SAFE_MARGIN` | `80` | Horizontal safe margin px |

**Fullbleed-specific:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_FULLBLEED_DIM` | `0` | Opacity dim overlay (0..1). 0 = no dim |
| `PODCAST_FULLBLEED_CORNER_TEXT` | `Podcast và bạn` | Top-left corner text |
| `PODCAST_FULLBLEED_CORNER_FONTSIZE` | `48` | px |

**Card-specific:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_CORNER_RADIUS` | `40` | Card corner radius |
| `PODCAST_CARD_STROKE` | `4` | Outline width |
| `PODCAST_FG_WIDTH` | `880` | Card width |
| `PODCAST_FG_HEIGHT` | `880` | Card height |
| `PODCAST_FG_Y` | `520` | Card top Y |
| `PODCAST_FG_X` | auto-center | Card left X |

**Landscape-specific:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_LANDSCAPE_VBIAS` | `-80` | Strip vertical offset px |

**Brand shell:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_LOGO` | `assets/logoPodcast.png` | Logo path (empty = disable) |
| `PODCAST_LOGO_WIDTH` | `120` | px |
| `PODCAST_LOGO_MARGIN` | `60` | px from top+left |
| `PODCAST_BRAND_NAME` | `SportsForAllPodcast` | Wordmark text |
| `PODCAST_BRAND_TAG` | `PODCAST` | Tag below wordmark |
| `PODCAST_BRAND_WORDMARK` | true | Toggle wordmark vs legacy logo-text shell |

**Background music:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_BG_MUSIC` | auto | Path. Empty = disable |
| `PODCAST_BG_MUSIC_VOLUME` | `1.0` | 0..2 |

**Tail + outro:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_TAIL_SEC` | `10` | Giây video tail sau voice |
| `PODCAST_OUTRO_ENABLED` | `false` | Toggle outro card |
| `PODCAST_OUTRO_SEC` | `5` | Outro card duration |
| `PODCAST_OUTRO_TEXT` | `Theo dõi Sports For All Ti Vi...` | Outro TTS line |
| `PODCAST_OUTRO_HANDLE` | `@bonglan0702` | Channel handle |
| `PODCAST_OUTRO_FOLLOWERS` | `1.2M followers` | Follower display |
| `PODCAST_OUTRO_CTA` | `Theo dõi ngay` | CTA button label |
| `PODCAST_OUTRO_SOURCE` | `Sưu tầm` | Source attribution |

**Encoding:**

| Env | Default | Purpose |
|---|---|---|
| `PODCAST_FPS` | `30` | Frame rate |
| `PODCAST_CRF` | `18` | x264 quality (lower = better) |
| `PODCAST_PRESET` | `slow` | x264 preset |
| `PODCAST_OUTPUT_DIR` | auto | Override output base dir |

---

## 9. Troubleshooting

### 9.1 Pipeline errors

**"No sibling video found" (/create-podcast)**
- .txt tồn tại nhưng không có `<slug>.{mp4,...}` cạnh nó.
- **Fix:** copy 1 video vào đúng folder với tên đúng.

**"Unsafe file name" / concat demuxer mismatch (/create-podcast)**
- Sibling videos khác resolution/codec.
- **Fix:** re-encode cùng format: `ffmpeg -i x.mov -c:v libx264 -c:a aac x.mp4`. (Hoặc dùng auto-normalize — pipeline tự re-encode siblings off-spec vào `.normalized/`.)

**"Background music file not found"**
- Path `PODCAST_BG_MUSIC` hoặc CLI arg 2 không tồn tại.
- **Fix:** verify path, hoặc set `PODCAST_BG_MUSIC=` (empty) để disable.

**"faster-whisper not installed"**
- VieNeu env thiếu faster-whisper.
- **Fix:** `cd $VIENEU_PROJECT_DIR && uv add faster-whisper`.

**"VieNeu project dir not found"**
- `VIENEU_PROJECT_DIR` env trỏ sai.
- **Fix:** set absolute path tới VieNeu repo.

**Audio + caption misaligned**
- Whisper align không chính xác với cụm khó.
- **Fix:** thử `PODCAST_ALIGN_MODEL=medium` (chậm hơn 3× nhưng accuracy tốt hơn cho dấu VN).

**"Source quá thin" (/create-video)**
- < 3 substantive points trong source.
- **Fix:** thêm nội dung, hoặc viết .txt dài hơn. Đừng cố pad.

**Pipeline exits non-zero nhưng mp4 tồn tại (/create-podcast)**
- **Benign** — ffmpeg compose đôi khi exit 69 sau khi đã mux xong file.
- **Fix:** kiểm tra file mp4 tồn tại + size > 0; nếu OK thì coi là success.

**Karaoke caption overlap**
- Realigner output non-monotonic.
- **Fix:** safety-net `clampEventOverlaps` đã built-in. Vẫn xảy ra → delete `voice.mp3` + `words.json` rồi rerun để force re-TTS + re-align.

### 9.2 Voice issues

**Voice nuốt chữ cuối / đuôi từ quiet**
- AusyncLab tail consonants quiet — `dynaudnorm` per-scene đã built-in.
- **Fix:** verify env `PODCAST_AUSYNCLAB_DYNAUDNORM=true` (default).

**TTS đọc "năm" thành "lăm" (= 5)**
- Homophone collision: `bốn mươi năm` (40 years) → `"bốn mươi lăm"` (45).
- **Fix:** dùng digit form trong voiceText: `40 năm` không phải `bốn mươi năm`.

**VieNeu silence dài khi gặp cụm tiếng Anh dày**
- > 3 từ Anh liên tiếp triggers silence bug.
- **Fix:** VNify khi có alternative; tránh > 2 tên tây back-to-back.

**voiceText parse ambiguity**
- VD `dây chằng đầu gối phải đứt` → parse: knee MUST tear thay vì right-knee tore.
- **Fix:** thêm qualifier hoặc dùng `bị`: `bị đứt dây chằng đầu gối bên phải`.

### 9.3 Visual / render issues

**Video chất lượng giảm so với source**
- Default 2026-05-25: CRF 18 + slow preset + fullbleed + dim 0.
- **Cao hơn:** edit `src/podcast/pipeline.ts` defaults hoặc set `PODCAST_CRF=16 PODCAST_PRESET=slower`.
- CRF 16 trở xuống = visually lossless nhưng file 2–3× lớn hơn nữa.

**Source 16:9 bị crop nặng trong card layout**
- Card layout crop về 880×880 vuông.
- **Fix:** dùng fullbleed (default mới) — source fill toàn 1080×1920.

**Caption che mặt subject**
- Fullbleed caption ở lower-third (~75% height từ trên).
- **Fix 1:** crop source để subject ở phần trên frame.
- **Fix 2:** set `PODCAST_CAPTION_Y=0.85` để caption sát đáy hơn.

**Render quá chậm**
- Default preset `slow` = ~2× medium.
- **Fix:** `PODCAST_PRESET=fast` halves render time (file lớn hơn ~30%).

### 9.4 Image gen issues

**Grok render face sai**
- Prompt thiếu name+club+nation anchor.
- **Fix:** lead prompt với `"<Full Name>, the <Nationality> <position> for <Club> and the <National Team>"`.

**Grok render quá photo-real (không poster)**
- Default style là football poster artwork.
- **Fix:** prepend `"in the style of a stylized vector-illustration sports poster"` hoặc `"EA Sports FIFA cover art style"`.

**Ảnh moderation fail (TikTok/FB)**
- Flares, smoke bombs, weapons, blood trong ảnh.
- **Fix:** grep prompts trước khi render: `grep -E "flare|smoke|weapon|blood" video/input/<slug>/images-plan.json`. Loại bỏ.

---

## 10. Tips chất lượng

### 10.1 Voice (TTS)

- **AusyncLab** = paid quality, recommended cho all skills.
- Speed default = 1.0–1.15 cho news; slower 1.0 cho bio/history storytelling tone.
- Voice 1914439 (An Khôi) = default kênh cho /create-video.
- Voice 1915475 = thử cho podcast.
- Phonetic rules — xem `.claude/skills/create-video/SKILL.md` section "Vietnamese TTS Phonetic Rules".

### 10.2 Hook video (quyết định swipe-or-stay)

- 2 giây đầu QUYẾT ĐỊNH swipe-or-stay.
- Hook archetype: **stat-shock** / **question** / **verdict** / **contradiction**.
- `bigStat` field (≤8 chars) cho stat-shock — giant neon-yellow text trên hook scene.
- `kenBurns="impact-zoom"` default (kinetic motion), KHÔNG `"zoom-in"` slow.
- Hook word phải ở 8 từ đầu của voiceText.
- Avoid openers: `"Hành trình..."`, `"Trước ngày..."`, `"Trong bối cảnh..."`.

### 10.3 On-screen reading discipline

- "Sound-off test": sound-off viewer hiểu scene point trong 2 giây?
- Surface load-bearing item (number/name/claim) vào field prominent (`value` / `headline` / `statement`).
- COMPRESS, không repeat voiceText vào templateData.
- `highlights` field (1–4 bullets ≤20 chars) là workhorse cho stat-hero.

### 10.4 Typography

- VN sentence case (chỉ first letter), NOT Title Case.
- STRIP foreign-name diacritics: `Mbappe` not `Mbappé`, `Vinicius Junior` not `Vinícius Júnior`.
- KEEP Vietnamese diacritics always: `Đặng Văn Lâm`, `Hà Nội`.
- Em dash `—` BAN trên screen (long bar at large fonts); dùng `·` hoặc `:`.
- Arabic digits on screen, spelled-out in voice (trừ digit-form rule cho whole numbers).

### 10.5 Image quality

- 1080×1920 portrait, sharp, no AI smoothness.
- Lead prompt với name+club+nation, KHÔNG describe face features.
- Iconography stays: crest, scarves, tifo, stadium silhouettes.
- AVOID: scoreboards, in-image text, broadcast graphics, weapons/flares/blood.

---

## 11. Channel context + brand

### 11.1 Brand identity

- **Channel name display:** `SportsForAllTV` (CamelCase, no dấu)
- **Handle:** `@bonglan0702`
- **Brand TTS:** `"Sports For All Ti Vi"` (3 words separated; `TV` → `Ti Vi`)
- **Renamed:** Bóng lăn → SportsForAllTV (2026-05-12)
- **Default channel for all skills:** SportsForAllTV (cũng có SportsForAllPodcast variant cho /create-podcast)

### 11.2 Content focus + pivot history

- **Original:** news rewrite từ Goal.com / VnExpress thể thao.
- **Pivot 2026-05-22:** evergreen content (history, what-if, stat-deep-dive) để tránh cạnh tranh fast-news + ngại ghi giọng.
- **Workflow consolidation 2026-05-25:** bỏ skill `/create-bio-video` riêng — bio/history dùng chung `/create-video` với AI poster image (tìm clip thật cho từng chương khó hơn nhiều so với gen 1 ảnh).

### 11.3 Voice tone tổng quát

- **News / analysis:** journalistic, active voice, specific > generic, attribution rõ.
- **Bio / history:** journalistic narrative — past tense cho milestones, present tense cho legacy framing; year/age/place openers (`"Mùa hè năm 1991..."`, `"Mười sáu tuổi..."`); vẫn 1–2 câu/scene cho motion-graphic pace.
- **Tránh:** `"Có thể nói rằng..."`, `"Đáng chú ý là..."`, `"Tuyệt vời"` alone, em dash quá nhiều.
- **Dùng:** `"chọc khe"`, `"lừa hướng"`, `"nhạc trưởng"`, `"pha kiến tạo cơ hội"`, nickname club (Quỷ Đỏ / Pháo Thủ / Lữ đoàn đỏ / Hùm xám / Vua trắng / Á thánh).

### 11.4 Engagement convention

- Mọi /create-video script kết thúc bằng `engagement-question` scene TRƯỚC `outro`.
- Pattern: `"Theo bạn, ai/đâu/X hay Y?"` + CTA bình luận.
- Boost comment signal cho TikTok/YT Shorts algorithm.

### 11.5 Outro convention

- Brand card với CTA `"Theo dõi ngay"`, channel `"SportsForAllTV"`, source `"Sưu tầm"`.
- /create-podcast: outro card tắt mặc định (`PODCAST_OUTRO_ENABLED=false`), thay bằng 10s tail video sau voice.

---

## Phụ lục A — npm scripts

| Script | Purpose |
|---|---|
| `npm run typecheck` | TypeScript compile check |
| `npm run test` | Vitest test suite |
| `npm run pipeline -- <script.json>` | Run /create-video pipeline |
| `npm run podcast -- <txt> [music]` | Run /create-podcast pipeline |
| `npm run music -- <input-dir>` | Run /create-music-video pipeline |
| `npm run rerender` | Re-render existing output |
| `npm run images:list` | List image prompts từ script.json |
| `npm run images:stage -- <txt>` | Stage planned images từ input → output |
| `npm run podcast-queue` | Run batch podcast queue |
| `npm run video-queue -- list` | List rows in `video/input/queue.xlsx` (JSON) |
| `npm run video-queue -- set <rowIdx> <k>=<v>` | Update row (writable: status / result / error) |

## Phụ lục B — Slash commands

| Skill | Purpose |
|---|---|
| `/read-rewrite <url>` | URL → .txt + images-plan.json (tự chain) |
| `/refine-txt <path.txt>` | Polish ghi chú thô → clean .txt in-place |
| `/images-for-videos <path.txt>` | Tạo images-plan.json + prompts |
| `/create-video <path.txt>` | Build motion-graphic video (mọi content type non-podcast) |
| `/video-queue` | Run Excel queue cho motion-graphic batch (2-pass) |
| `/create-podcast <path.txt> [music]` | Build 1 clip podcast |
| `/podcast-queue` | Run Excel queue cho podcast batch |
| `/create-music-video <input-dir>` | Build music video |
| `/classify-football-content <path.txt>` | Diagnostic classify content type |

## Phụ lục C — Folder cheat sheet

| Folder | Purpose |
|---|---|
| `video/input/<slug>/<slug>.txt` | Source .txt cho motion-graphic (mọi content type) — source of truth, giữ nguyên khi auto-split |
| `video/input/<slug>/images-plan.json` | Image plan (sau /images-for-videos), single-video case |
| `video/input/<slug>/*.{png,jpg,jpeg,webp}` | Manual-gen images (sau Grok) |
| `video/input/<slug>-p<N>/<slug>-p<N>.txt` | Part-N .txt sau auto-split (≥4 000 chars source) |
| `video/input/<slug>-p<N>/images-plan.json` | Part-N image plan |
| `video/output/<slug>/` | Output motion-graphic single-video (video.mp4 + voice.mp3 + script.json + …) |
| `video/output/<slug>-p<N>/` | Output motion-graphic part-N |
| `video/input/queue.xlsx` | Queue cho /video-queue (motion-graphic batch) |
| `podcast/input/story/*.txt` | Scripts cho /podcast-queue (reserved name) |
| `podcast/input/<slug>/<slug>.txt` | Source .txt cho 1-off /create-podcast |
| `podcast/input/<slug>/<slug>.mp4` | Sibling video cho 1-off /create-podcast |
| `podcast/input/<concept>/*.mp4` | Concept library cho /podcast-queue |
| `podcast/input/queue.xlsx` | Queue cho /podcast-queue |
| `podcast/_runs/<slug>/` | Workdir cho /podcast-queue (script managed) |
| `podcast/output/<slug>/<slug>.mp4` | Output podcast |
| `assets/beat/` | Background music files |
| `assets/sfx/` | SFX library |

---

**Cập nhật cuối:** 2026-05-25  
**Phiên bản:** consolidated — bỏ /create-bio-video + /bio-queue (bio/history nay dùng /create-video); max-quality defaults cho podcast (CRF 18, preset slow, fullbleed, dim 0).
