# Grok prompts — Nhận định Uzbekistan vs Colombia — World Cup 2026

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

> ⚠️ Hook làm theo kiểu **split ghép từ 2 ảnh đơn**: gen `hook-1` (Shomurodov, nửa trái) + `hook-2` (James Rodriguez, nửa phải) — mỗi ảnh 1 người, khung **chính diện, đầu ở 1/3 trên** để cắt đôi không mất mặt. Lúc chạy `images:stage` pipeline tự ghép `hook-1` + `hook-2` → `hook.png` (trái | vạch vàng | phải). KHÔNG cần gen `hook.png` thủ công.

## [1a] hook-1 → `hook-1.png` — Eldor Shomurodov (Uzbekistan, nửa TRÁI)
**Subject:** Eldor Shomurodov — đội trưởng, chân sút số 1 lịch sử Uzbekistan

```
Vertical 9:16 football poster artwork featuring Eldor Shomurodov, the Uzbek striker and captain for the Uzbekistan national team, framed chest-up and centered with his head in the upper third, in an arms-folded confident hero pose. He wears the white-and-blue Uzbekistan home kit with the UFA crest clearly visible on the chest and the captain's armband. Background: bold blue-white-green Uzbekistan national-color blocks with a huge stylized UFA crest floating faintly as a watermark, dramatic light rays radiating outward. Vibrant saturated blue-white-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Uzbekistan UFA crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [1b] hook-2 → `hook-2.png` — James Rodriguez (Colombia, nửa PHẢI)
**Subject:** James Rodriguez — nhạc trưởng Colombia

```
Vertical 9:16 football poster artwork featuring James Rodriguez, the Colombian playmaker and captain for the Colombia national team, framed chest-up and centered with his head in the upper third, in a composed pose ready to thread a pass. He wears the yellow Colombia home kit with the FCF crest clearly visible on the chest and the captain's armband. Background: bold yellow-blue-red Colombia national-color blocks with a huge stylized FCF crest floating faintly as a watermark, warm light rays radiating outward. Vibrant saturated yellow-blue-red palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Colombia FCF crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [2] james → `james.png`
**Subject:** James Rodriguez — nhạc trưởng Colombia, 7 kiến tạo vòng loại.

```
Vertical 9:16 football poster artwork featuring James Rodriguez, attacking midfielder and playmaker for Colombia, wearing the yellow Colombia home kit with the FCF crest, captured mid-stride preparing to deliver a through ball, composed and commanding posture. Behind him, bold yellow-blue-red national-color blocks, a huge faint FCF crest watermark filling the backdrop, and bright light rays bursting from the center. Polished broadcast-graphic illustration style with crisp edges and rich saturation, dramatic rim lighting on the figure. The Colombia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [3] luis-diaz → `luis-diaz.png`
**Subject:** Luis Diaz — tốc độ Colombia, 7 bàn vòng loại.

```
Vertical 9:16 football poster artwork featuring Luis Diaz, left winger and forward for Colombia, wearing the yellow Colombia home kit with the FCF crest, captured in an explosive sprinting pose driving forward with the ball, dynamic and aggressive energy. Behind him, bold yellow-blue-red national-color blocks, a huge faint FCF crest watermark filling the backdrop, and streaking motion light rays. Vibrant broadcast-graphic illustration style, dramatic stadium-night lighting with a glowing rim on the figure. The Colombia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [4] shomurodov → `shomurodov.png`
**Subject:** Eldor Shomurodov — đội trưởng, chân sút số 1 lịch sử Uzbekistan.

```
Vertical 9:16 football poster artwork featuring Eldor Shomurodov, striker and captain of Uzbekistan, wearing the white and blue Uzbekistan home kit with the UFA crest, captured in a proud chest-out leader's pose with fists clenched. Behind him, bold blue-white-green national-color blocks, a huge faint UFA crest watermark filling the backdrop, and radiating light rays. Heroic broadcast-graphic illustration style with crisp edges, dramatic rim lighting on the figure against a darkened stadium-night background. The Uzbekistan crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

## [5] cannavaro → `cannavaro.png`
**Subject:** HLV Fabio Cannavaro — dẫn dắt Uzbekistan dự World Cup đầu tiên.

```
Vertical 9:16 football poster artwork featuring Fabio Cannavaro, head coach of Uzbekistan, depicted on the touchline in a sharp dark coaching suit, arms crossed with a calm focused expression, dignified manager portrait. Behind him, bold blue-white-green Uzbekistan national-color blocks, a huge faint UFA crest watermark filling the backdrop, and soft light rays. Refined broadcast-graphic illustration style, dramatic stadium-night lighting with a subtle rim glow. A small UFA crest visible as a touchline accent, no on-image text or captions, no scoreboard graphics.
```

## [6] lorenzo → `lorenzo.png`
**Subject:** HLV Nestor Lorenzo — đưa Colombia trở lại World Cup.

```
Vertical 9:16 football poster artwork featuring Nestor Lorenzo, head coach of Colombia, depicted on the touchline in a smart dark coaching jacket, one hand gesturing instructions with a determined expression, authoritative manager portrait. Behind him, bold yellow-blue-red Colombia national-color blocks, a huge faint FCF crest watermark filling the backdrop, and soft light rays. Refined broadcast-graphic illustration style, dramatic stadium-night lighting with a subtle rim glow. A small FCF crest visible as a touchline accent, no on-image text or captions, no scoreboard graphics.
```

## Tiếp theo
Mở 7 tab grok.com song song (đồng loạt), mỗi tab một prompt, aspect ratio **9:16**, lưu đúng tên stem ở trên về folder này (`hook-1.png`, `hook-2.png`, `james.png`, `luis-diaz.png`, `shomurodov.png`, `cannavaro.png`, `lorenzo.png` — KHÔNG cần `hook.png`, pipeline tự ghép từ `hook-1` + `hook-2`). Sau khi đủ 7 ảnh, chạy:

```
/create-video video/input/nhan-dinh-uzbekistan-vs-colombia-wc-2026/nhan-dinh-uzbekistan-vs-colombia-wc-2026.txt
```

hoặc đưa vào `/video-queue` để render theo lô.
