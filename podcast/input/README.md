# Hướng dẫn điền `queue.xlsx`

File này nằm cạnh `queue.xlsx` để tra nhanh khi cần. Sau khi điền xong, mở terminal ở repo root và chạy:

```bash
npm run podcast-queue
```

Script chỉ xử lý các row có `story` được điền + `status` đang trống.

---

## Cheat sheet — 6 cột

| Cột | Bắt buộc? | Điền gì | Bỏ trống nghĩa là |
|---|---|---|---|
| `story` | ✅ | Đường dẫn tới file `.txt` kịch bản podcast | Row bị skip (không phải pending) |
| `concept` | ❌ | 1 trong 4: `football` / `world` / `deep` / `anime`. Hoặc nested subfolder: `football/<player>` (vd `football/neymar`) / `anime/<series>` (vd `anime/naruto`) | Random đều giữa 4 concept không rỗng |
| `orientation` | ❌ | `landscape` / `portrait` | Pipeline tự ffprobe phát hiện từ video pick được |
| `videos` | ❌ | Path tới 1–3 video cụ thể (manual override) | Script tự random pick từ thư viện theo `concept` |
| `status` | ⚙️ output | (đừng điền) | Row đang pending, sẽ được xử lý |
| `result` | ⚙️ output | (đừng điền) | (chưa chạy) |

> ⚙️ = script tự ghi sau khi xử lý xong.

---

## Cột 1 — `story` (bắt buộc)

Path tới file `.txt` chứa kịch bản podcast.

| Dạng path | Ví dụ |
|---|---|
| Tương đối với repo root (khuyến khích) | `podcast/input/story/pep-tribute.txt` |
| Chỉ tên file (nếu đã trong `story/`) | ❌ KHÔNG được, phải có path đầy đủ |
| Tuyệt đối | `C:\Users\ACER\Documents\Workspace\Projects\GenVideo\Auto-Create-Video\podcast/input/story\pep-tribute.txt` |

> **Tip:** trong Windows Explorer, Shift + chuột phải vào file → "Copy as path" → paste vào cell. Sau đó có thể cắt phần đầu thành relative cho gọn.

> Slug (tên video output) = basename của file `.txt`. Ví dụ `pep-tribute.txt` → output ở `podcast/output/pep-tribute/pep-tribute.mp4`.

---

## Cột 2 — `concept` (tùy chọn)

Chọn thư viện để pick video ngẫu nhiên khi `videos` để trống. Mỗi concept = 1 folder dưới `podcast/input/`. **Bạn tự quyết định concept nào tồn tại** bằng cách tạo folder và bỏ video vào.

| Giá trị | Pick từ | Cách setup |
|---|---|---|
| `<tên-folder>` | `podcast/input/<tên-folder>/` (flat — không đệ quy) | Tạo folder `podcast/input/<tên-folder>/`, bỏ `.mp4`/`.mov` vào. Vd `naruto/`, `neymar/`, `world/`, `deep/`. |
| (trống) hoặc `random` | Random đều giữa tất cả concept folder không-rỗng | Khi không quan tâm. **Lưu ý**: random có thể ghép tone trật — concept cụ thể vẫn an toàn hơn. |

**Ví dụ setup:**
```
podcast/input/
├── football/   ← bỏ video bóng đá → concept=football
├── naruto/     ← bỏ clip naruto → concept=naruto
├── neymar/     ← bỏ clip neymar → concept=neymar
├── deep/       ← bỏ cảnh tâm trạng → concept=deep
├── world/      ← bỏ scenery / city → concept=world
├── story/      ← (reserved) script .txt
└── queue.xlsx
```

> **Tone matching matters.** Script buồn / tribute nên có folder tone-buồn riêng (vd `deep/`); script vui dùng folder tone-vui (vd `world/`). Code không tự enforce — bạn pick concept đúng tone trong cột này.
>
> **Flat only.** KHÔNG còn nested subfolder (vd `football/neymar` đã bỏ từ 2026-05-25). Flatten thành tên folder duy nhất — vd thay vì `anime/naruto` thì tạo folder `podcast/input/naruto/` và ghi `concept=naruto`.
>
> Concept cũ `views` / `nature` đã bị bỏ — row dùng chúng sẽ Error với hint.
>
> `story` là reserved name (cho .txt script), không phải concept.
>
> Nếu điền `videos` thủ công thì cột này bị bỏ qua hoàn toàn.

---

## Cột 3 — `orientation` (tùy chọn)

Ép pipeline render theo orientation cụ thể, đồng thời filter library chỉ pick video đúng orientation đó.

| Giá trị | Behavior |
|---|---|
| (trống) hoặc `auto` | Pipeline ffprobe video đầu → tự chọn layout (`width > height` = landscape) |
| `landscape` / `16:9` / `horizontal` | Filter library chỉ pick video 16:9 + ép pipeline dùng landscape layout |
| `portrait` / `9:16` / `vertical` | Filter library chỉ pick video 9:16 + ép layout portrait (theo `PODCAST_LAYOUT`) |

> Trong library có cả 9:16 lẫn 16:9 mà không filter thì pipeline render theo aspect của file pick được — kết quả có thể bất ngờ.

---

## Cột 4 — `videos` (manual override)

**Để trống** → script random pick từ `concept` folder. Đây là default.

**Điền path** → dùng đúng các file đó, bỏ qua picker + bỏ qua filter orientation.

### Định dạng path (giống cột `story`)

| Dạng | Ví dụ |
|---|---|
| Tương đối từ repo root | `podcast/input/views/sunset.mp4` |
| Tuyệt đối | `D:\footage\sunset.mp4` |
| Mix `\` và `/` | OK |

### Cách nối nhiều path trong 1 cell

| Separator | Khi dùng |
|---|---|
| `;` | Mặc định (script tự ghi dạng này) |
| `,` | Cũng được, dễ gõ |
| Xuống dòng (Alt + Enter) | Dễ đọc trong Excel khi có 3 file |

3 cách dưới đây tương đương nhau:

```
podcast/input/world/a.mp4;podcast/input/world/b.mp4;podcast/input/world/c.mp4
```
```
podcast/input/world/a.mp4, podcast/input/world/b.mp4, podcast/input/world/c.mp4
```
```
podcast/input/world/a.mp4
podcast/input/world/b.mp4
podcast/input/world/c.mp4
```

### Giới hạn

- **Tối đa 3 file** mỗi row (giới hạn pipeline). 4+ file → 3 đầu tiên được dùng, log cảnh báo.
- **Extension hỗ trợ**: `.mp4`, `.mov`, `.webm`, `.mkv`, `.m4v`. Sai extension → row Error.
- **File phải tồn tại** lúc script chạy.
- **Thứ tự quan trọng**: video 1 phát trước, hết thì sang video 2, rồi video 3, loop nếu TTS chưa kết thúc.

---

## Các kịch bản thường gặp — copy luôn vào cell

### Kịch bản A: Để script tự lo hết (đơn giản nhất)

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/pep-tribute.txt` | `deep` | (trống) | (trống) |

→ Script random pick 1–3 video từ `deep/` (cảnh tâm trạng, hợp tribute), layout auto theo video pick được.

### Kịch bản B: Concept cụ thể (folder = concept)

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/match-recap.txt` | `football` | (trống) | (trống) |

→ Pick từ `podcast/input/football/` (flat, không recurse). Layout auto.

### Kịch bản B2: Story về 1 cầu thủ / 1 nhân vật cụ thể

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/neymar-tribute.txt` | `neymar` | (trống) | (trống) |

→ Trước đó bạn tạo folder `podcast/input/neymar/` và bỏ clip Neymar vào. Pick chỉ từ folder đó.

### Kịch bản B3: Story về 1 anime series cụ thể

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/naruto-arc.txt` | `naruto` | (trống) | (trống) |

→ Tạo folder `podcast/input/naruto/`, bỏ clip vào. Pick chỉ từ đó.

### Kịch bản C: Ép landscape, để script pick

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/tactical.txt` | `football` | `landscape` | (trống) |

→ Script CHỈ pick video 16:9 trong `football/`. Nếu không có file 16:9 nào → row Error.

### Kịch bản D: Chỉ định cụ thể 1 video

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/intro.txt` | (kệ) | (trống) | `podcast/input/world/intro-clip.mp4` |

→ Dùng đúng file đó. Concept bị bỏ qua.

### Kịch bản E: 3 video cụ thể, cùng orientation

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/long-form.txt` | (kệ) | (trống) | `podcast/input/football/clip-a.mp4;podcast/input/football/clip-b.mp4;podcast/input/football/clip-c.mp4` |

→ 3 file chạy tuần tự theo thứ tự a → b → c, loop nếu TTS dài hơn tổng duration.

### Kịch bản F: 3 video từ folder ngoài, ép landscape

| story | concept | orientation | videos |
|---|---|---|---|
| `podcast/input/story/special.txt` | (kệ) | `landscape` | `D:\raw\highlight1.mp4;D:\raw\highlight2.mp4;D:\raw\highlight3.mp4` |

→ Dùng đúng 3 file đó. `orientation=landscape` ép pipeline dùng landscape layout (kể cả nếu ffprobe nghĩ khác).

---

## No-repeat trong 1 batch

Trong **1 lần chạy** `npm run podcast-queue`, mỗi video chỉ được pick **1 lần** xuyên suốt tất cả row pending. Ví dụ:

| Row | Video pick được |
|---|---|
| Row 2 (story1.txt) | `world1.mp4`, `world2.mp4`, `world3.mp4` |
| Row 3 (story2.txt) | `world4.mp4`, `world5.mp4` *(skip world1-3)* |
| Row 4 (story3.txt) | `world6.mp4`, `world7.mp4`, `world8.mp4` *(skip world1-5)* |

- **Manual videos** (cột `videos` điền tay) cũng tính vào pool đã dùng — row sau không pick lại.
- **Library cạn** (vd batch cần 15 pick nhưng library chỉ có 10 video): script log warning `no-repeat pool cạn — cho phép re-use` và fallback cho phép lặp lại để batch không fail.
- **Reset mỗi lần chạy**: pool đã dùng KHÔNG persist qua các lần `npm run podcast-queue` khác nhau. Hôm sau chạy lại là pool sạch — `world1.mp4` có thể được pick lại bình thường.
- **Áp dụng cả 2 mode**: random pick + manual override. Nếu row 2 dùng manual `world1.mp4`, thì row 3 (random) sẽ skip `world1.mp4`.
- **Scope là per-concept folder**: pool no-repeat track theo absolute path, nên cùng tên file ở 2 folder khác nhau (vd `football/match.mp4` vs `world/match.mp4`) là 2 entry riêng.

## Sau khi script chạy xong

Script tự ghi vào 3 cột output:

| Cột | Done | Error |
|---|---|---|
| `videos` | Path các video đã pick (nếu manual thì = path anh đã điền) | (giữ nguyên) |
| `status` | `Done` | `Error` |
| `result` | Path tới file mp4 cuối (vd `podcast/output/pep-tribute/pep-tribute.mp4`) | Lý do lỗi ngắn gọn (VN) |

---

## Retry row

| Muốn | Cách |
|---|---|
| Re-run với pick mới hoàn toàn | Clear cả `status` lẫn `videos` |
| Re-run với CÙNG video đã pick lần trước | Clear chỉ `status`, giữ `videos` |
| Bỏ qua row | Để `status=Skip` (hoặc bất kỳ giá trị nào khác trống) |

---

## Troubleshooting

| Lỗi trong `result` | Nguyên nhân |
|---|---|
| `story không tồn tại: <path>` | Path sai hoặc file đã bị xóa |
| `story phải là .txt` | Path không trỏ đến file `.txt` |
| `manual video không tồn tại: <path>` | Path trong cột `videos` sai |
| `manual video sai định dạng: <path>` | Extension không phải `.mp4/.mov/.webm/.mkv/.m4v` |
| `pick video lỗi: không có video ... trong <folder>` | Folder concept rỗng hoặc orientation filter loại hết |
| `concept '<x>' không tồn tại — tạo folder podcast/input/<x>/ ...` | Bạn chưa tạo folder concept này. Output sẽ liệt kê các folder hiện có. |
| `concept '<x>' không hỗ trợ nested subfolder nữa — flatten ...` | Row dùng cú pháp cũ `football/neymar` hoặc `anime/naruto`. Tạo folder flat `podcast/input/neymar/`, ghi `concept=neymar`. |
| `concept 'views' đã bị bỏ ...` / `concept 'nature' đã bị bỏ ...` | Concept cũ — chuyển video sang folder mới và đặt tên tương ứng. |
| `concept '<x>' là reserved folder name` | `story` là reserved — không phải concept. |
| `không có concept folder nào trong podcast/input/ có video` | Toàn bộ folder concept đều rỗng — random fallback không pick được gì. |
| `probe manual video lỗi (<file>): ...` | ffprobe không đọc được file (corrupt / sai codec) |
| `pipeline xong nhưng không thấy <path>` | Pipeline tự nó fail giữa chừng — xem log terminal |

---

## Xem thêm

- Skill `/podcast-queue` (`.claude/skills/podcast-queue/SKILL.md`) — tài liệu kỹ thuật cho Claude.
- Skill `/create-podcast` (`.claude/skills/create-podcast/SKILL.md`) — env vars tinh chỉnh pipeline (TTS, font, layout chi tiết).
