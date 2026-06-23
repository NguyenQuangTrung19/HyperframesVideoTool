# Grok prompts — Nhận định Mexico vs Hàn Quốc — World Cup 2026

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

> Scene `hook` là split-frame: gen **2 ảnh đơn** (`hook-1` = Mexico trái, `hook-2` = Hàn Quốc phải), pipeline tự ghép thành `hook.png` lúc stage. Có thể thay bằng 1 ảnh ghép sẵn tên `hook.png` để bỏ qua bước merge.

---

## [1] hook → `hook.png` — split-frame Mexico vs Hàn Quốc

**Subject:** Split-frame Mexico vs Hàn Quốc — Jimenez (trái) vs Son Heung-min (phải)

Cách 1 — gen ảnh ghép sẵn (1 ảnh):

```
Vertical 9:16 split-frame football poster artwork showing a 2026 FIFA World Cup Group A matchup. Left half: Raul Jimenez, the Mexican striker for the Mexico national team, in a green Mexico home kit with the Mexican Football Federation crest clearly visible on the chest, intense focused hero pose. Behind him, a stylized green-and-red Mexico graphic backdrop with a huge faint Mexico crest watermark and radiating light rays. Right half: Son Heung-min, the South Korean captain and forward for the South Korea national team, in a red South Korea home kit with the Korea Football Association tiger crest clearly visible on the chest, mirroring hero pose. Behind him, a stylized red-and-blue South Korea graphic backdrop with a huge faint Korea crest watermark and radiating light rays. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow, the FIFA World Cup trophy glowing as a stylized graphic accent between them. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday rivalry promotional poster. Both national crests visible on the jerseys, no on-image text or captions, no scoreboard graphics.
```

Cách 2 (khuyên dùng) — gen 2 ảnh đơn, pipeline tự ghép:

`hook-1.png` (trái — Mexico):

```
Vertical 9:16 football poster artwork featuring Raul Jimenez, the Mexican striker for the Mexico national team, framed chest-up with his head in the upper third, in an intense focused hero pose. He wears a green Mexico home kit with the Mexican Football Federation crest clearly visible on the chest. Background: a bold green-and-red Mexico graphic backdrop with a huge stylized Mexico crest floating faintly behind him as a watermark, dramatic light rays radiating outward. Vibrant saturated green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Mexico crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

`hook-2.png` (phải — Hàn Quốc):

```
Vertical 9:16 football poster artwork featuring Son Heung-min, the South Korean captain and forward for the South Korea national team, framed chest-up with his head in the upper third, in an intense determined hero pose. He wears a red South Korea home kit with the Korea Football Association tiger crest clearly visible on the chest and the captain's armband on his left arm. Background: a bold red-and-blue South Korea graphic backdrop with a huge stylized Korea tiger crest floating faintly behind him as a watermark, dramatic light rays radiating outward. Vibrant saturated red-and-blue palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Korea crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] jimenez → `jimenez.png` — Raul Jimenez (Mexico)

**Subject:** Raul Jimenez — tiền đạo Mexico, đã ghi bàn 2 lần gần nhất gặp Hàn Quốc

```
Vertical 9:16 football poster artwork featuring Raul Jimenez, the Mexican striker for the Mexico national team, in a triumphant goal-celebration hero pose with arms spread wide and a roaring expression. He wears a green Mexico home kit with the Mexican Football Federation crest clearly visible on the chest. Background: a bold green graphic backdrop with a huge stylized Mexico crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward from behind, faint red-and-white graphic color bands along the lower frame. Vibrant saturated green palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Mexico crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] lee-kang-in → `lee-kang-in.png` — Lee Kang-in (Hàn Quốc / PSG)

**Subject:** Lee Kang-in — Hàn Quốc (Paris Saint-Germain), nhạc trưởng tuyến giữa

```
Vertical 9:16 football poster artwork featuring Lee Kang-in, the South Korean midfielder for Paris Saint-Germain and the South Korea national team, in a mid-stride driving-forward hero pose with the ball at his feet, focused composed expression. He wears a red South Korea home kit with the Korea Football Association tiger crest clearly visible on the chest. Background: a bold red graphic backdrop with a huge stylized Korea tiger crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint blue graphic color shards along the lower frame. Vibrant saturated red-and-blue palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Korea crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] son → `son.png` — Son Heung-min (Hàn Quốc)

**Subject:** Son Heung-min — đội trưởng Hàn Quốc, từng 2 lần ghi bàn vào lưới Mexico

```
Vertical 9:16 football poster artwork featuring Son Heung-min, the South Korean captain and forward for the South Korea national team, in an explosive sprinting counter-attack hero pose breaking forward at speed, intense determined expression. He wears a red South Korea home kit with the Korea Football Association tiger crest clearly visible on the chest and the captain's armband on his left arm. Background: a deep red graphic backdrop with a huge stylized Korea tiger crest floating faintly behind him as a watermark, dramatic motion-blur light streaks radiating outward conveying pace, faint blue graphic color bands along the lower frame. Vibrant saturated red-and-blue palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Korea crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] aguirre → `aguirre.png` — Javier Aguirre (HLV Mexico)

**Subject:** Javier Aguirre — HLV Mexico, tuyên bố sẽ khóa Lee Kang-in

```
Vertical 9:16 football poster artwork featuring Javier Aguirre, the Mexican head coach of the Mexico national team, on the touchline in an animated commanding hero pose pointing and giving tactical instructions, intense focused expression, wearing a smart dark coaching jacket. Background: a bold green Mexico graphic backdrop with a huge stylized Mexico crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint green-white-red graphic color bands along the lower frame. Vibrant saturated green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup managerial editorial poster. No on-image text or captions, no scoreboard graphics.
```

---

## [6] hong → `hong.png` — Hong Myung-bo (HLV Hàn Quốc)

**Subject:** Hong Myung-bo — HLV Hàn Quốc, chốt đội hình mạnh nhất

```
Vertical 9:16 football poster artwork featuring Hong Myung-bo, the South Korean head coach of the South Korea national team, on the touchline in a calm confident hero pose with arms folded, composed assured expression, wearing a smart dark coaching jacket. Background: a bold red South Korea graphic backdrop with a huge stylized Korea tiger crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint red-and-blue graphic color bands along the lower frame. Vibrant saturated red-and-blue palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup managerial editorial poster. No on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 7 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **7 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-mexico-vs-han-quoc-wc-2026/`) với stem đúng như file đã ghi (`hook-1`, `hook-2`, `jimenez`, `lee-kang-in`, `son`, `aguirre`, `hong`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`.
4. Khi đủ ảnh, chạy: `/create-video video/input/nhan-dinh-mexico-vs-han-quoc-wc-2026/nhan-dinh-mexico-vs-han-quoc-wc-2026.txt`
