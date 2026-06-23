# Grok prompts — Nhận định Scotland vs Maroc — World Cup 2026

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

Hook là split-frame: gen **2 ảnh đơn** (`hook-1` trái = Hakimi, `hook-2` phải = McTominay), pipeline tự ghép thành `hook.png` lúc stage. (Có thể tự gen sẵn `hook.png` 2 người nếu muốn, nhưng 2 ảnh đơn dễ hơn.)

---

## [1] hook → ghép từ `hook-1.png` + `hook-2.png`

**Subject:** Split-frame Scotland vs Maroc — Hakimi (trái) vs McTominay (phải)

### hook-1 (trái — Hakimi)

```
Vertical 9:16 football poster artwork featuring Achraf Hakimi, the Moroccan right-back and captain for Paris Saint-Germain and the Morocco national team, framed chest-up with his head in the upper third, intense focused hero pose. He wears a red Morocco home kit with the green Morocco federation crest clearly visible on the chest and the captain's armband on his left arm. Background: a bold deep-red graphic backdrop with green accents and a huge stylized Morocco crest floating faintly behind him as a watermark, dramatic light rays radiating outward. Vibrant saturated red-and-green palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Morocco crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

### hook-2 (phải — McTominay)

```
Vertical 9:16 football poster artwork featuring Scott McTominay, the Scottish central midfielder for Napoli and the Scotland national team, framed chest-up with his head in the upper third, determined hero pose. He wears a dark navy-blue Scotland home kit with the Scottish FA crest clearly visible on the chest. Background: a deep navy-blue graphic backdrop with a huge stylized Scotland thistle crest floating faintly behind him as a watermark, dramatic light rays radiating outward. Vibrant saturated navy-and-white palette with silver highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Scotland crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] hakimi → `hakimi.png` — Achraf Hakimi (Maroc / PSG)

**Subject:** Achraf Hakimi — Maroc (PSG), đội trưởng

```
Vertical 9:16 football poster artwork featuring Achraf Hakimi, the Moroccan right-back and captain for Paris Saint-Germain and the Morocco national team, in a dynamic mid-stride hero pose driving forward down the right flank, intense determined expression. He wears a red Morocco home kit with the green Morocco federation crest clearly visible on the chest and the captain's armband on his left arm. Background: a bold deep-red graphic backdrop with green accents and a huge stylized Morocco crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint stylized green Moroccan flag motif as a graphic ribbon across the lower frame. Vibrant saturated red-and-green palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Morocco crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] mctominay → `mctominay.png` — Scott McTominay (Scotland / Napoli)

**Subject:** Scott McTominay — Scotland (Napoli), nhạc trưởng tuyến giữa

```
Vertical 9:16 football poster artwork featuring Scott McTominay, the Scottish central midfielder for Napoli and the Scotland national team, in a commanding hero pose striking a powerful volley mid-air, intense focused expression. He wears a dark navy-blue Scotland home kit with the Scottish FA crest clearly visible on the chest. Background: a deep navy-blue graphic backdrop with a huge stylized Scotland thistle crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head, faint stylized Saltire-blue tartan motif as a graphic ribbon across the lower frame. Vibrant saturated navy-and-white palette with silver highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Scotland crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] saibari → `saibari.png` — Ismael Saibari (Maroc)

**Subject:** Ismael Saibari — Maroc, người ghi bàn vào lưới Brazil

```
Vertical 9:16 football poster artwork featuring Ismael Saibari, the Moroccan forward for the Morocco national team, in a triumphant goal-celebration hero pose with arms spread wide and a roaring expression after scoring. He wears a red Morocco home kit with the green Morocco federation crest clearly visible on the chest. Background: a bold deep-red graphic backdrop with green accents and a huge stylized Morocco crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward, faint stylized green Moroccan flag motif as a graphic ribbon across the lower frame. Vibrant saturated red-and-green palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Morocco crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] clarke → `clarke.png` — Steve Clarke (HLV Scotland)

**Subject:** Steve Clarke — HLV Scotland, phát biểu họp báo

```
Vertical 9:16 football poster artwork featuring Steve Clarke, the Scottish manager of the Scotland national team, in a focused touchline hero pose with arms folded and a serious composed expression, wearing a dark navy team coaching jacket with the Scottish FA crest clearly visible on the chest. Background: a deep navy-blue graphic backdrop with a huge stylized Scotland thistle crest floating faintly behind him as a watermark, dramatic cool-blue light rays radiating outward, faint stylized Saltire motif as a graphic accent across the lower frame. Vibrant saturated navy-and-white palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup press-conference editorial poster. The Scotland crest visible on the jacket, no on-image text or captions, no scoreboard graphics.
```

---

## [6] ouahbi → `ouahbi.png` — Mohamed Ouahbi (HLV Maroc)

**Subject:** Mohamed Ouahbi — HLV Maroc, phát biểu họp báo

```
Vertical 9:16 football poster artwork featuring Mohamed Ouahbi, the Moroccan manager of the Morocco national team, in a focused touchline hero pose gesturing tactical instructions with a composed determined expression, wearing a dark coaching jacket with the green Morocco federation crest clearly visible on the chest. Background: a bold deep-red graphic backdrop with green accents and a huge stylized Morocco crest floating faintly behind him as a watermark, dramatic warm light rays radiating outward, faint stylized green Moroccan flag motif as a graphic accent across the lower frame. Vibrant saturated red-and-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup press-conference editorial poster. The Morocco crest visible on the jacket, no on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 7 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **7 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-scotland-vs-maroc-wc-2026/`) với stem đúng như đã ghi (`hook-1`, `hook-2`, `hakimi`, `mctominay`, `saibari`, `clarke`, `ouahbi`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`.
4. Khi đủ ảnh, chạy: `/create-video video/input/nhan-dinh-scotland-vs-maroc-wc-2026/nhan-dinh-scotland-vs-maroc-wc-2026.txt`
