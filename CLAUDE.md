# Code map — Auto-Create-Video

Bản đồ tĩnh các file code hay đụng, để khỏi đào file-by-file. Codebase ~50 file/~10k dòng TS; repo chủ yếu là **content** (`video/`, `podcast/`), code tương đối ổn định. Quy ước workflow/nội dung nằm ở auto-memory, KHÔNG lặp lại ở đây.

## Pipeline /create-video (motion-graphic)
`npm run pipeline -- <dir>/script.json` → `src/cli.ts` (entry mỏng, load `.env.local`) → **`src/pipeline.ts`** (orchestrator 9 bước: validate → TTS → align → image → concat+SFX → compose HTML → render).
- **outputDir = thư mục chứa script.json.** Override ảnh tra ở `<outputDir>/images/<sceneId>.<ext>`. Layout chuẩn: script.json + voice/ + video.mp4 ở `video/output/<slug>/`; .txt + images-plan.json + ảnh thô ở `video/input/<slug>/`.
- Voice cache theo existence: `<outputDir>/voice/full.mp3` + `full-words.json` (TTS+align, đắt API) — xóa để ép làm lại.

## File chính (theo việc)
| Việc | File |
|---|---|
| Orchestrator 9 bước | `src/pipeline.ts` |
| Validate script.json (zod) | `src/render/script-schema.ts` (`imagePrompt` optional) |
| Bind ảnh override / AI gen | `src/image/index.ts` (PASS 1 override mọi scene eligible, KHÔNG cần imagePrompt) |
| Đọc images-plan.json | `src/image/plan.ts` · schema `src/image/plan-schema.ts` |
| Image provider | `src/image/{provider,xai,gemini,openai}.ts` |
| TTS | `src/tts/tts-client.ts` (dispatch) · `ausynclab-client.ts` (active) |
| Render hyperframes | `src/render/hyperframes-runner.ts` (`RENDER_FPS`, `HYPERFRAMES_WORKERS=4`) |
| Compose HTML cảnh | `src/render/html-composer.ts` |
| Config + env | `src/config.ts` |
| Podcast pipeline | `src/podcast/pipeline.ts` |

## Scripts (npm run)
- `images:stage -- <txt>` — `scripts/stage-planned-images.ts`: verify + copy ảnh plan → `output/<slug>/images/`; chạy combine trước.
- `images:combine -- <dir>` — `scripts/combine-split-images.ts`: ghép `<stem>-1`+`<stem>-2` → `<stem>.png` (split-frame).
- `video-queue -- list|set` — `scripts/video-queue.ts`: driver `video/input/queue.xlsx`.
- `podcast-queue` — `scripts/podcast-queue.ts`. `render:check` — `scripts/verify-render.ts`.

## Render thật (batch)
`npm run images:stage -- <input>/<slug>.txt` → `npm run pipeline -- <output>/<slug>/script.json` ở background từ main loop; verify mp4 bằng ffprobe (đừng tin exit code).
