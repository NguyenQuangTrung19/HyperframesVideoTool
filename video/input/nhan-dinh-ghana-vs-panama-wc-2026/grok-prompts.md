# Grok prompts — Nhận định Ghana vs Panama — World Cup 2026: dự đoán tỷ số, đội hình và những cái tên đáng xem

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

> ⚠️ Hook làm theo kiểu **split ghép từ 2 ảnh đơn**: gen `hook-1` (Semenyo, nửa trái) + `hook-2` (Ismael Diaz, nửa phải) — mỗi ảnh 1 người, khung **chính diện, đầu ở 1/3 trên** để cắt đôi không mất mặt. Lúc chạy `images:stage` pipeline tự ghép `hook-1` + `hook-2` → `hook.png` (trái | vạch vàng | phải). KHÔNG cần gen `hook.png` thủ công.

## [1a] hook-1 → `hook-1.png` — Antoine Semenyo (Ghana, nửa TRÁI)
**Subject:** Antoine Semenyo — mũi nhọn tốc độ của Ghana

```
Vertical 9:16 football poster artwork featuring Antoine Semenyo, the Ghanaian forward for the Ghana national team, framed chest-up and centered with his head in the upper third, in a confident determined pose ready to sprint. He wears the white Ghana home kit with the GFA crest clearly visible on the chest. Background: bold red-gold-green Ghana national-color blocks with a huge stylized GFA crest floating faintly as a watermark, dramatic light rays radiating outward. Vibrant saturated red-gold-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Ghana GFA crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [1b] hook-2 → `hook-2.png` — Ismael Diaz (Panama, nửa PHẢI)
**Subject:** Ismael Diaz — Vua phá lưới Gold Cup của Panama

```
Vertical 9:16 football poster artwork featuring Ismael Diaz, the Panamanian forward for the Panama national team, framed chest-up and centered with his head in the upper third, in a dynamic confident attacking stance. He wears the red Panama home kit with the FEPAFUT crest clearly visible on the chest. Background: bold red-white-blue Panama national-color blocks with a huge stylized FEPAFUT crest floating faintly as a watermark, dramatic light rays radiating outward. Vibrant saturated red-white-blue palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Panama FEPAFUT crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [2] semenyo → `semenyo.png`
**Subject:** Antoine Semenyo, mũi nhọn tốc độ của Ghana

```
Vertical 9:16 football poster artwork featuring Antoine Semenyo, Ghanaian forward of Bournemouth and the Ghana national team, in a powerful driving-forward pose mid-stride as if bursting past a defender, wearing the white Ghana home kit. Backdrop built from bold red-gold-green national-color blocks, a huge faint GFA crest watermark filling the frame and dramatic light rays bursting from behind him, subtle motion-blur energy lines suggesting speed. Cinematic poster lighting, ultra sharp focus, photoreal detail on the face shot on an 85mm prime look, no AI smoothness. The Ghana crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [3] ayew → `ayew.png`
**Subject:** Jordan Ayew, đội trưởng và đầu tàu hàng công Ghana

```
Vertical 9:16 football poster artwork featuring Jordan Ayew, captain and forward of the Ghana national team, in a commanding leadership pose with chest out and the captain's armband on his arm, wearing the white Ghana home kit. Backdrop built from rich red-gold-green national-color blocks, a huge faint GFA crest watermark behind him and warm golden light rays fanning out, giving a regal captain-of-the-Black-Stars feel. Cinematic poster lighting, ultra sharp focus, photoreal face on an 85mm prime look, no AI smoothness. The Ghana crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [4] diaz → `diaz.png`
**Subject:** Ismael Diaz, Vua phá lưới Gold Cup của Panama

```
Vertical 9:16 football poster artwork featuring Ismael Diaz, attacking forward of the Panama national team, in a sharp goal-celebration pose with arms spread wide, wearing the red Panama home kit. Backdrop built from bold red-white-blue national-color blocks, a huge faint FEPAFUT crest watermark filling the frame and bright light rays exploding behind him, a clinical golden-boot striker energy. Cinematic poster lighting, ultra sharp focus, photoreal face on an 85mm prime look, no AI smoothness. The Panama crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [5] queiroz → `queiroz.png`
**Subject:** Carlos Queiroz, huấn luyện viên Ghana, trận phải thắng

```
Vertical 9:16 football poster artwork featuring Carlos Queiroz, veteran Portuguese head coach of the Ghana national team, in a focused touchline pose wearing a dark Ghana training jacket with the GFA crest, arms gesturing instructions with intense expression. Backdrop built from red-gold-green national-color blocks, a huge faint GFA crest watermark and dramatic spotlight rays from above, conveying experienced authority on the sideline. Cinematic poster lighting, ultra sharp focus, photoreal face on an 85mm prime look, no AI smoothness. The Ghana crest visible on the jacket, no on-image text or captions, no scoreboard graphics.
```

## [6] christiansen → `christiansen.png`
**Subject:** Thomas Christiansen, huấn luyện viên Panama, tôn trọng Ghana

```
Vertical 9:16 football poster artwork featuring Thomas Christiansen, head coach of the Panama national team, in a composed touchline pose wearing a dark Panama training jacket with the FEPAFUT crest, calm confident expression with arms folded. Backdrop built from red-white-blue national-color blocks, a huge faint FEPAFUT crest watermark and clean spotlight rays from above, conveying a disciplined organized leader. Cinematic poster lighting, ultra sharp focus, photoreal face on an 85mm prime look, no AI smoothness. The Panama crest visible on the jacket, no on-image text or captions, no scoreboard graphics.
```

## Tiếp theo
Mở 7 tab song song trên grok.com (Imagine), aspect ratio **9:16**, dán mỗi prompt một tab và tạo đồng loạt. Lưu 7 ảnh về đúng folder này theo đúng tên file (`hook-1.png`, `hook-2.png`, `semenyo.png`, `ayew.png`, `diaz.png`, `queiroz.png`, `christiansen.png`) — KHÔNG cần `hook.png`, pipeline tự ghép từ `hook-1` + `hook-2`.

Xong chạy:
`/create-video video/input/nhan-dinh-ghana-vs-panama-wc-2026/nhan-dinh-ghana-vs-panama-wc-2026.txt`
hoặc gom vào `/video-queue`.
