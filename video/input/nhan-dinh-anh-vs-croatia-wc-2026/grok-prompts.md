# Grok prompts — Nhận định Anh vs Croatia — World Cup 2026: dự đoán tỷ số, đội hình và những cái tên đáng xem

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

> ⚠️ Hook làm theo kiểu **split ghép từ 2 ảnh đơn**: gen `hook-1` (Kane, nửa trái) + `hook-2` (Modric, nửa phải) — mỗi ảnh 1 người, khung **chính diện, đầu ở 1/3 trên** để cắt đôi không mất mặt. Lúc chạy `images:stage` pipeline tự ghép `hook-1` + `hook-2` → `hook.png` (trái | vạch vàng | phải). KHÔNG cần gen `hook.png` thủ công.

## [1a] hook-1 → `hook-1.png` — Harry Kane (Anh, nửa TRÁI)
**Subject:** Harry Kane — đội trưởng tuyển Anh, mũi nhọn

```
Vertical 9:16 football poster artwork featuring Harry Kane, the English centre-forward and captain for the England national team, framed chest-up and centered with his head in the upper third, in a determined hero pose with fists clenched. He wears the white England home kit with the Three Lions crest clearly visible on the chest and the captain's armband. Background: bold deep navy-and-white England colour blocks with a huge stylized Three Lions crest floating faintly as a watermark, dramatic white light rays radiating outward. Vibrant saturated navy-and-white palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The England Three Lions crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [1b] hook-2 → `hook-2.png` — Luka Modric (Croatia, nửa PHẢI)
**Subject:** Luka Modric — đội trưởng, nhạc trưởng Croatia

```
Vertical 9:16 football poster artwork featuring Luka Modric, the Croatian central midfielder and captain for the Croatia national team, framed chest-up and centered with his head in the upper third, in a calm commanding pose pointing forward to direct play. He wears the red-and-white checkerboard Croatia home kit with the HNS crest clearly visible on the chest and the captain's armband. Background: bold red-and-white checkerboard colour blocks with a huge stylized HNS crest floating faintly as a watermark, warm light rays radiating outward. Vibrant saturated red-and-white palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Croatia HNS crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [2] kane → `kane.png`
**Subject:** Harry Kane mũi nhọn tuyển Anh, 8 bàn ở hai kỳ World Cup gần nhất

```
Vertical 9:16 football poster artwork featuring Harry Kane, England captain and centre-forward of Bayern Munich and the England national team, in the England white home kit, captured mid-stride in a powerful goal-poaching pose with arms spread in celebration. Behind him a dramatic graphic backdrop of layered navy-and-white colour blocks, a huge faint Three Lions crest watermark filling the upper frame, and dynamic white light rays bursting outward. Bold stadium-poster lighting, crisp sharp focus, premium sports-graphic composition. The England crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [3] modric → `modric.png`
**Subject:** Luka Modric nhạc trưởng Croatia, 40 tuổi, kỷ lục 196 lần khoác áo tuyển

```
Vertical 9:16 football poster artwork featuring Luka Modric, Croatia captain and central midfielder of the national team, in the Croatia red-and-white checkerboard home kit, in a composed playmaker pose surveying the pitch with one arm raised to direct play. Behind him a striking graphic backdrop of bold red-and-white checkerboard colour blocks, a huge faint HNS crest watermark, and warm light rays radiating across the frame. Veteran-maestro mood, sharp focus, premium sports-graphic composition. The Croatia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [4] bellingham → `bellingham.png`
**Subject:** Jude Bellingham đầu tàu sáng tạo tuyến giữa tuyển Anh

```
Vertical 9:16 football poster artwork featuring Jude Bellingham, England attacking midfielder of Real Madrid and the England national team, in the England white home kit, in an intense driving pose surging forward with the ball, chest out and eyes locked ahead. Behind him a bold graphic backdrop of navy-and-white colour blocks, a huge faint Three Lions crest watermark, and energetic light rays streaking across the frame. Dynamic youthful power, sharp focus, premium sports-graphic composition. The England crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [5] tuchel → `tuchel.png`
**Subject:** HLV Thomas Tuchel, tuyển Anh, phát biểu họp báo trước trận mở màn

```
Vertical 9:16 football poster artwork featuring Thomas Tuchel, head coach of the England national team, wearing a smart dark England-branded coaching jacket, in a focused touchline pose gesturing with one hand as if instructing his players. Behind him a graphic backdrop of navy-and-white colour blocks, a huge faint Three Lions crest watermark, and soft light rays. Authoritative manager mood, sharp focus, premium sports-graphic composition. The England crest visible on the jacket, no on-image text or captions, no scoreboard graphics.
```

## [6] dalic → `dalic.png`
**Subject:** HLV Zlatko Dalic, tuyển Croatia, phát biểu họp báo trước trận mở màn

```
Vertical 9:16 football poster artwork featuring Zlatko Dalic, head coach of the Croatia national team, wearing a dark Croatia-branded coaching jacket, in a thoughtful touchline pose with arms crossed, watching the pitch intently. Behind him a graphic backdrop of red-and-white checkerboard colour blocks, a huge faint HNS crest watermark, and soft light rays. Composed veteran-manager mood, sharp focus, premium sports-graphic composition. The Croatia crest visible on the jacket, no on-image text or captions, no scoreboard graphics.
```

## Tiếp theo
1. Mở **7 tab** trên grok.com (Imagine), gen đồng loạt song song ở aspect ratio **9:16** cho nhanh (~3-5 phút thay vì sequential).
2. Lưu mỗi ảnh về đúng folder này với đúng tên stem: `hook-1.png`, `hook-2.png`, `kane.png`, `modric.png`, `bellingham.png`, `tuchel.png`, `dalic.png` (KHÔNG cần `hook.png` — pipeline tự ghép từ `hook-1` + `hook-2`).
3. Sau khi đủ 7 ảnh, chạy:
   `/create-video video/input/nhan-dinh-anh-vs-croatia-wc-2026/nhan-dinh-anh-vs-croatia-wc-2026.txt`
   hoặc dùng `/video-queue` để render theo hàng đợi.
