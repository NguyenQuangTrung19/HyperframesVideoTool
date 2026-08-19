# Ảnh cần tạo — Tin chuyển nhượng 18/8: Chelsea hét giá Neto, MU nhắm Casado (6 ảnh, 7 file)

Gen trên grok.com (Imagine) hoặc lấy ảnh thật (Getty…). **Tỉ lệ nào cũng được** — pipeline tự đo và vẽ khung đúng tỉ lệ ảnh gốc: ảnh `hook` là ảnh full-bleed DUY NHẤT nên ưu tiên **dọc 9:16 / 2:3**; ảnh body (`stat-hero`) luôn vào **thẻ bo góc giữa khung — không cắt, không méo**. Save đúng tên file vào folder này; đuôi .png/.jpg/.jpeg/.webp/.avif đều được.

- [ ] `hook-1.png` — Pedro Neto trong màu áo Chelsea (nửa TRÁI khung ghép)
- [ ] `hook-2.png` — Enzo Fernández trong màu áo Chelsea (nửa PHẢI khung ghép)
- [ ] `casado.png` — Marc Casado, tiền vệ Barcelona
- [ ] `enzo.png` — Enzo Fernández, Chelsea — mục tiêu hơn 120 triệu bảng của Manchester City
- [ ] `neto.png` — Pedro Neto, Chelsea — giá gần 100 triệu bảng, Al-Hilal vào cuộc
- [ ] `bruno.png` — Bruno Fernandes, đội trưởng Manchester United — lời mời lương 18,3 triệu bảng/mùa từ Galatasaray
- [ ] `kane.png` — Harry Kane, Bayern Munich — đàm phán gia hạn hợp đồng

Ghi chú:
- `hook` là khung ghép đôi: gen `hook-1` (trái) + `hook-2` (phải), `npm run images:stage` tự ghép thành `hook.png`. Hoặc thả thẳng 1 ảnh 2 người tên `hook.png`.
- **Pedro Neto đã lên hình ở video row 53 (`tottenham-tranh-pedro-neto-voi-man-city`)** — gen ảnh KHÁC ngữ cảnh lần này (ví dụ cận cảnh trên sân Stamford Bridge thay vì ảnh tranh chấp), tránh dùng lại đúng một ảnh cho 2 clip.
- 4 mục còn lại của bản tin (Como mượn Moise Kean 25 triệu bảng, West Ham chốt Joel Piroe, AC Milan mua Diego Moreira 34 triệu bảng, Jamie Vardy tự do) gom vào 1 scene `feature-list` KHÔNG ảnh — không cần gen gì thêm.
