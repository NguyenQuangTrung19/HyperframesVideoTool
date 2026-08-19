# Ảnh cần tạo — 9 phương án thay Vinícius Júnior cho Arsenal (8 ảnh)

Gen trên grok.com (Imagine) hoặc lấy ảnh thật (Getty…). **Tỉ lệ nào cũng được** — pipeline tự đo và vẽ khung ĐÚNG tỉ lệ ảnh gốc: ảnh `hook` là ảnh full-bleed DUY NHẤT nên ưu tiên **dọc 9:16 / 2:3**; ảnh body (`stat-hero` / `callout` / `feature-list`) luôn vào **thẻ bo góc giữa khung — không cắt, không méo**, nền là chính ảnh đó làm mờ. Ngang 16:9 cho thẻ to hơn, dọc 2:3 cho thẻ cao hơn, cả hai đều đẹp. Save đúng tên file dưới đây vào folder này; đuôi .png/.jpg/.jpeg/.webp/.avif đều được.

- [ ] `hook-1.png` + `hook-2.png` — split-frame: **hook-1** Vinícius Júnior (Real Madrid) · **hook-2** Mikel Arteta (HLV Arsenal). Gen 2 ảnh 1 người, pipeline tự ghép.
- [ ] `alt-yildiz.png` — Kenan Yildiz (Juventus, tuyển Thổ Nhĩ Kỳ), 11 bàn 9 kiến tạo
- [ ] `alt-williams.png` — Nico Williams (Athletic Club, tuyển Tây Ban Nha), điều khoản 90 triệu euro
- [ ] `alt-abde.png` — Abde Ezzalzouli (Real Betis, tuyển Ma-rốc), 10 bàn 8 kiến tạo La Liga
- [ ] `alt-godts.png` — Mika Godts (Ajax, tuyển Bỉ), 17 bàn 13 kiến tạo Eredivisie
- [ ] `alt-ndiaye.png` — Iliman Ndiaye (Everton, tuyển Senegal), 73 pha rê bóng thành công
- [ ] `alt-elmala.png` — Saïd El Mala (FC Köln, 19 tuổi), 13 bàn sau 34 trận Bundesliga

> ⚠️ ĐỪNG đặt tên ảnh kiểu `wing-1` / `wing-2` cho các scene RIÊNG BIỆT. `npm run images:combine` (chạy tự động đầu `images:stage`) gộp mọi cặp `<stem>-1` + `<stem>-2` thành `<stem>.png`, nên `wing-1`+`wing-2` bị hiểu nhầm là ảnh split-frame. Dùng tên có định danh (`alt-yildiz`…) cho scene rời.
- [ ] `ngoai-luong-1.png` + `ngoai-luong-2.png` — split-frame 2 phương án ngoài luồng: **-1** Jack Grealish (Manchester City) · **-2** Marcus Rashford (Manchester United)

> ⚠️ Vinícius Júnior đã lên hình ở 2 video trước (row 41, 55). Ảnh `hook-1` lần này nên khác ngữ cảnh — Vinícius trong màu áo Real Madrid ăn mừng / ký hợp đồng mới, KHÔNG dùng lại ảnh cũ.
> Sau khi gen xong 2 cặp split-frame, chạy `npm run images:combine -- video/input/9-phuong-an-thay-vinicius-cho-arsenal` để ghép trước khi stage.
