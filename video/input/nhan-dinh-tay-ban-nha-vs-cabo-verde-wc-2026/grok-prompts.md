# Grok prompts — Nhận định Tây Ban Nha vs Cabo Verde — World Cup 2026

6 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

Hai cảnh split-frame (`hook`, `managers`) có thể gen **2 ảnh đơn** mỗi cảnh (`-1` trái, `-2` phải) để pipeline tự ghép — dễ hơn ép Grok vẽ 2 người trong 1 khung. Hoặc dùng prompt split-frame gộp bên dưới nếu muốn.

---

## [1] hook → `hook.png` — Tây Ban Nha vs Cabo Verde (split-frame)

**Subject:** Hook đối đầu — Oyarzabal (Tây Ban Nha) vs Ryan Mendes (Cabo Verde), split-frame WC2026

Prompt split-frame gộp:

```
Vertical 9:16 split-frame football poster artwork showing a FIFA World Cup 2026 group-stage matchup. Left half: Mikel Oyarzabal, the Spanish striker for the Spain national team, in the bright red Spain home kit with the yellow-and-red Spain federation crest clearly visible on the chest, intense focused hero pose driving forward. Behind him, a stylized red-and-gold Spain graphic backdrop with a huge faint Spain crest watermark, the red-yellow-red Spanish flag rendered as a graphic color band, radiating golden light rays. Right half: Ryan Mendes, the veteran captain for the Cabo Verde national team, in the blue Cabo Verde home kit with the Cabo Verde federation crest clearly visible on the chest, proud determined hero pose. Behind him, a stylized blue-white-red Cabo Verde graphic backdrop with a huge faint Cabo Verde crest watermark, the blue-with-stars Cabo Verde flag rendered as a graphic color band, radiating light rays. Down the centre seam: a diagonal lightning-burst slash separator with dramatic energy glow, the golden FIFA World Cup trophy glowing as a stylized graphic accent between them. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup matchday promotional poster. Both national crests visible on the jerseys, no on-image text or captions, no scoreboard graphics.
```

Hoặc 2 ảnh đơn để pipeline tự ghép:

`hook-1.png` (trái — Oyarzabal):

```
Vertical 9:16 football poster artwork featuring Mikel Oyarzabal, the Spanish striker for the Spain national team, framed chest-up with his head in the upper third, intense focused hero pose. He wears the bright red Spain home kit with the yellow-and-red Spain federation crest clearly visible on the chest. Background: a stylized red-and-gold Spain graphic backdrop with a huge faint Spain crest watermark, the red-yellow-red Spanish flag as a graphic color band, radiating golden light rays. Vibrant saturated red palette, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup matchday promotional poster. The Spain crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

`hook-2.png` (phải — Ryan Mendes):

```
Vertical 9:16 football poster artwork featuring Ryan Mendes, the veteran captain for the Cabo Verde national team, framed chest-up with his head in the upper third, proud determined hero pose with the captain's armband visible. He wears the blue Cabo Verde home kit with the Cabo Verde federation crest clearly visible on the chest. Background: a stylized blue-white-red Cabo Verde graphic backdrop with a huge faint Cabo Verde crest watermark, the blue-with-stars Cabo Verde flag as a graphic color band, radiating light rays. Vibrant saturated blue palette with white-and-red accents, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup debut promotional poster. The Cabo Verde crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] oyarzabal → `oyarzabal.png` — Mikel Oyarzabal (Tây Ban Nha)

**Subject:** Mikel Oyarzabal — Tây Ban Nha (Real Sociedad), mũi nhọn cắm

```
Vertical 9:16 football poster artwork featuring Mikel Oyarzabal, the Spanish forward for Real Sociedad and the Spain national team, in an explosive goal-celebration roar with arms spread wide, jersey gripped in one fist, triumphant intense expression. He wears the bright red Spain home kit with the yellow-and-red Spain federation crest clearly visible on the chest. Background: a deep red-and-gold Spain graphic backdrop with a huge stylized Spain crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward from behind his head, faint red-yellow-red Spanish flag ribbon graphic across the lower frame. Vibrant saturated red palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup matchday promotional poster. The Spain crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] ryan-mendes → `ryan-mendes.png` — Ryan Mendes (Cabo Verde)

**Subject:** Ryan Mendes — đội trưởng Cabo Verde, 36 tuổi, chân sút số một lịch sử

```
Vertical 9:16 football poster artwork featuring Ryan Mendes, the veteran captain and all-time top scorer for the Cabo Verde national team, in a proud commanding captain pose with the captain's armband on his left arm, chest out, contemplative determined expression. He wears the blue Cabo Verde home kit with the Cabo Verde federation crest clearly visible on the chest. Background: a bold blue-white-red Cabo Verde graphic backdrop with a huge stylized Cabo Verde crest floating faintly behind him as a watermark, dramatic light rays radiating outward, the blue Cabo Verde flag with its ring of stars rendered as a faint graphic motif across the lower frame. Vibrant saturated blue palette with white-and-red accents, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup debut promotional poster. The Cabo Verde crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] dailon-livramento → `dailon-livramento.png` — Dailon Livramento (Cabo Verde)

**Subject:** Dailon Livramento — Cabo Verde, quân bài phản công tốc độ

```
Vertical 9:16 football poster artwork featuring Dailon Livramento, the fast attacking forward for the Cabo Verde national team, frozen mid-stride in an explosive sprinting counter-attack pose, ball at his feet, dynamic motion-blur trailing behind, intense focused expression. He wears the blue Cabo Verde home kit with the Cabo Verde federation crest clearly visible on the chest. Background: a high-energy blue-and-red Cabo Verde graphic backdrop with a huge stylized Cabo Verde crest floating faintly behind him as a watermark, sharp diagonal speed-line light rays radiating outward to convey pace, faint star-ring graphic motif at the lower frame. Vibrant saturated blue palette with red and white accents, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup matchday promotional poster. The Cabo Verde crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] managers → `managers.png` — De la Fuente vs Bubista (split-frame)

**Subject:** Họp báo — De la Fuente (Tây Ban Nha) vs Bubista (Cabo Verde), split-frame 2 HLV

Prompt split-frame gộp:

```
Vertical 9:16 split-frame football poster artwork showing two national-team managers ahead of a FIFA World Cup 2026 clash. Left half: Luis de la Fuente, the Spain national team head coach, in a sharp dark suit, intense focused touchline pose pointing instructions. Behind him, a stylized red-and-gold Spain graphic backdrop with a huge faint Spain federation crest watermark and radiating light rays. Right half: Bubista, the Cabo Verde national team head coach, in a tracksuit, passionate determined touchline pose. Behind him, a stylized blue-white-red Cabo Verde graphic backdrop with a huge faint Cabo Verde federation crest watermark and radiating light rays. Down the centre seam: a diagonal energy-slash separator with a soft glow. Vibrant saturated palette per side, very high contrast, glossy graphic-design finish. Stylized like a pre-match press-conference promotional poster. No on-image text or captions, no scoreboard graphics.
```

Hoặc 2 ảnh đơn để pipeline tự ghép:

`managers-1.png` (trái — De la Fuente):

```
Vertical 9:16 football poster artwork featuring Luis de la Fuente, the Spain national team head coach, framed chest-up with his head in the upper third, in a sharp dark suit, intense focused touchline pose pointing instructions. Background: a stylized red-and-gold Spain graphic backdrop with a huge faint Spain federation crest watermark and radiating light rays. Vibrant saturated red palette, very high contrast, glossy graphic-design finish. Stylized like a pre-match press-conference promotional poster. No on-image text or captions, no scoreboard graphics.
```

`managers-2.png` (phải — Bubista):

```
Vertical 9:16 football poster artwork featuring Bubista, the Cabo Verde national team head coach, framed chest-up with his head in the upper third, in a tracksuit, passionate determined touchline pose. Background: a stylized blue-white-red Cabo Verde graphic backdrop with a huge faint Cabo Verde federation crest watermark and radiating light rays. Vibrant saturated blue palette with white-and-red accents, very high contrast, glossy graphic-design finish. Stylized like a pre-match press-conference promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [6] prediction → `prediction.png` — Dự đoán Tây Ban Nha thắng 3-0

**Subject:** Dự đoán tỷ số — Tây Ban Nha thắng áp đảo 3-0, sức mạnh La Roja

```
Vertical 9:16 football poster artwork featuring Rodri, the Spanish midfielder and Ballon d'Or winner for the Spain national team, in a commanding central hero pose with arms slightly outstretched orchestrating play, confident dominant expression. He wears the bright red Spain home kit with the yellow-and-red Spain federation crest clearly visible on the chest. Background: a powerful red-and-gold Spain graphic backdrop with a huge stylized Spain crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward suggesting total dominance, faint red-yellow-red Spanish flag color blocks layered like overlapping geometric panes, the golden FIFA World Cup trophy glowing as a stylized graphic accent in an upper corner. Vibrant saturated red palette with bold golden highlights, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup favourites editorial poster. The Spain crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở nhiều tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **nhiều tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-tay-ban-nha-vs-cabo-verde-wc-2026/`) với stem đúng như file đã ghi (`hook`, `oyarzabal`, `ryan-mendes`, `dailon-livramento`, `managers`, `prediction`).
   - Với 2 cảnh split-frame: hoặc save 1 ảnh gộp (`hook.png` / `managers.png`), hoặc save 2 ảnh đơn (`hook-1.png`+`hook-2.png`, `managers-1.png`+`managers-2.png`) để pipeline tự ghép.
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`.
4. Khi đủ ảnh, chạy: `/create-video video/input/nhan-dinh-tay-ban-nha-vs-cabo-verde-wc-2026/nhan-dinh-tay-ban-nha-vs-cabo-verde-wc-2026.txt`

Lưu ý: 2 đội hình XI render bằng template `formation-pitch` (code, không cần ảnh). Cabo Verde là tân binh — Grok có thể yếu likeness; re-roll vài lần nếu cần.
