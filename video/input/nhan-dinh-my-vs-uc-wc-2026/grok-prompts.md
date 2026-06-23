# Grok prompts — Nhận định Mỹ vs Úc — World Cup 2026

5 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

Hook là split-frame ghép từ 2 ảnh đơn `hook-1` (trái, Mỹ) + `hook-2` (phải, Úc) — pipeline tự ghép thành `hook.png` lúc stage. Mỗi ảnh chỉ 1 người, chest-up, đầu ở 1/3 trên khung.

---

## [1] hook-1 → `hook-1.png` — Christian Pulisic (Mỹ, trái)

**Subject:** Pulisic — nửa trái của hook split-frame

```
Vertical 9:16 football poster artwork featuring Christian Pulisic, the American winger and captain for the United States national team, framed chest-up with his head in the upper third, intense focused hero pose looking toward the right of frame. He wears a white USA home kit with the US Soccer crest clearly visible on the chest and the captain's armband. Background: a stylized navy-white-and-red USA graphic backdrop with a huge faint US Soccer crest watermark and dramatic light rays radiating outward from behind his head. Vibrant saturated navy-and-red palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The US Soccer crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] hook-2 → `hook-2.png` — Nestory Irankunda (Úc, phải)

**Subject:** Irankunda — nửa phải của hook split-frame

```
Vertical 9:16 football poster artwork featuring Nestory Irankunda, the young Australian winger for the Australia Socceroos national team, in his current 2026 era, framed chest-up with his head in the upper third, fierce focused hero pose looking toward the left of frame. He wears a gold-and-green Australia Socceroos home kit with the Football Australia crest clearly visible on the chest. Background: a stylized green-and-gold graphic backdrop with a huge faint Socceroos crest watermark and dramatic light rays radiating outward from behind his head. Vibrant saturated green-and-gold palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Football Australia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] balogun → `balogun.png` — Folarin Balogun (Mỹ)

**Subject:** Folarin Balogun — Mỹ, tiền đạo (cú đúp vs Paraguay)

```
Vertical 9:16 football poster artwork featuring Folarin Balogun, the American striker for the United States national team, in a triumphant goal-celebration roar with both arms spread wide after scoring, intense joyful expression. He wears a white USA home kit with the US Soccer crest clearly visible on the chest. Background: a bold navy-and-red USA graphic backdrop with a huge stylized US Soccer crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward from behind his head, faint stars-and-stripes ribbon motif across the lower frame as a graphic accent. Vibrant saturated navy-white-and-red palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The US Soccer crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] pulisic → `pulisic.png` — Christian Pulisic (Mỹ)

**Subject:** Christian Pulisic — Mỹ, đội trưởng (nhạc trưởng, kiến tạo)

```
Vertical 9:16 football poster artwork featuring Christian Pulisic, the American winger and captain for the United States national team, in a dynamic mid-stride driving pose carrying the ball forward at speed, determined commanding expression, captain's armband on his left arm. He wears a white USA home kit with the US Soccer crest clearly visible on the chest. Background: a deep navy USA graphic backdrop with a huge stylized US Soccer crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint stylized fan-crowd silhouettes in red and white flanking the composition as graphic accents. Vibrant saturated navy-and-red palette with bright highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The US Soccer crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] irankunda → `irankunda.png` — Nestory Irankunda (Úc)

**Subject:** Nestory Irankunda — Úc, 20 tuổi (mở tỷ số vs Thổ Nhĩ Kỳ, mũi phản công tốc độ)

```
Vertical 9:16 football poster artwork featuring Nestory Irankunda, the young Australian winger for the Australia Socceroos national team, in his current 2026 era, in an explosive sprinting hero pose driving forward on a counter-attack, fierce focused expression. He wears a gold-and-green Australia Socceroos home kit with the Football Australia crest clearly visible on the chest. Background: a bold green-and-gold graphic backdrop with a huge stylized Socceroos crest floating faintly behind him as a watermark, dramatic light rays radiating outward conveying speed, faint motion-streak graphic accents trailing behind him. Vibrant saturated green-and-gold palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Football Australia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở `5` tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **`5` tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-my-vs-uc-wc-2026/`) với stem đúng như file đã ghi (`hook-1`, `hook-2`, `balogun`, `pulisic`, `irankunda`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
4. Khi đủ 5 ảnh, chạy: `/create-video video/input/nhan-dinh-my-vs-uc-wc-2026/nhan-dinh-my-vs-uc-wc-2026.txt`
