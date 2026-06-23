# Grok prompts — Nhan dinh Sec vs Nam Phi — World Cup 2026

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

Hook là split-frame → gen 2 ảnh đơn (`hook-1` trái, `hook-2` phải), pipeline tự ghép thành `hook.png` lúc stage. Còn lại 5 ảnh đơn.

---

## [1] hook (split-frame) → ghép tự động thành `hook.png`

Gen 2 ảnh đơn dưới đây, mỗi ảnh 1 người, chest-up, đầu ở 1/3 trên khung.

### hook-1 (trái) → `hook-1.png` — Patrik Schick (Sec)

**Subject:** Patrik Schick — mui nhon so 1 cua Sec

```
Vertical 9:16 football poster artwork featuring Patrik Schick, the Czech striker for Bayer Leverkusen and the Czech Republic national team, framed chest-up with his head in the upper third, intense focused hero pose ready to strike. He wears a red Czech Republic home kit with the Czech federation crest clearly visible on the chest. Background: a bold red-and-blue Czech graphic backdrop with a huge stylized Czech national crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head. Vibrant saturated red-and-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Czech national crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

### hook-2 (phải) → `hook-2.png` — Lyle Foster (Nam Phi)

**Subject:** Lyle Foster — trung phong cam trich Nam Phi

```
Vertical 9:16 football poster artwork featuring Lyle Foster, the South African striker for Burnley and the South Africa national team, framed chest-up with his head in the upper third, determined hero pose mid-roar. He wears a gold-and-green South Africa home kit with the South African Football Association crest clearly visible on the chest. Background: a bold gold-and-green Bafana Bafana graphic backdrop with a huge stylized South Africa national crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head. Vibrant saturated gold-and-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Africa national crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] schick → `schick.png` — Patrik Schick (Sec)

**Subject:** Patrik Schick — Sec, mui nhon so 1 (Bayer Leverkusen)

```
Vertical 9:16 football poster artwork featuring Patrik Schick, the Czech striker for Bayer Leverkusen and the Czech Republic national team, in a powerful hero pose mid-stride driving forward with a determined expression, ready to strike. He wears a red Czech Republic home kit with the Czech federation crest clearly visible on the chest. Background: a bold red-and-blue Czech graphic backdrop with a huge stylized Czech national crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head, faint stylized supporter color bands in red, blue and white across the lower frame. Vibrant saturated red-and-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Czech national crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] foster → `foster.png` — Lyle Foster (Nam Phi)

**Subject:** Lyle Foster — Nam Phi, trung phong cam trich (Burnley)

```
Vertical 9:16 football poster artwork featuring Lyle Foster, the South African striker for Burnley and the South Africa national team, in a determined hero pose celebrating a goal with a clenched fist and a roar. He wears a gold-and-green South Africa home kit with the South African Football Association crest clearly visible on the chest. Background: a bold gold-and-green Bafana Bafana graphic backdrop with a huge stylized South Africa national crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind, faint stylized supporter color bands in gold and green across the lower frame. Vibrant saturated gold-and-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Africa national crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] mokoena → `mokoena.png` — Teboho Mokoena (Nam Phi)

**Subject:** Teboho Mokoena — Nam Phi, nhac truong tuyen giua (92,9% chuyen)

```
Vertical 9:16 football poster artwork featuring Teboho Mokoena, the South African central midfielder for the South Africa national team, in a composed hero pose striding forward on the ball with an authoritative expression, scanning to spray a pass. He wears a gold-and-green South Africa home kit with the South African Football Association crest clearly visible on the chest. Background: a deep green-and-gold graphic backdrop with a huge stylized South Africa national crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint stylized passing-lane graphic arcs sweeping across the frame. Vibrant saturated green-and-gold palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Africa national crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] koubek-quote → `koubek-quote.png` — Miroslav Koubek (HLV Sec)

**Subject:** Miroslav Koubek — HLV Sec, hop bao Atlanta

```
Vertical 9:16 football poster artwork featuring Miroslav Koubek, the veteran Czech head coach of the Czech Republic national team, as a smaller secondary figure in a thoughtful touchline pose, arms folded, intense focused expression, in a smart dark coaching jacket. Background: a bold red-and-blue Czech graphic backdrop with a huge stylized Czech national crest floating faintly behind him as a watermark, dramatic cool light rays radiating outward, a faint World Cup trophy graphic accent glowing in one corner. Vibrant saturated red-and-blue palette, very high contrast, glossy graphic-design finish, editorial press-conference mood. Stylized like a World Cup pre-match editorial poster. No on-image text or captions, no scoreboard graphics.
```

---

## [6] broos-quote → `broos-quote.png` — Hugo Broos (HLV Nam Phi)

**Subject:** Hugo Broos — HLV Nam Phi, hop bao do-or-die

```
Vertical 9:16 football poster artwork featuring Hugo Broos, the veteran Belgian head coach of the South Africa national team, as a smaller secondary figure in a defiant touchline pose, jaw set, determined commanding expression, in a smart dark coaching jacket. Background: a bold gold-and-green South Africa graphic backdrop with a huge stylized Bafana Bafana national crest floating faintly behind him as a watermark, dramatic warm light rays radiating outward, a faint World Cup trophy graphic accent glowing in one corner. Vibrant saturated gold-and-green palette, very high contrast, glossy graphic-design finish, editorial press-conference mood. Stylized like a World Cup pre-match editorial poster. No on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 7 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **7 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-sec-vs-nam-phi-wc-2026/`) với stem đúng như file đã ghi (`hook-1`, `hook-2`, `schick`, `foster`, `mokoena`, `koubek-quote`, `broos-quote`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`.
4. Khi đủ ảnh, chạy: `/create-video video/input/nhan-dinh-sec-vs-nam-phi-wc-2026/nhan-dinh-sec-vs-nam-phi-wc-2026.txt`
