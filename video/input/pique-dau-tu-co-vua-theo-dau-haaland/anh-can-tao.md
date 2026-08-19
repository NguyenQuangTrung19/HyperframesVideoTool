# Ảnh cần tạo — Piqué đổ tiền vào cờ vua, đi sau Haaland một bước (5 ảnh, 6 file)

Gen trên grok.com (Imagine) hoặc lấy ảnh thật (Getty…). **Tỉ lệ nào cũng được** — pipeline tự đo và vẽ khung đúng tỉ lệ ảnh gốc: ảnh `hook` là ảnh full-bleed DUY NHẤT nên ưu tiên **dọc 9:16 / 2:3**; ảnh body (`stat-hero` / `callout`) luôn vào **thẻ bo góc giữa khung — không cắt, không méo**. Save đúng tên file vào folder này; đuôi .png/.jpg/.jpeg/.webp/.avif đều được.

- [ ] `hook-1.png` — Gerard Piqué, cựu trung vệ Barcelona, phong thái doanh nhân (nửa TRÁI khung ghép)
- [ ] `hook-2.png` — Erling Haaland, tuyển Na Uy (nửa PHẢI khung ghép)
- [ ] `pique-knights.png` — Gerard Piqué họp báo ở Bengaluru, Ấn Độ — công bố cổ phần đội cờ vua PBG Alaskan Knights
- [ ] `haaland-gambits.png` — Erling Haaland, cổ đông đội cờ vua American Gambits
- [ ] `borge.png` — Morten Borge, nhà đầu tư Na Uy hậu thuẫn Haaland trong dự án cờ vua
- [ ] `chess-league.png` — Global Chess League: bàn cờ thi đấu dưới ánh đèn sân khấu, mùa thứ tư tại Bengaluru

Ghi chú:
- `hook` là khung ghép đôi: gen 2 ảnh đơn `hook-1` (trái) + `hook-2` (phải), `npm run images:stage` tự ghép thành `hook.png`. Muốn nhanh thì thả thẳng 1 ảnh 2 người tên `hook.png`.
- Ảnh `borge` nếu không tìm được mặt Morten Borge thì gen cảnh nhà đầu tư Bắc Âu bên bàn cờ, không cần lock mặt.
- Bài này là tin NGOÀI sân cỏ (đầu tư cờ vua), nên tránh ảnh Piqué/Haaland đang thi đấu — ưu tiên vest, họp báo, bàn cờ.
