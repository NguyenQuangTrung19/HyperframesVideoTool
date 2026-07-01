# ⚽ HyperframesVideoTool — SportsForAllTV

Tự động dựng video ngắn **9:16** (TikTok / Reels / Shorts / Facebook) cho kênh bóng đá tiếng Việt **SportsForAllTV** (`@bonglan0702`).

Mô hình cốt lõi: **AI viết nội dung — code render deterministic**. Claude viết kịch bản + chọn template, pipeline TypeScript/FFmpeg render ra pixel. Cùng input → cùng frame.

> 📖 **Tài liệu đầy đủ (tiếng Việt):** [`HUONG-DAN.md`](HUONG-DAN.md) — setup, từng skill, env, troubleshooting, workflow A–Z.

---

## 3 pipeline

| Pipeline | Đầu vào | Cách dựng hình | Output |
|---|---|---|---|
| **VIDEO** (motion-graphic) | `.txt` + ảnh poster AI | 10 template động (HyperFrames + HTML composer) | `video/output/<slug>/video.mp4` |
| **PODCAST** | `.txt` prose + video clip thật | TTS phủ lên footage + karaoke caption burn-in | `podcast/output/<slug>/<slug>.mp4` |
| **MUSIC VIDEO** | song `.mp3` + background + lyrics | Mux nhạc + karaoke lyric | `output/<slug>/` |

Sản phẩm cuối: 1080×1920, 30fps, h264 + AAC.

---

## 10 scene template (pipeline VIDEO)

Nguồn sự thật: `src/render/script-schema.ts` (`z.discriminatedUnion` 10 nhánh) + `src/render/html-composer.ts`.

| Template | Dùng cho |
|---|---|
| `hook` | Scene mở đầu (bắt buộc) — stat-shock / câu hỏi / phán quyết |
| `stat-hero` | Con số lớn / item ranking, có ảnh hero |
| `callout` | Money line / nhận định chốt |
| `comparison` | VS / so sánh (bar tỉ lệ hoặc 2-card) |
| `feature-list` | 1–4 ý gạch đầu dòng đánh số |
| `big-quote` | Pull quote ≤200 ký tự + chân dung |
| `timeline` | 3–5 cột mốc (bio / lịch sử) |
| `formation-pitch` | Đội hình ra sân — sân xanh + token cầu thủ |
| `engagement-question` | Áp chót (bắt buộc) — câu hỏi + CTA bình luận |
| `outro` | Scene cuối (bắt buộc) — thẻ follow TikTok |

`hook`, `engagement-question`, `outro` luôn xuất hiện; 7 cái còn lại là body scene chọn theo content type. Mỗi video 5–20 scene, dài 45–180s, scale theo độ dày nội dung.

Xem mockup trực quan tất cả template: mở [`scratch/create-video-overview.html`](scratch/create-video-overview.html) trong trình duyệt.

---

## Skill (Claude Code slash command)

**Nhánh VIDEO**
- `/read-rewrite <url>` — URL bài báo → `.txt` channel-voice → tự chain `/images-for-videos`
- `/refine-txt <path>` — polish ghi chú thô thành `.txt` structured
- `/images-for-videos <path>` — lên plan ảnh + prompt tiếng Anh → `images-plan.json` (auto-split bio/history ≥4000 chars)
- `/create-video <path>` — build video motion-graphic (skill chính)
- `/video-queue` — batch 2-pass qua `video/input/queue.xlsx`
- `/classify-football-content <path>` — diagnostic, phân 11 content type

**Nhánh PODCAST**
- `/create-podcast <path> [music]` — 1 clip podcast
- `/podcast-queue` — batch qua `podcast/input/queue.xlsx`

**Khác:** `/create-music-video <dir>`

---

## Tech stack

| Layer | Công nghệ |
|---|---|
| Runtime | Node.js ≥ 20, TypeScript ESM (chạy qua `tsx`) |
| Render engine | [HyperFrames](https://hyperframes.heygen.com) (Puppeteer + GSAP + FFmpeg) → 1080×1920 @ 30fps |
| TTS | [AusyncLab](https://ausynclab.io) (cloud, mặc định — voice An Khôi, `myna-2`) + [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) (local, free fallback) |
| Ảnh | Gen thủ công trên grok.com (SuperGrok) — ưu tiên; Gemini / OpenAI / xAI chỉ là fallback API |
| Karaoke caption | faster-whisper (align per-word) |
| Validation | [Zod](https://zod.dev) v4 |
| Test | [Vitest](https://vitest.dev) (52 unit test) |

---

## Quick start

```bash
# 1. Cài đặt
npm install
cp .env.example .env.local   # điền AUSYNCLAB_API_KEY (xem HUONG-DAN.md §1)

# 2. Tạo video từ URL bài báo (trong Claude Code)
/read-rewrite https://www.goal.com/vn/news/some-article/12345
#  → sinh .txt + images-plan.json + danh sách prompt ảnh

# 3. Mở grok.com (nhiều tab song song), gen ảnh, save vào video/input/<slug>/

# 4. Build
/create-video video/input/<slug>/<slug>.txt
#  → video/output/<slug>/video.mp4
```

Chạy pipeline trực tiếp (không qua Claude) khi đã có `script.json`:

```bash
npm run pipeline -- video/output/<slug>/script.json
```

---

## Yêu cầu hệ thống

- Node.js ≥ 20
- FFmpeg + ffprobe trong PATH
- `uv` + Python (chỉ cần cho VieNeu fallback / karaoke caption)
- VieNeu-TTS clone riêng (đường dẫn qua `VIENEU_PROJECT_DIR`)

## Test

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest run
```

---

## Cấu trúc folder (type-major)

```
.claude/skills/   ← định nghĩa skill (SKILL.md mỗi skill)
src/              ← pipeline.ts, podcast/, music/, render/ (schema + composer + templates), tts/, image/
scripts/          ← helper npm-runnable (video-queue, podcast-queue, stage-planned-images, *_worker.py)
video/{input,output}/     ← motion-graphic
podcast/{input,output,_runs}/
assets/{beat,sfx}/        ← nhạc nền + SFX
```

## License

[MIT](LICENSE)
