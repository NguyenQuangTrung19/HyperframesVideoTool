# Hướng dẫn sử dụng — Auto-Create-Video

Tài liệu này dẫn bạn từ chưa cài gì → render được video đầu tiên → nắm được toàn bộ command có thể chạy.

> **Quy ước đường dẫn**
> - `<slug>` — tên ngắn, lowercase, định danh 1 nội dung (vd `top7CBsITW`, `bayern-psg-2legs`)
> - `<txt-path>` — đường dẫn file `.txt` nguồn (vd `input/top7CBsITW/top7CBsITW.txt`)
> - `<outputDir>` — thư mục video đầu ra (vd `output/top7CBsITW/`)

---

## Mục lục

- [1. Setup — cài đặt từ đầu](#1-setup--cài-đặt-từ-đầu)
- [2. Quick start — video đầu tiên trong 10 phút](#2-quick-start--video-đầu-tiên-trong-10-phút)
- [3. Slash command (Claude Code skill)](#3-slash-command-claude-code-skill)
- [4. npm script](#4-npm-script)
- [5. Workflow theo tình huống](#5-workflow-theo-tình-huống)
- [6. Cấu trúc thư mục](#6-cấu-trúc-thư-mục)
- [7. Troubleshooting](#7-troubleshooting)
- [Tham khảo nhanh](#tham-khảo-nhanh)

---

## 1. Setup — cài đặt từ đầu

Phần này giả định bạn chưa có gì trên máy. Lệnh viết cho **Windows + PowerShell** (Mac/Linux gần giống — đổi installer ở từng bước).

### 1.1 Cài tool nền (one-time)

| Tool | Mục đích | Lệnh cài (Windows) |
|---|---|---|
| **Node.js ≥ 22** | Chạy pipeline TS | `winget install OpenJS.NodeJS.LTS` (hoặc tải [nodejs.org](https://nodejs.org)) |
| **Git** | Clone repo | `winget install Git.Git` |
| **FFmpeg + ffprobe** | Mix audio, encode video | `winget install Gyan.FFmpeg` |
| **uv** (Python pkg mgr) | Chạy VieNeu-TTS | `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"` |
| **Claude Code CLI** | Chạy slash command | `npm install -g @anthropic-ai/claude-code` |

> **Mac/Linux:**
> - FFmpeg: `brew install ffmpeg` (Mac) hoặc `sudo apt install ffmpeg` (Ubuntu/Debian)
> - uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`

**Verify:** mở terminal mới, chạy:
```powershell
node --version       # >= v22
ffmpeg -version      # bất kỳ
uv --version         # >= 0.5
git --version        # bất kỳ
```

### 1.2 Clone Auto-Create-Video

```powershell
# Đặt vào nơi bạn muốn (vd Workspace\Projects)
cd C:\Users\$env:USERNAME\Documents\Workspace\Projects
git clone https://github.com/hoquanghai/Auto-Create-Video.git
cd Auto-Create-Video
npm install
```

### 1.3 Cài VieNeu-TTS (TTS local mặc định, free)

VieNeu là một repo Python riêng — clone **cùng cấp với Auto-Create-Video** để pipeline tự tìm thấy:

```powershell
cd ..
git clone https://github.com/pnnbao97/VieNeu-TTS.git
cd VieNeu-TTS

# Sync dependencies (lần đầu mất ~2-4 phút, tải ~600MB)
uv sync

# Windows: cài thêm llama-cpp-python pre-built wheel để bật Standard CPU mode
# (Linux/Mac có thể bỏ qua — uv sync tự build)
uv pip install llama-cpp-python --extra-index-url `
  https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
```

**Verify VieNeu chạy được:**
```powershell
echo '{"op":"synth","text":"Xin chào.","outPath":"test.wav"}' | `
  uv run python ..\Auto-Create-Video\scripts\vieneu_worker.py Binh natural

# Output mong đợi: 3 dòng JSON
# {"status": "loading", ...}
# {"status": "ready"}
# {"status": "ok", "outPath": "test.wav"}
# (file test.wav sẽ được tạo ~150-300KB)
```

Lần đầu sẽ tải model GGUF (~300MB) từ HuggingFace — chỉ tải 1 lần, cache vào `~/.cache/huggingface/`.

### 1.4 Cấu hình `.env.local`

Quay lại Auto-Create-Video và setup env:

```powershell
cd ..\Auto-Create-Video
cp .env.example .env.local
```

Mở `.env.local` trong editor (Notepad / VSCode), điền các trường tối thiểu:

```env
# === TTS (mặc định VieNeu — free, local) ===
TTS_PROVIDER=vieneu
VIENEU_PROJECT_DIR=C:/Users/YOU/Documents/Workspace/Projects/VieNeu-TTS
VIENEU_VOICE_ID=Binh
VIENEU_EMOTION=natural

# === Image gen (Gemini free tier dùng cho free-form mode) ===
IMAGE_PROVIDER=gemini
GEMINI_API_KEY=AIza...   # lấy free tại https://aistudio.google.com/apikey

# === TikTok outro card ===
TIKTOK_DISPLAY_NAME=SportsForAllTV
TIKTOK_HANDLE=@bonglan0702
TIKTOK_FOLLOWERS=1.2M followers
```

> **Đổi voice tiếng Việt:** `VIENEU_VOICE_ID` chấp nhận `Binh` (nam Bắc, nhanh — default), `Tuyen` (nam Bắc, chậm), `Vinh` (nam Nam), `Sơn` (nam Nam), `Ly` (nữ Bắc), `Doan` (nữ Nam), `Ngoc` (nữ Bắc).

> **Tùy chọn — bật AusyncLab (paid premium):** Nếu sau này muốn voice tự nhiên hơn, đổi `TTS_PROVIDER=ausynclab` + thêm `AUSYNCLAB_API_KEY` + `AUSYNCLAB_VOICE_ID`. Pipeline sẽ tự dùng AusyncLab thay vì VieNeu.

### 1.5 Smoke test

```powershell
# Type check
npm run typecheck       # (không output = OK)

# Unit tests
npm test                # 41 passed (8 files)
```

Cả 2 PASS = setup xong. Sang Quick start.

---

## 2. Quick start — video đầu tiên trong 10 phút

Path nhanh nhất: 1 URL bài báo bóng đá → 1 video TikTok 9:16 final, ~5-10 phút thao tác chủ động (cộng thời gian render).

### Bước 1 — Mở Claude Code trong project

```powershell
cd C:\Users\YOU\...\Auto-Create-Video
claude
```

### Bước 2 — Đọc + rewrite + plan ảnh

Dán prompt sau vào Claude (đổi URL của bạn):

```
/read-rewrite https://vnexpress.net/bayern-loai-psg-3-1-ban-ket-cl.html
```

Skill sẽ:
1. Fetch bài báo
2. Rewrite tiếng Việt theo brand SportsForAllTV
3. Save vào `input/<slug>/<slug>.txt`
4. Tự động chain qua `/images-for-videos` → tạo `images-plan.json` + `grok-prompts.md`

Output:
```
✓ Bài báo đã rewrite: input/bayern-loai-psg-o-ban-ket-cl/bayern-loai-psg-o-ban-ket-cl.txt
✓ Image plan:        input/<slug>/images-plan.json
✓ Grok prompts:      input/<slug>/grok-prompts.md
8 ảnh cần tạo trên grok.com (Imagine, aspect ratio 9:16)
```

### Bước 3 — Tạo ảnh trên grok.com

1. Mở `input/<slug>/grok-prompts.md` — file này chứa prompt tiếng Anh chất lượng cao cho từng ảnh
2. Mở [grok.com](https://grok.com) → chọn **Imagine** → đổi aspect ratio sang **9:16**
3. Copy từng prompt → tạo ảnh → lưu về `input/<slug>/<filename>` (đúng tên file đã ghi trong plan)
4. Re-roll nhiều lần nếu cần — chọn ảnh ưng nhất

> **Tip:** mở `images-plan.json` để xem `subjectHint` của từng scene (mô tả ngắn cảnh muốn).

### Bước 4 — Build video

```
/create-video input/<slug>/<slug>.txt
```

Skill sẽ:
1. Detect `images-plan.json` → vào **plan mode**
2. Stage ảnh từ `input/<slug>/` → `output/<slug>/images/`
3. Sinh `script.json` (sceneId khớp plan, voiceText áp dụng phonetic Vietnamese rules)
4. Chạy pipeline 9 bước (TTS qua VieNeu local + concat + render)

ETA: ~5-7 phút (TTS ~30-60s + render ~3-5 phút).

Output:
```
✓ Video:  output/<slug>/video.mp4
✓ Audio:  output/<slug>/voice.mp3   (cho CapCut)
✓ Script: output/<slug>/script.txt   (cho CapCut auto-caption)
Tổng thời lượng: 138.8s
```

### Bước 5 — Review + đăng

- Mở `video.mp4` xem thử. OK → upload TikTok / YouTube Shorts / Facebook Reels.
- Muốn sửa caption / xuống dòng → sửa `output/<slug>/script.json` rồi `npm run rerender -- output/<slug>` (xem [5.4](#54-sửa-nội-dung-sau-khi-đã-render)).
- Muốn đổi 1 ảnh → save ảnh mới đè `input/<slug>/<sceneId>.jpg` rồi re-stage + rerender (xem [5.5](#55-đổi-ảnh-hook-hoặc-1-scene-riêng-lẻ)).
- Không thích giọng Bình → đổi `VIENEU_VOICE_ID` trong `.env.local` (vd `Tuyen` chậm hơn, `Ly` nữ Bắc), xoá `output/<slug>/voice/`, rerun pipeline.

---

## 3. Slash command (Claude Code skill)

Slash command được Claude (qua Claude Code CLI) thực thi. Bạn gõ trực tiếp vào prompt.

```
URL  ──/read-rewrite──────────────┐
                                   │
notes ──/refine-txt────► clean .txt├──► input/<slug>/<slug>.txt + images-plan.json
                                   │                          │
file (đã clean) ─/images-for-videos┘                          ▼
                                              user gen ảnh trên grok.com
                                                              │
                                                              ▼
                                                      /create-video <txt>
                                                              │
                                                              ▼
                                            output/<slug>/video.mp4 + voice.mp3
```

5 slash command, mỗi cái 1 việc duy nhất:

| Skill | Trách nhiệm | Output |
|---|---|---|
| `/read-rewrite` | URL bài báo → `.txt` cấu trúc tiếng Việt + chain qua `/images-for-videos` | `input/<slug>/<slug>.txt` + `images-plan.json` + `grok-prompts.md` |
| `/refine-txt` | Notes thô → `.txt` đã polish theo brand SportsForAllTV (in place, có backup `.raw.txt`) | `input/<slug>/<slug>.txt` (overwrite) + `<slug>.raw.txt` (backup gốc) |
| `/images-for-videos` | `.txt` → kế hoạch ảnh + prompt Grok | `images-plan.json` + `grok-prompts.md` |
| `/create-video` | `.txt` (+ optional plan) + ảnh → script + render video | `output/<slug>/video.mp4` + `voice.mp3` + `script.txt` |
| `/classify-football-content` | Diagnostic — preview content type + scene structure | Markdown report (không render) |

**Density-scaled length.** `/create-video` đo "distinct substantive points" trong `.txt` rồi chọn band:

| Distinct points | Scenes | Duration |
|---|---|---|
| < 3 | — | **bail** — báo nguồn quá ít, không tạo video |
| 3–4 | 6–8 | 45–75s |
| 5–7 | 8–11 | 75–120s |
| 8+ | 11–15 | 120–180s |

Không pad. Nguồn ngắn → video ngắn. `/images-for-videos` cũng chạy density check trước khi viết plan.

### 3.1 `/read-rewrite`

**Cú pháp:**
```
/read-rewrite <url>
```

**Mục đích:** Đọc 1 bài báo từ URL → rewrite thành file `.txt` tiếng Việt theo brand SportsForAllTV → tự động chain qua `/images-for-videos` để sinh `images-plan.json` + `grok-prompts.md`. Một lệnh cho cả 2 việc — không cần copy/paste thủ công.

**Hành vi (7 bước):**
1. **Fetch URL** qua WebFetch — extract title + body + ngày + quotes
2. **Sanity check:** không phải bài bóng đá → bail
3. **Rewrite tiếng Việt** theo tone SportsForAllTV (gọn, có nhịp, không sến)
4. **Structure** thành format markdown chuẩn: title / lead / `## Key facts` / `## Context` / `## Quotes` / footer `Nguồn:` `Ngày:`
5. **Slugify** tiêu đề Việt → tên folder (`bayern-loai-psg-o-ban-ket-cl`). Collision → append `-2`, `-3`...
6. **Tạo `input/<slug>/`** + write `<slug>.txt`
7. **Chain qua `/images-for-videos`** trên file vừa tạo → ra `images-plan.json` + `grok-prompts.md`

**Ví dụ:**
```
/read-rewrite https://vnexpress.net/bayern-3-1-psg-ban-ket-cl.html
/read-rewrite https://www.goal.com/en/news/messi-ballon-dor-2026
```

**Edge cases:**
| Tình huống | Hành vi |
|---|---|
| URL paywall / 404 / chặn bot | Bail kèm yêu cầu bạn paste nội dung vào prompt tiếp theo |
| URL không phải bài bóng đá | Bail (`SportsForAllTV chỉ làm content bóng đá`) |
| Bài tiếng Anh / ngôn ngữ khác | Tự dịch sang tiếng Việt khi rewrite |
| Bài không có quote | Bỏ section `## Quotes`, không bịa |
| Bài quá ngắn (<3 distinct points) | `/images-for-videos` sẽ bail → báo nguồn quá thin, không viết plan |
| Slug trùng | Append `-2`, `-3`... và báo trong summary |

**Khi nào dùng:** Có URL bài báo → đây là path nhanh nhất.
**Khi nào KHÔNG dùng:** Đã có file `.txt` viết tay → dùng `/refine-txt` (nếu cần polish) rồi `/images-for-videos`.

### 3.2 `/refine-txt`

**Cú pháp:**
```
/refine-txt <txt-path>
```

**Mục đích:** Lấy file `.txt` thô (notes, copy-paste, bullet jots, văn chưa biên tập) → polish thành file đã structure + tone SportsForAllTV, sẵn sàng cho `/images-for-videos`. Đây là tương đương cho local notes của bước rewrite trong `/read-rewrite` (vốn chỉ làm cho URL).

**Hành vi:**
1. Validate input là `.txt` đang tồn tại (URL → reject + chỉ qua `/read-rewrite`)
2. **Backup file gốc** sang `<slug>.raw.txt` (chỉ làm 1 lần — nếu `.raw.txt` đã có thì giữ nó làm source of truth, không backup đè)
3. Đọc + sanity check (phải là content bóng đá), classify content type, đếm distinct substantive points
4. Rewrite theo channel voice SportsForAllTV:
   - **Drop fluff:** câu mở đầu generic, hedging filler (`"có thể nói rằng"`, `"không thể phủ nhận"`), generic adjectives (`"tuyệt vời"`, `"đáng kinh ngạc"`)
   - **Văn nói tự nhiên:** mix câu ngắn punchy với 1 câu dài, no văn báo cứng nhắc
   - **Faithfulness tuyệt đối:** không thêm fact source không có, không bịa quote, không sửa số liệu (kể cả khi biết source sai)
   - **Preserve density:** mọi distinct point trong source đều surface thành bullet riêng
   - **Names + diacritics:** full diacritics `Mbappé`/`Vinícius`/`Đặng Văn Lâm`; canonical CLB names lần đầu (`Manchester United` rồi mới `MU`)
5. Structure thành markdown chuẩn:
   ```
   <Title — sentence case 5-12 từ>

   <Lead 1-2 câu, 25-60 từ>

   ## Key facts
   - <fact 1>
   - ... (4-7 bullets, ≤25 từ mỗi cái)

   ## Context
   - <historical/standings/comparison framing>

   ## Quotes  (chỉ khi source có direct attributed quotes)
   - "<quote>" — <speaker, role>

   ---
   Nguồn: ghi chú cá nhân
   Ngày: <ISO date if known else "n/a">
   ```
6. **Write IN PLACE** sang `<slug>.txt` (overwrite). File gốc vẫn được giữ ở `<slug>.raw.txt` từ bước 2.

**Output:**
```
✓ Refined: input/khung-hoang-mbappe/khung-hoang-mbappe.txt
✓ Backup:  input/khung-hoang-mbappe/khung-hoang-mbappe.raw.txt  (file gốc, không sửa)

7 distinct substantive points · ước tính video band: 8-11 scenes / 75-120s

Tiếp theo:
1. Mở file refined đọc qua, chỉnh tay nếu cần
2. Chạy: /images-for-videos input/khung-hoang-mbappe/khung-hoang-mbappe.txt
```

**Edge cases:**
| Tình huống | Hành vi |
|---|---|
| File rỗng | Reject `"File rỗng — không có gì để refine"` |
| Source không phải bóng đá | Reject (`SportsForAllTV chỉ làm content bóng đá`) |
| Source mostly tiếng Anh | Translate sang tiếng Việt khi rewrite |
| Source <3 distinct points | Refine + append warning `⚠ Source chỉ có X điểm (<3) — /images-for-videos sẽ bail` |
| Source đã polish rồi (idempotent re-run) | Re-apply structure nếu thiếu, edits tối thiểu — không bịa thay đổi |
| Source không có direct quotes | Bỏ section `## Quotes` hoàn toàn |
| `<slug>.raw.txt` đã có | Dùng làm source, không backup đè |

**Khi nào dùng:** Có file `.txt` thô (notes / copy-paste) chưa polish, muốn vào pipeline với chất lượng đầu vào cao nhất.

**Khi nào KHÔNG dùng:**
- File từ `/read-rewrite` → đã polish rồi, refine lại sẽ phí công
- File đã chỉnh tay kỹ → bỏ qua, đi thẳng `/images-for-videos`
- URL → dùng `/read-rewrite`

**Khôi phục file gốc:**
```powershell
# Nếu refined không ưng, xoá refined + đổi raw thành .txt
Remove-Item input/<slug>/<slug>.txt
Rename-Item input/<slug>/<slug>.raw.txt input/<slug>/<slug>.txt
```

### 3.3 `/images-for-videos`

**Cú pháp:**
```
/images-for-videos <txt-path>
```

**Mục đích:** Phân tích file txt nguồn → đề xuất bộ ảnh cần có cho video (số lượng scale theo content density) → viết prompt tiếng Anh chất lượng cao cho từng ảnh → save ra `images-plan.json` + `grok-prompts.md` cùng thư mục.

**Hành vi:**
1. Đọc file txt, classify nội dung qua `classify-football-content` (RANKING / VS / MATCH ANALYSIS / PLAYER PROFILE / HISTORY-CAREER / TRANSFER NEWS / TRIVIA / PRE-MATCH PREVIEW)
2. **Density check (mandatory):** đếm distinct substantive points → chọn band:
   - < 3 → **bail**, không viết plan
   - 3–4 → 3–4 image scenes (hook + 2–3)
   - 5–7 → 5–7 image scenes (hook + 4–6)
   - 8+ → 8+ image scenes (hook + 7–10)
3. Chỉ template `hook` / `stat-hero` / `callout` lấy ảnh. `comparison` / `feature-list` / `outro` không cần.
4. Sinh prompt theo các rule chính (auto-applied từ memory):
   - **Lean on the NAME**, không mô tả khuôn mặt — `"<Full Name>, the <Nationality> <position> for <Club> and the <National Team>"`. Không tả skin/hair/jaw/beard.
   - **Sharpness stack** — `"shot on Canon EOS R5 with 85mm prime"`, `"natural skin texture, no plastic AI smoothness"`, `"photo-realistic, NOT illustration"`.
   - **Multi-subject scenes** — voiceText nhắc 2+ cầu thủ thì prompt phải đặt cả 2+ vào khung.
   - **Real club iconography** — yêu cầu rõ logo CLB trên ngực áo, fan với scarf, tifo, mascot, stadium landmarks. Né scoreboard + on-image text + flare/smoke.
   - **Variety pool** cho atmospheric scenes — không phải lúc nào cũng "cầu thủ trên sân": ultras, tifo, mascot, scarf wall, stadium exterior, tunnel, dressing room.
   - **80–180 từ** mỗi prompt, kết bằng `"the club's real crest visible on the jersey, no scoreboard graphics or text overlays"`.
5. Save 2 file:
   - `images-plan.json` — schema-validated, dùng bởi `images:stage` và `/create-video`
   - `grok-prompts.md` — copy-paste-friendly với mỗi prompt trong code block

**Khi nào dùng:**
- Đã có file `.txt` (tự viết / từ `/read-rewrite`) — sinh kế hoạch ảnh trước khi build video
- Có thể chạy lại nhiều lần — sẽ ghi đè plan cũ và báo các file ảnh không còn dùng đến (orphans)

**Khi nào KHÔNG cần:**
- Bắt đầu từ URL → dùng `/read-rewrite` (auto chain qua skill này)
- OK với ảnh Gemini auto (free, decent quality) → bỏ qua, chạy thẳng `/create-video`

### 3.4 `/create-video`

**Cú pháp:**
```
/create-video <txt-path>
```

**Mục đích:** Build video tiếng Việt 9:16 từ `.txt` nguồn (+ optional `images-plan.json` + ảnh đã save).

**Input contract:** Chỉ nhận `.txt`. URL → reject. Topic-string (vd `"Top 10 X"`) → cũng không hỗ trợ — viết `.txt` ngắn rồi gọi.

**2 sub-mode:**

| | Plan mode (preferred — visual-first) | Free-form mode (fallback) |
|---|---|---|
| Trigger | `images-plan.json` tồn tại cùng folder với .txt | Không có plan |
| Output dir | `output/<slug>/` (no timestamp, idempotent) | `output/<slug>-<timestamp>/` |
| sceneId | Khớp plan exactly (`hook`, `cb-1`, …) | Tự do (`hook`, `rank-1`, …) |
| Image source | Ảnh user save → auto-stage qua `images:stage` | Gemini API gen tại runtime |
| Nếu thiếu ảnh | **Halt** + báo danh sách thiếu + prompt | Fallback gradient |
| imagePrompt trong script | Copy verbatim từ plan | Skill tự sinh |

**Workflow tự động (plan mode):**
1. Validate input là `.txt` đang tồn tại (URL → reject).
2. Classify content + density check (Step 2.4 SKILL.md). Source <3 điểm → bail.
3. Tạo `output/<slug>/` (overwrite nếu đã có).
4. Chạy `npm run images:stage` để validate + copy ảnh từ input → output. Thiếu ảnh → halt + báo file thiếu.
5. Sinh `script.json` (sceneId khớp plan, áp dụng phonetic Vietnamese rules + sound-off test + typography rules).
6. Chạy `npm run pipeline` để render.

**Latency:** 3–6 phút (TTS ~30–60s + render ~3–5 phút). Lần rerun nhanh hơn vì TTS đã cache.

**Lưu ý:**
- Đã sửa `script.json` thủ công → **đừng** chạy lại `/create-video`, sẽ ghi đè. Dùng `npm run rerender` thay vì.
- Plan mode KHÔNG gọi AI image API → tiết kiệm credit + ảnh giữ chất lượng Grok.
- Plan có 6 image scenes nhưng source chỉ chứa 3 điểm thực → skill sẽ surface mismatch và đề nghị bạn re-run `/images-for-videos` thay vì pad video.

### 3.5 `/classify-football-content`

**Cú pháp:**
```
/classify-football-content <url | txt-path | topic>
```

**Mục đích:** Diagnostic — chỉ classify nội dung và đề xuất scene structure, KHÔNG render video. Hữu ích để preview trước khi commit render thật.

**Output:** Markdown report với:
- **Type** (1 trong 8: RANKING / VS / MATCH ANALYSIS / PRE-MATCH PREVIEW / PLAYER PROFILE / HISTORY-CAREER / TRANSFER NEWS / TRIVIA)
- **Confidence** (high / medium / low)
- **Proposed structure** (số scene + sequence template)
- **Suggested hook line** (gợi ý câu mở đầu tiếng Việt)
- **Notes** (cảnh báo nếu nội dung không đủ depth, mixed signals, …)

**Khi nào dùng:**
- Không chắc nội dung phù hợp loại nào → chạy classify để xem trước
- Debug tại sao output video không như kỳ vọng — xem skill đề xuất structure khác không

---

## 4. npm script

npm script là các utility chạy trực tiếp từ terminal (PowerShell). Bạn dùng khi cần thao tác cụ thể không qua skill.

### 4.1 `npm run pipeline`

**Cú pháp:**
```powershell
npm run pipeline -- <path/to/script.json>
```

**Mục đích:** Chạy full pipeline 9 bước trên 1 file `script.json` đã có sẵn. Đây là entry point thấp cấp mà skill `/create-video` gọi nội bộ.

**9 bước:**
1. Load env + validate `script.json`
2. Write `script.txt` cho CapCut auto-caption
3. Fetch og:image (cho hook nếu URL mode)
4. TTS song song với fetch image (idempotent — skip nếu mp3 đã có)
5. AI image gen cho scene image-eligible (skip nếu có manual override)
6. Concat voice + mix SFX layer
7. Compose HTML + write hyperframes project files
8. Render với hyperframes (chạy headless Chromium)
9. Done

**Khi nào dùng trực tiếp:**
- Đã có `script.json` (ví dụ tự viết tay) và muốn render
- Debug pipeline (chạy với 1 script đơn giản để xem step nào fail)

**Idempotent:** Chạy lại sẽ:
- TTS: skip nếu mp3 đã có (xoá `voice/scene-<id>.mp3` để force re-TTS)
- Image: skip nếu file đã tồn tại trong `output/<slug>/images/`
- Render: luôn chạy lại

**Ví dụ:**
```powershell
npm run pipeline -- output/top7CBsITW/script.json
```

### 4.2 `npm run rerender`

**Cú pháp:**
```powershell
npm run rerender -- <outputDir>
```

**Mục đích:** Re-compose HTML + render lại video, **bỏ qua TTS và image gen**. Dùng khi đã có output dir hoàn chỉnh và chỉ muốn redraw video sau khi sửa:
- `script.json` (đổi text/value/highlights, thêm `|` để xuống dòng)
- CSS (`src/render/templates/styles.css`)
- Animation (`src/render/templates/animations.js`)
- HTML composer logic (`src/render/html-composer.ts`)

**Yêu cầu:** `<outputDir>` phải có sẵn:
- `script.json`
- `voice/scene-<id>.mp3` cho mỗi scene (TTS đã chạy ít nhất 1 lần)
- `images/` (nếu có manual override)

**Latency:** ~3–5 phút (chỉ render, không TTS không AI image).

**Lưu ý:** Vừa update `src/render/templates/styles.css` hoặc `animations.js` → phải rerender mới thấy thay đổi (file template được copy vào output dir mỗi lần render).

### 4.3 `npm run images:stage`

**Cú pháp:**
```powershell
npm run images:stage -- <txt-path>
```

**Mục đích:** Validate + copy ảnh đã planned từ `input/<slug>/` sang `output/<slug>/images/` với đúng tên `<sceneId>.<ext>`. `/create-video` gọi tự động — bạn ít khi cần chạy thủ công.

**Hành vi:**
1. Đọc `images-plan.json` cùng folder với txt
2. Cho mỗi scene, tìm file ảnh trong input folder theo **stem** (`<sceneId>.png` / `.jpg` / `.jpeg` / `.webp` đều được)
3. Thiếu → **exit code 1** kèm danh sách file thiếu + prompt tương ứng
4. Có file thừa không khớp plan → cảnh báo "orphans" (không halt)
5. Copy từng file sang `output/<slug>/images/<sceneId>.<ext>`

**Khi nào dùng thủ công:** Test xem ảnh đã đủ chưa, không muốn chạy full skill mà chờ render.

### 4.4 `npm run images:list`

**Cú pháp:**
```powershell
npm run images:list -- <slug>
```

**Mục đích:** Liệt kê tất cả scene có `imagePrompt` trong `output/<slug>/script.json`, kèm trạng thái ảnh (override / AI-cached / chưa có) và path để bạn drop manual override.

**Khác `images:stage`:**
- `images:list` đọc từ `output/<slug>/script.json` (post-pipeline state)
- `images:stage` đọc từ `input/<slug>/images-plan.json` (pre-pipeline plan)

**Khi nào dùng:** Sau khi đã render video, muốn thay 1 ảnh AI-generated bằng ảnh thủ công cho chỉ 1 scene.

### 4.5 `npm run sfx:download` / `sfx:filter`

```powershell
npm run sfx:download    # tải SFX library
npm run sfx:filter      # lọc / dọn SFX
```

Quản lý thư viện SFX (`assets/sfx/`). Pipeline tự pick SFX cho từng scene theo template (swoosh cho hook, chime cho stat-hero, …).

Hiếm khi cần chạy thủ công sau setup ban đầu.

### 4.6 `npm test` / `typecheck` / `build`

| Lệnh | Mục đích |
|---|---|
| `npm test` | Chạy full vitest suite (`vitest run --passWithNoTests`) |
| `npm run test:watch` | Vitest interactive mode |
| `npm run typecheck` | `tsc --noEmit` — kiểm tra type errors |
| `npm run build` | `tsc` — emit JS vào `dist/` (không cần thiết khi dùng tsx) |

---

## 5. Workflow theo tình huống

### 5.1 URL bài báo → video (recommended)

Path nhanh nhất. Tham khảo [Quick start](#2-quick-start--video-đầu-tiên-trong-10-phút) — đó chính là workflow này.

### 5.2 Visual-first từ nội dung tự viết

Cho content bạn đã có sẵn outline / notes (không từ URL). Phù hợp khi: ý tưởng cá nhân, tổng hợp từ nhiều nguồn, thread Twitter/X.

```powershell
# 1. Chuẩn bị notes (thô — copy-paste, bullet jots, đoạn lan man đều OK)
# Lưu vào input/<slug>/<slug>.txt

# 2. Polish notes thành .txt structured + tone SportsForAllTV (RECOMMENDED)
/refine-txt input/<slug>/<slug>.txt
# → input/<slug>/<slug>.txt (refined, in place)
# → input/<slug>/<slug>.raw.txt (backup gốc)
# Bước này drop fluff, structure title/lead/key-facts/context, validate density

# 3. Sinh kế hoạch ảnh
/images-for-videos input/<slug>/<slug>.txt

# 4. Generate ảnh thủ công
# Mở input/<slug>/grok-prompts.md
# grok.com → Imagine → 9:16
# Save về input/<slug>/<sceneId>.{png,jpg,jpeg,webp}

# 5. Build video
/create-video input/<slug>/<slug>.txt
```

**Ưu điểm:** Chất lượng ảnh do user kiểm soát, không tốn AI credit, deterministic. `/refine-txt` đảm bảo input vào `/images-for-videos` đã sạch + đủ density (skill tự bail nếu source <3 distinct points → bạn biết phải bổ sung facts trước khi đi tiếp).

**Skip `/refine-txt` khi:** notes đã chỉnh tay kỹ, hoặc bạn muốn `/images-for-videos` dùng nguyên text thô.

### 5.3 Chạy nhanh không qua plan ảnh (Gemini auto)

Khi cần video gấp, OK với chất lượng ảnh AI auto-gen.

```powershell
# 1. Chuẩn bị file .txt nguồn
# input/<slug>/<slug>.txt

# 2. Build thẳng (không có images-plan.json → free-form mode)
/create-video input/<slug>/<slug>.txt
# → output/<slug>-<timestamp>/video.mp4
# → Gemini sinh ảnh tại runtime cho mọi scene image-eligible
```

**Đánh đổi:**
- ✓ Nhanh, không cần grok.com manual
- ✗ Ảnh Gemini chất lượng thấp hơn, likeness cầu thủ thường không giống
- ✗ Output dir có timestamp → mỗi rerun tạo folder mới
- ✗ Ăn quota Gemini (free tier ~1500 req/ngày — vẫn khá rộng)

Phù hợp draft / test, không phù hợp video chính thức upload.

### 5.4 Sửa nội dung sau khi đã render

Vừa xem video xong, thấy 1 caption chưa ưng (vd scene `cb-3` highlight đặt sai, muốn xuống dòng đẹp hơn).

```powershell
# 1. Mở output/<slug>/script.json, sửa templateData của scene cần đổi
# Ví dụ: đổi highlights, value, label, statement
# Hoặc thêm "|" để xuống dòng có chủ ý ở các trường hỗ trợ:
#   hook.headline, hook.subhead, callout.statement, feature-list.title, stat-hero.label
#   E.g. "Top 5 vua phá lưới|Champions League"

# 2. Re-render (không TTS lại, không gọi API)
npm run rerender -- output/<slug>
```

**Đừng** chạy lại `/create-video` — sẽ regenerate `script.json` từ đầu và mất sửa.

**Khi nào CẦN chạy lại `/create-video`:**
- Đã sửa file `.txt` nguồn → cần build script mới
- Đã update SKILL.md → muốn áp dụng rule mới
- Muốn redo phong cách hoàn toàn

### 5.5 Đổi ảnh hook hoặc 1 scene riêng lẻ

Đã render xong, muốn thay ảnh `cb-5` (Van Dijk) bằng ảnh đẹp hơn.

```powershell
# 1. Tạo ảnh mới trên grok.com (paste lại prompt từ grok-prompts.md, re-roll)

# 2. Save ảnh đè lên input/<slug>/cb-5.jpg (hoặc .png/.jpeg/.webp)

# 3. Re-stage + rerender
npm run images:stage -- input/<slug>/<slug>.txt
npm run rerender -- output/<slug>
```

### 5.6 Đổi giọng đọc

Bạn không thích giọng `Binh` (default), muốn thử `Tuyen` (nam Bắc, chậm hơn):

```powershell
# 1. Sửa .env.local
# VIENEU_VOICE_ID=Tuyen

# 2. Xoá voice/ của output cũ để force re-TTS
Remove-Item -Recurse output/<slug>/voice

# 3. Rerun pipeline (pipeline tự re-TTS rồi rerender)
npm run pipeline -- output/<slug>/script.json
```

7 voice id: `Binh`, `Tuyen`, `Vinh`, `Sơn` (4 nam) · `Ly`, `Doan`, `Ngoc` (3 nữ).

### 5.7 Source quá thin — skill bail thì sao?

`/create-video` (hoặc `/images-for-videos`) báo "source quá thin (<3 distinct points), không tạo video".

**Phải làm:**
- Bổ sung facts/context vào file `.txt`: thêm số liệu cụ thể, thêm quote, thêm bối cảnh, thêm so sánh.
- Hoặc thay đổi góc tiếp cận: ranking → mở rộng số item, transfer news → thêm phân tích why-now + tactical fit + reaction, press-conf → thêm head-to-head record + tactical preview.
- Sau khi `.txt` đủ dày, chạy lại `/images-for-videos` rồi `/create-video`.

**Đừng:** ép pad bằng cách viết lại restate cùng 1 fact trong 3 cảnh khác nhau — viewer swipe ngay.

---

## 6. Cấu trúc thư mục

```
Workspace/Projects/
├── Auto-Create-Video/             ← repo này
│   ├── input/
│   │   └── <slug>/                ← 1 folder / 1 content
│   │       ├── <slug>.txt         ← nội dung nguồn (bạn viết HOẶC từ /read-rewrite)
│   │       ├── images-plan.json   ← do /images-for-videos sinh
│   │       ├── grok-prompts.md    ← copy-paste-friendly prompts
│   │       ├── hook.png           ← ảnh user save từ grok.com
│   │       ├── cb-1.jpg
│   │       └── ...
│   ├── output/
│   │   └── <slug>/                ← 1 folder / 1 video
│   │       ├── script.json        ← script tổng hợp (skill sinh)
│   │       ├── script.txt         ← cho CapCut auto-caption
│   │       ├── voice.mp3          ← audio final (voice + SFX)
│   │       ├── voice/             ← per-scene mp3 (+ srt khi provider emit) — cache TTS
│   │       ├── images/            ← ảnh đã staged
│   │       ├── index.html
│   │       ├── styles.css
│   │       ├── animations.js
│   │       ├── video.mp4          ← thành phẩm cuối
│   │       └── meta.json
│   ├── src/                       ← TypeScript code
│   │   └── tts/
│   │       ├── tts-client.ts      ← interface + factory
│   │       ├── vieneu-client.ts   ← VieNeu (default, free)
│   │       └── ausynclab-client.ts ← AusyncLab (paid fallback)
│   ├── scripts/
│   │   └── vieneu_worker.py       ← Python worker (subprocess for VieNeu)
│   ├── tests/                     ← vitest fixtures + specs
│   ├── assets/
│   │   ├── logoTV.png             ← TikTok avatar default
│   │   └── sfx/                   ← thư viện sound effects
│   ├── .claude/
│   │   └── skills/                ← SKILL.md cho mỗi slash command
│   │       ├── read-rewrite/
│   │       ├── images-for-videos/
│   │       ├── create-video/
│   │       └── classify-football-content/
│   ├── .env.local                 ← API keys (gitignored)
│   ├── .env.example               ← template
│   ├── package.json
│   ├── README.md / README.vi.md
│   └── COMMANDS.md                ← tài liệu này
└── VieNeu-TTS/                    ← clone sibling — chứa Python TTS
    ├── pyproject.toml             ← uv project root
    ├── src/vieneu/                ← Python TTS package
    └── ...
```

---

## 7. Troubleshooting

### Pipeline lỗi `VieNeu project dir not found`

→ `VIENEU_PROJECT_DIR` chưa đúng path tới folder VieNeu-TTS đã clone. Mở `.env.local`, sửa thành **đường dẫn tuyệt đối** (forward slash hoặc double backslash trên Windows):
```env
VIENEU_PROJECT_DIR=C:/Users/YOU/Documents/Workspace/Projects/VieNeu-TTS
```
Hoặc clone VieNeu-TTS làm sibling của Auto-Create-Video → pipeline tự tìm thấy default.

### Pipeline lỗi `Missing AUSYNCLAB_API_KEY`

→ Bạn đặt `TTS_PROVIDER=ausynclab` nhưng chưa điền API key. Hoặc đổi về `TTS_PROVIDER=vieneu` (free) hoặc thêm `AUSYNCLAB_API_KEY` + `AUSYNCLAB_VOICE_ID` lấy từ [ausynclab.io](https://ausynclab.io).

### `VieNeu worker did not become ready within 90000ms`

→ Worker process load model >90s, có thể do:
- Lần đầu chạy → đang tải GGUF (~300MB) từ HuggingFace. Tăng `loadTimeoutMs` trong `vieneu-client.ts` hoặc đợi tải xong rồi chạy lại.
- `uv` không trên PATH → set `UV_BIN` trong `.env.local` trỏ tới `uv.exe`.
- `VieNeu-TTS/` chưa `uv sync` xong → vào folder đó chạy lại `uv sync`.

### `/read-rewrite` không đọc được URL

- Báo lỗi paywall / 404 / chặn bot → paste nội dung bài báo vào prompt tiếp theo. Skill sẽ tiếp tục từ rewrite step.
- URL không phải bài bóng đá → check lại link. Skill chỉ xử lý content bóng đá.

### `/create-video` reject "Skill này nhận file .txt"

→ Bạn pass URL hoặc topic-string. Chạy `/read-rewrite <url>` trước, rồi chạy `/create-video <txt-path>`. Topic-only thì viết `.txt` ngắn rồi gọi.

### Skill bail "source quá thin"

→ Source `.txt` có <3 distinct substantive points. Xem [5.7 Source quá thin](#57-source-quá-thin--skill-bail-thì-sao).

### `images:stage` báo missing files mặc dù tôi đã save

- Kiểm tra **stem** file khớp `sceneId` trong plan. Plan ghi `cb-1.png` thì file phải là `cb-1.<ext>`. Không phải `cb_1.png` hoặc `cb-01.png`.
- Extension `.png` / `.jpg` / `.jpeg` / `.webp` đều OK.
- Đường dẫn phải là folder cùng cấp với file `.txt`, không phải subfolder.

### TTS chậm

- VieNeu (mặc định) chạy local trên CPU — không có quota, nhưng inference chậm hơn cloud. Lần đầu mỗi pipeline mất ~5-10s load model, scene tiếp theo ~2-3s/câu.
- CPU mạnh / nhiều RAM giúp đáng kể. Ryzen 5 5600H + 16GB RAM: 13 scenes ~30-40s tổng.
- AusyncLab giới hạn 1 concurrent export/key. Đợi.
- Đổi qua lại VieNeu ↔ AusyncLab bằng cách sửa `TTS_PROVIDER` trong `.env.local`.
- Để giữ cache TTS giữa các lần test, đừng xoá `output/<slug>/voice/`.

### Render hyperframes báo "duplicate_media_discovery_risk"

- Cảnh báo, không lỗi. Video vẫn ra. Nếu thấy ảnh nào "nháy" trong video, có thể là HTML composer inline 2 lần — báo Claude debug `src/render/html-composer.ts`.

### Đổi avatar TikTok

- Replace `assets/logoTV.png` với ảnh của bạn (square, ~256x256+, jpg/png/webp đều được)
- Hoặc set `TIKTOK_AVATAR_URL=https://...` trong `.env.local` (auto-download)

### Ảnh cầu thủ AI gen không giống thật

- Dùng workflow visual-first (`/read-rewrite` hoặc `/images-for-videos` + Grok manual)
- Rule prompt mới: lean on NAME (CLB + ĐTQG), KHÔNG mô tả khuôn mặt — mô tả khuôn mặt làm Grok "trộn" thành 1 người chung chung khớp mô tả thay vì cầu thủ thật
- Yêu cầu rõ logo CLB trên áo + scarf fan + stadium landmark — tăng độ chân thực
- Stack sharpness cues (`"shot on Canon EOS R5 with 85mm prime"`, `"natural skin texture, no plastic AI smoothness"`)
- Cầu thủ trẻ / mới (debut <2 năm) — Grok có ít training data → cần re-roll nhiều

### voiceText nhắc 2+ cầu thủ nhưng ảnh chỉ có 1

- Prompt cần đặt cả 2+ cầu thủ vào khung. Mở `images-plan.json`, sửa prompt theo skeleton split-frame, regen ảnh trên grok.com, save đè, `npm run images:stage` + `npm run rerender`.

### Video bị flag / takedown trên TikTok / Facebook

- Audit prompt: tránh `flare` / `smoke` / `pyrotechnics` / `fight` / `blood` / `weapon`
- AI-gen likeness public figure chỉ dùng quote thật, có nguồn — không bịa quote/scenario

### Caption render không như ý (xuống dòng xấu, viết hoa lệch)

- `|` trong text = soft line break, chỉ hoạt động ở 5 trường: `hook.headline`, `hook.subhead`, `callout.statement`, `feature-list.title`, `stat-hero.label`
- `comparison.label` và `callout.tag` được CSS tự uppercase — viết tự nhiên (`"Messi"`, `"Insight"`), đừng tự gõ in hoa
- Trường khác dùng Vietnamese sentence case — chỉ viết hoa đầu câu + tên riêng. KHÔNG Title Case kiểu Anh.
- Sửa trực tiếp `output/<slug>/script.json` rồi `npm run rerender -- output/<slug>`

### Schema validation fail khi chỉnh script.json thủ công

- Mỗi field có max length cụ thể (xem `src/render/script-schema.ts`):
  - `headline` max 40, `subhead` max 40
  - `stat-hero.value` max 20, `label` max 40, `context` max 50, `highlights[i]` max 20 (1–4 items)
  - `callout.statement` max 80, `tag` max 20
  - `feature-list.title` max 40, `bullets[i]` max 50 (1–4 items)
  - `imagePrompt` min 10, max 1500
- Ký tự `|` đếm vào cap (40 chars = 39 visible chars + 1 break)
- `npm run typecheck` không bắt được lỗi schema — chỉ runtime mới validate. Test bằng `npm run rerender`.

---

## Tham khảo nhanh

| Tôi muốn ... | Câu lệnh |
|---|---|
| Tạo video từ URL bài báo (full flow) | `/read-rewrite <url>` → tạo ảnh trên grok.com → `/create-video <txt>` |
| Polish notes thô trước khi vào pipeline | `/refine-txt <txt>` (in-place, có backup `.raw.txt`) |
| Tạo video từ txt tự viết với ảnh Grok | `/refine-txt <txt>` → `/images-for-videos <txt>` → tạo ảnh → `/create-video <txt>` |
| Tạo video không qua plan ảnh (Gemini auto) | `/create-video <txt>` thẳng — pipeline rơi về free-form mode |
| Xem trước structure trước khi render | `/classify-football-content <input>` |
| Sửa text caption sau khi render | Sửa `output/<slug>/script.json` (có thể thêm `\|` xuống dòng) → `npm run rerender -- output/<slug>` |
| Đổi 1 ảnh sau khi render | Save ảnh mới đè `input/<slug>/<sceneId>.<ext>` → `npm run images:stage -- <txt>` → `npm run rerender -- output/<slug>` |
| Đổi giọng đọc | Sửa `VIENEU_VOICE_ID` trong `.env.local` → xoá `output/<slug>/voice/` → `npm run pipeline -- output/<slug>/script.json` |
| Force re-TTS 1 scene | Xoá `output/<slug>/voice/scene-<id>.mp3` → `npm run pipeline -- output/<slug>/script.json` |
| Test code thay đổi | `npm run typecheck` + `npm test` |
