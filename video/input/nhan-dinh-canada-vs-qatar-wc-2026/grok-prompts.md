# Grok prompts — Nhận định Canada vs Qatar — World Cup 2026

7 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

> Hook là **split-frame ghép từ 2 ảnh đơn**: gen `hook-1` (Jonathan David, trái) và `hook-2` (Akram Afif, phải), pipeline tự ghép thành `hook.png` lúc stage. Nếu có ảnh 2 người thật thì save thẳng `hook.png` để bỏ qua bước ghép.

---

## [1] hook → `hook-1.png` (trái) — Jonathan David (Canada)

**Subject:** Nửa trái của hook split — Jonathan David, chest-up, đầu ở 1/3 trên

```
Vertical 9:16 football poster artwork featuring Jonathan David, the Canadian striker for the Canada national team, framed chest-up with his head in the upper third, intense focused hero pose looking toward the camera. He wears a red Canada home kit with the Canada Soccer maple-leaf crest clearly visible on the chest. Background: a stylized red-and-white Canada graphic backdrop with a huge faint maple-leaf crest watermark and dramatic light rays radiating outward from behind his head. Vibrant saturated red palette with white highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Canada crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] hook → `hook-2.png` (phải) — Akram Afif (Qatar)

**Subject:** Nửa phải của hook split — Akram Afif, chest-up, đầu ở 1/3 trên

```
Vertical 9:16 football poster artwork featuring Akram Afif, the Qatari attacking midfielder for the Qatar national team, framed chest-up with his head in the upper third, intense focused hero pose looking toward the camera. He wears a maroon Qatar home kit with the Qatar Football Association crest clearly visible on the chest. Background: a stylized maroon Qatar graphic backdrop with a huge faint Qatar crest watermark and dramatic golden light rays radiating outward from behind his head. Vibrant saturated maroon palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Qatar crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

> (Tuỳ chọn) Nếu muốn 1 ảnh hook ghép sẵn thay vì để pipeline tự ghép, dùng prompt combined trong `images-plan.json` (scene `hook`).

---

## [3] afif → `afif.png` — Akram Afif (Qatar)

**Subject:** Akram Afif — Qatar, 2 lần Cầu thủ xuất sắc nhất châu Á

```
Vertical 9:16 football poster artwork featuring Akram Afif, the Qatari attacking midfielder and creative talisman for the Qatar national team, in a hero pose driving forward with the ball at his feet, head up scanning for a pass, focused creative expression. He wears a maroon Qatar home kit with the Qatar Football Association crest clearly visible on the chest. Background: a bold maroon graphic backdrop with a huge stylized Qatar crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward from behind, faint stylized Arabian skyline silhouette across the lower frame as a graphic motif. Vibrant saturated maroon palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Qatar crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] david → `david.png` — Jonathan David (Canada)

**Subject:** Jonathan David — Canada, chân sút vĩ đại nhất lịch sử tuyển

```
Vertical 9:16 football poster artwork featuring Jonathan David, the Canadian striker and record goalscorer for the Canada national team, in a hero pose mid-stride driving forward on the attack, intense determined expression. He wears a red Canada home kit with the Canada Soccer maple-leaf crest clearly visible on the chest. Background: a deep red-and-white Canada graphic backdrop with a huge stylized maple-leaf crest floating faintly behind him as a watermark, dramatic light rays radiating outward from behind his head, faint stylized fan-crowd silhouettes in red flanking the lower frame as graphic accents. Vibrant saturated red palette with white highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Canada crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] davies → `davies.png` — Alphonso Davies (Canada)

**Subject:** Alphonso Davies — Canada, thủ quân, trở lại sân nhà cũ BC Place

```
Vertical 9:16 football poster artwork featuring Alphonso Davies, the Canadian left-back and captain for the Canada national team, in a hero pose sprinting at full speed down the wing, ball at his feet, dynamic explosive expression, captain's armband on his left arm. He wears a red Canada home kit with the Canada Soccer maple-leaf crest clearly visible on the chest. Background: a deep red-and-white Canada graphic backdrop with a huge stylized maple-leaf crest floating faintly behind him as a watermark, dramatic speed-blur light rays streaking outward behind him conveying pace. Vibrant saturated red palette with white highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Canada crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [6] marsch → `marsch.png` — Jesse Marsch (HLV Canada)

**Subject:** Jesse Marsch — HLV Canada, kêu gọi sân BC Place náo nhiệt

```
Vertical 9:16 football poster artwork featuring Jesse Marsch, the American head coach of the Canada national team, in a passionate touchline pose gesturing energetically toward the stands, urging the crowd to get loud, intense animated expression. He wears a smart dark coaching jacket with a small Canada Soccer maple-leaf crest visible on the chest. Background: a bold red-and-white Canada graphic backdrop with a huge stylized maple-leaf crest floating faintly behind him as a watermark, a roaring sea of red stylized fan-crowd silhouettes filling the lower frame as graphic accents, dramatic light rays radiating outward. Vibrant saturated red palette with white highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Canada crest visible, no on-image text or captions, no scoreboard graphics.
```

---

## [7] lopetegui → `lopetegui.png` — Julen Lopetegui (HLV Qatar)

**Subject:** Julen Lopetegui — HLV Qatar, người Tây Ban Nha

```
Vertical 9:16 football poster artwork featuring Julen Lopetegui, the Spanish head coach of the Qatar national team, in a composed focused touchline pose with arms folded, watching the pitch intently, calm thoughtful expression. He wears a smart dark coaching jacket with a small Qatar Football Association crest visible on the chest. Background: a bold maroon Qatar graphic backdrop with a huge stylized Qatar crest floating faintly behind him as a watermark, dramatic cool light rays radiating outward. Vibrant saturated maroon palette with subtle highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday editorial poster. The Qatar crest visible, no on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 7 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **7 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-canada-vs-qatar-wc-2026/`) với stem đúng như file đã ghi (`hook-1`, `hook-2`, `afif`, `david`, `davies`, `marsch`, `lopetegui`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
   - `hook-1` + `hook-2` sẽ tự ghép thành `hook.png` lúc stage.
4. Khi đủ ảnh, chạy: `/create-video video/input/nhan-dinh-canada-vs-qatar-wc-2026/nhan-dinh-canada-vs-qatar-wc-2026.txt`
