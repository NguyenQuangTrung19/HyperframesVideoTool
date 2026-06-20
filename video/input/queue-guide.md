# Hướng dẫn điền `queue.xlsx`

File queue cho `/video-queue` skill — batch render motion-graphic video. **2-pass workflow** vì có bottleneck gen ảnh manual ở giữa.

> Mỗi row = 1 nguồn video. Header ở row 1, data bắt đầu từ row 2.

---

## 7 cột — cái nào điền, cái nào để queue tự ghi

| Cột | Bắt buộc | Ai điền | Loại giá trị |
|---|---|---|---|
| `source` | ✅ YES | Bạn | Path .txt **hoặc** URL |
| `refine` | ❌ optional | Bạn | `yes` / `no` / empty |
| `title` | ❌ optional | Bạn | text override (max 80 chars) |
| `notes` | ❌ optional | Bạn | free-text ghi chú |
| `status` | — | **Queue tự ghi** | `pending` / `planned` / `done` / `error` |
| `result` | — | **Queue tự ghi** | mp4 paths joined `; ` |
| `error` | — | **Queue tự ghi** | message khi fail |

⚠️ **Đừng tự điền `status` / `result` / `error`** — queue write các cột này. Chỉ touch chúng khi retry (xem mục "Retry workflow" ở dưới).

---

## Chi tiết từng cột

### 1. `source` — BẮT BUỘC

Path tới `.txt` nguồn HOẶC URL bài báo bóng đá.

**✅ Hợp lệ:**
- `video/input/modric-bio/modric-bio.txt` — file .txt tự viết hoặc đã sinh từ `/read-rewrite` / `/refine-txt`
- `https://www.goal.com/vn/news/some-article/12345` — URL bài Goal Vietnam
- `https://www.skysports.com/football/news/...` — URL bài Sky Sports / báo khác
- Path repo-relative dùng forward slash `/` (Windows vẫn OK)

**❌ KHÔNG hợp lệ:**
- Part .txt như `video/input/modric-bio-p1/modric-bio-p1.txt` — **queue tự fan-out parts**, paste path của **base .txt** thôi
- Đường dẫn tuyệt đối `C:/Users/...` — dùng repo-relative
- File không tồn tại
- URL paywall / geo-block / login-required — queue sẽ báo error

**🔄 Source khi là URL sẽ tự update sau Pass 1:** queue chạy `/read-rewrite`, save .txt vào `video/input/<derived-slug>/<derived-slug>.txt`, rồi update cell `source` của row đó tới path mới. Lần chạy sau, queue đọc .txt thay vì fetch lại URL.

---

### 2. `refine` — TÙY CHỌN

`yes` / `no` (hoặc empty = no).

**`yes` khi:**
- Source là ghi chú thô bạn paste linh tinh (FB, copy paragraph, bullet jots)
- Văn chưa chuyên — nhiều fluff: `"Có thể nói rằng..."`, `"đặc biệt"`, em-dash quá nhiều
- Cần normalize phonetic (số → digit form, abbreviation → spell out trong voice)
- Queue sẽ chạy `/refine-txt` trước `/images-for-videos`, backup gốc thành `<slug>.raw.txt`

**`no` / empty khi:**
- Source đã sạch (đã qua `/refine-txt` rồi, hoặc tự viết theo channel voice)
- Source là URL — `/read-rewrite` đã output channel-voice rồi, queue skip `/refine-txt`
- Bio / history tự viết kỹ với title + lead + key facts + context

**Mặc định:** empty = no.

---

### 3. `title` — TÙY CHỌN

Override title video. Empty = dùng **dòng đầu của .txt** làm title.

**Khi điền:**
- Title trong .txt dài > 80 chars (max title cho video metadata)
- Muốn title video khác title bài viết (vd .txt là news rewrite nhưng video muốn punchy hook hơn)
- A/B test 2 title cho cùng 1 source

**Khi để trống:**
- Default. `/create-video` tự lấy từ dòng đầu .txt.

---

### 4. `notes` — TÙY CHỌN

Ghi chú riêng của bạn. Queue **không đọc**, chỉ để bạn tự tổ chức.

**Ví dụ:**
- `"Upload thứ Năm tuần này"`
- `"Part 1 của series Modric — đợi Part 2 trước khi up"`
- `"Test prompt poster style mới"`
- `"Ưu tiên cao — viral pick"`
- `"Cần review prompt hook trước khi gen ảnh"`

---

### 5. `status` — QUEUE TỰ GHI

| Giá trị | Ý nghĩa |
|---|---|
| empty / `pending` | Chưa xử lý — Pass 1 sẽ pick up |
| `planned` | Pass 1 xong: .txt + images-plan.json + anh-can-tao.md đã sẵn. **Chờ bạn gen ảnh.** |
| `done` | Pass 2 xong: mp4 đã render. Path ở cột `result`. |
| `error` | Fail. Xem cột `error` để biết lý do. |

---

### 6. `result` — QUEUE TỰ GHI

Mp4 output paths sau Pass 2.

**Format:**
- **Single video:** `video/output/alt-pl-team-25-26/video.mp4`
- **Multi-part (auto-split):** `video/output/modric-bio-p1/video.mp4; video/output/modric-bio-p2/video.mp4` — paths joined bởi `; `

---

### 7. `error` — QUEUE TỰ GHI

Message khi `status=error`. Đọc để biết step nào fail + cách fix.

**Ví dụ messages:**
- `"source not found: video/input/xyz/xyz.txt"` → fix path
- `"URL fetch failed: 404"` → URL chết, đổi nguồn
- `"< 3 distinct points — too thin"` → source quá ít content, viết thêm
- `"part 2 fail: TTS timeout"` → multi-part, part 2 lỗi (part 1 trong `result` vẫn ok); retry sau

---

## 4 pattern điển hình

### Pattern A — URL bài báo
```
source: https://www.goal.com/vn/news/some-article/12345
refine: (empty)
title:  (empty)
notes:  Upload hôm nay
```
Queue Pass 1: WebFetch → rewrite VN → save `.txt` → plan ảnh. Source cell được tự update tới `.txt` path mới.

---

### Pattern B — Ghi chú thô của bạn
```
source: video/input/bruno-notes/bruno-notes.txt
refine: yes
title:  (empty)
notes:  Notes paste từ FB, cần polish
```
Pre-step: Tạo folder `video/input/bruno-notes/`, paste ghi chú vào `bruno-notes.txt`.
Queue Pass 1: `/refine-txt` (backup + polish in place) → `/images-for-videos` → plan ảnh.

---

### Pattern C — Bio dài → auto-split
```
source: video/input/modric-bio/modric-bio.txt
refine: (empty)
title:  Hành trình Modric
notes:  Bio 9k chars, sẽ auto-split ~3 parts
```
Pre-step: Tự viết bio chỉn chu vào `.txt` (≥ 4 000 chars để trigger auto-split).
Queue Pass 1: `/images-for-videos` detect ≥4k → fan-out thành `<slug>-p1/`, `<slug>-p2/`, … mỗi part 1 folder với plan riêng.
Queue Pass 2: render từng part. Result cell ghi N mp4 paths.

---

### Pattern D — `.txt` sạch + plan đã có sẵn (skip Pass 1)
```
source: video/input/ranking-xyz/ranking-xyz.txt
refine: (empty)
title:  (empty)
notes:  Đã chạy /images-for-videos manually + gen ảnh xong
status: planned       ← SET THẲNG
```
**Set thủ công `status=planned`** để queue bỏ qua Pass 1.
Queue Pass 2: verify ảnh đủ → render.

---

## Workflow recap

```
1. Mở video/input/queue.xlsx
2. Add row — chỉ điền source (+ optional refine/title/notes)
3. /video-queue  (lần 1)
   → status=planned cho mỗi row
   → queue list folder cần gen ảnh
4. Gen ảnh trên grok.com per folder, xem anh-can-tao.md (checklist) — prompt English ở images-plan.json
5. /video-queue  (lần 2)
   → verify ảnh, render → status=done, result=mp4 paths
6. Đọc cột result → upload mp4
```

---

## Retry workflow

| Tình huống | Cách fix |
|---|---|
| Row `error` → muốn retry | Clear cell `status` + `error`, chạy `/video-queue` |
| Done row muốn re-render (đổi voice / engine / SFX) | Clear cell `status`. Pass 2 sẽ render lại. |
| Muốn re-plan (re-split, re-pick scenes) | Xóa folder `<slug>-pN/` (giữ source .txt gốc), clear status, `/video-queue` |
| Một part trong multi-part fail | Status=error, result=succeeded parts. Fix lỗi → clear status + error → /video-queue → queue render lại các part fail. |
| Đổi source path | Edit cell `source`, clear status, `/video-queue` |

---

## Helper CLI — add/edit row không cần mở Excel

Trong PowerShell:

```powershell
# List tất cả rows (JSON)
npm run video-queue --silent -- list

# Add row mới (rowIdx phải > số row hiện có)
npm run video-queue -- set 4 source="video/input/abc/abc.txt"
npm run video-queue -- set 4 refine=yes title="Tiêu đề override" notes="Test row"

# Update status (retry):
npm run video-queue -- set 3 status=""

# Reset row sau error:
npm run video-queue -- set 3 status="" error=""
```

**Lưu ý:** `set` ghi 1 row mỗi lệnh nhưng nhiều `key=value` cùng lúc OK. Empty value (`status=""`) xóa cell.

---

## Câu hỏi nhanh

**Q: Add row mới hàng loạt — Excel hay CLI?**
A: Excel tiện hơn cho >5 rows (copy-paste columns). CLI tiện cho 1-2 rows hoặc script tự động.

**Q: Mặc định save .xlsx có tự reload trong Claude / queue không?**
A: Có. Mỗi lần `/video-queue` hoặc `set` đọc/ghi lại file. Không cần restart.

**Q: Row trống có sao không?**
A: Queue skip row có `source` empty. Tránh để row trống giữa data — Excel có thể giữ nhưng visual khó nhìn.

**Q: Xóa row hẳn?**
A: Trong Excel: right-click row number → Delete row. Trong CLI: không có `delete` subcommand — chỉ có `set source=""` (giữ row trống) hoặc edit Excel.

**Q: Multi-part bio xong rồi, có 3 mp4 — upload thế nào?**
A: Result cell ghi 3 paths join `; `. Mở từng path, upload Part 1 trước. Part 2 cách 12-24h. Part 3 cách Part 2 12-24h. (TikTok algo thưởng series.)

**Q: Render 1 row nhanh hơn cách nào — /video-queue hay /create-video trực tiếp?**
A: `/create-video` trực tiếp nhanh hơn (skip xlsx I/O overhead). Nhưng queue track state — done rows skip lần sau. Nếu định render nhiều row trong session, dùng queue. 1-off thì /create-video.
