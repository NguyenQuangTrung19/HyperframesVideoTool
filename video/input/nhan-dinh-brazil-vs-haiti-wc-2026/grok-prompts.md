# Grok prompts — Nhận định Brazil vs Haiti — World Cup 2026

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

Hook là ảnh split-frame ghép từ 2 ảnh đơn `hook-1` (trái) + `hook-2` (phải) — gen 2 ảnh này, pipeline tự ghép thành `hook.png` lúc stage.

---

## [1] hook → ghép từ `hook-1.png` (trái) + `hook-2.png` (phải)

### hook-1 (trái) → `hook-1.png` — Vinicius Junior (Brazil)

**Subject:** Vinicius Junior — Brazil, nửa trái split-frame

```
Vertical 9:16 football poster artwork featuring Vinicius Junior, the Brazilian winger for the Brazil national team, framed chest-up with his head in the upper third, intense focused hero pose. He wears a bright yellow Brazil home kit with the green CBF crest clearly visible on the chest. Background: a stylized yellow-and-green Brazil graphic backdrop with a huge faint CBF crest watermark and radiating light rays. Vibrant saturated yellow-and-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Brazil crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

### hook-2 (phải) → `hook-2.png` — Wilson Isidor (Haiti)

**Subject:** Wilson Isidor — Haiti, nửa phải split-frame

```
Vertical 9:16 football poster artwork featuring Wilson Isidor, the Haitian striker for the Haiti national team, framed chest-up with his head in the upper third, determined intense hero pose. He wears a blue-and-red Haiti home kit with the Haitian federation crest clearly visible on the chest. Background: a stylized blue-and-red Haiti graphic backdrop with a huge faint crest watermark and radiating light rays. Vibrant saturated blue-and-red palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Haiti crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] vinicius → `vinicius.png` — Vinicius Junior (Brazil)

**Subject:** Vinicius Junior — Brazil, ngôi sao chạy cánh trái

```
Vertical 9:16 football poster artwork featuring Vinicius Junior, the Brazilian winger for Real Madrid and the Brazil national team, in a dynamic hero pose mid-stride driving forward with the ball at speed, explosive and intense. He wears a bright yellow Brazil home kit with the green CBF crest clearly visible on the chest. Background: a vibrant yellow-and-green Brazil graphic backdrop with a huge stylized CBF crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint blue-and-green color-block shards arranged like overlapping geometric panes. Vibrant saturated yellow palette with green and gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Brazil crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] isidor → `isidor.png` — Wilson Isidor (Haiti, Sunderland)

**Subject:** Wilson Isidor — Haiti (Sunderland), tiền đạo cắm

```
Vertical 9:16 football poster artwork featuring Wilson Isidor, the Haitian striker for Sunderland and the Haiti national team, in a confident hero pose roaring after a goal with arms outstretched, intense determined expression. He wears a blue-and-red Haiti home kit with the Haitian federation crest clearly visible on the chest. Background: a bold blue-and-red Haiti graphic backdrop with a huge stylized Haitian crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind, layered blue-and-red color-block shards arranged like overlapping geometric panes. Vibrant saturated blue-and-red palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup underdog promotional poster. The Haiti crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] bellegarde → `bellegarde.png` — Jean-Ricner Bellegarde (Haiti, Wolverhampton)

**Subject:** Jean-Ricner Bellegarde — Haiti (Wolverhampton), nhạc trưởng tuyến giữa

```
Vertical 9:16 football poster artwork featuring Jean-Ricner Bellegarde, the Haitian midfielder for Wolverhampton Wanderers and the Haiti national team, in a composed hero pose driving forward with the ball, head up surveying the pitch, focused commanding expression. He wears a blue-and-red Haiti home kit with the Haitian federation crest clearly visible on the chest. Background: a deep blue Haiti graphic backdrop with a huge stylized Haitian crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint red color-block shards across the lower frame. Vibrant saturated blue-and-red palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Haiti crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] ancelotti → `ancelotti.png` — Carlo Ancelotti (HLV Brazil)

**Subject:** Carlo Ancelotti — HLV Brazil, phát biểu họp báo

```
Vertical 9:16 football poster artwork featuring Carlo Ancelotti, the Italian head coach of the Brazil national team, in a composed touchline hero pose with arms folded and a focused expression, dressed in a sharp dark coach's jacket. Background: a bold yellow-and-green Brazil graphic backdrop with a huge stylized CBF crest floating faintly behind him as a watermark, dramatic light rays radiating outward, layered green color-block shards across the lower frame. Vibrant saturated yellow-and-green palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup manager press-conference editorial poster. No on-image text or captions, no scoreboard graphics.
```

---

## [6] migne → `migne.png` — Sébastien Migné (HLV Haiti)

**Subject:** Sébastien Migné — HLV Haiti, phát biểu họp báo

```
Vertical 9:16 football poster artwork featuring Sebastien Migne, the French head coach of the Haiti national team, in a determined touchline hero pose gesturing instructions, focused passionate expression, dressed in a coach's training jacket. Background: a bold blue-and-red Haiti graphic backdrop with a huge stylized Haitian federation crest floating faintly behind him as a watermark, dramatic light rays radiating outward, layered red-and-blue color-block shards across the lower frame. Vibrant saturated blue-and-red palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup manager press-conference editorial poster. No on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 7 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **7 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-brazil-vs-haiti-wc-2026/`) với stem đúng như file đã ghi (`hook-1`, `hook-2`, `vinicius`, `isidor`, `bellegarde`, `ancelotti`, `migne`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
4. Khi đủ 7 ảnh, chạy: `/create-video video/input/nhan-dinh-brazil-vs-haiti-wc-2026/nhan-dinh-brazil-vs-haiti-wc-2026.txt`
