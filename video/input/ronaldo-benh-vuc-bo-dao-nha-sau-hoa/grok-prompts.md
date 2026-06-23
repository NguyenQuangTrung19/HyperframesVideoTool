# Grok prompts — Ronaldo bênh vực Bồ Đào Nha sau trận hòa Congo

8 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

> Lưu ý: scene `messi-record` là split-frame ghép từ **2 ảnh đơn** (`messi-record-1` = Ronaldo bên trái, `messi-record-2` = Messi bên phải). Gen 2 ảnh đơn này, pipeline tự ghép thành `messi-record.png` lúc stage. (Nếu có ảnh 2 người thật, save thẳng `messi-record.png` để bỏ bước ghép.) → tổng cộng vẫn 8 ô ảnh, nhưng là 9 prompt.

---

## [1] hook → `hook.png`

**Subject:** Ronaldo lầm lũi rời sân sau trận hòa — poster World Cup

```
Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Portugal and the Portugal national team, in his current 2025-26 era, in a tense frustrated hero pose walking off the pitch with a clenched jaw and a hard stare, head held high despite visible disappointment. He wears the deep red Portugal home kit with the Portuguese Football Federation crest clearly visible on the chest and the captain's armband on his left arm. Background: a bold dark-red and green Portugal graphic backdrop with a huge stylized Portugal federation crest floating faintly behind him as a watermark, dramatic light rays radiating outward, faint stylized 2026 World Cup trophy motif glowing in a corner. Vibrant saturated red-and-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday editorial poster. The Portugal crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] draw-congo → `draw-congo.png` — Yoane Wissa (DR Congo)

**Subject:** Bồ Đào Nha 1-1 Congo, Yoane Wissa gỡ hòa — Houston

```
Vertical 9:16 football poster artwork featuring Yoane Wissa, the DR Congo forward for the DR Congo national team, in a triumphant goal-celebration pose with arms spread wide and a roaring expression after scoring an equalizer. He wears the bright blue DR Congo home kit with the DR Congo federation crest clearly visible on the chest. Background: a bold sky-blue and yellow DR Congo graphic backdrop with a huge faint DR Congo federation crest watermark, dramatic light rays radiating outward, faint stylized leopard silhouette motif (the Leopards) in a corner as a graphic accent. Vibrant saturated blue-and-yellow palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup giant-killing editorial poster. The DR Congo crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] tunnel → `tunnel.png` — Cristiano Ronaldo (Bồ Đào Nha)

**Subject:** Ronaldo đi thẳng vào đường hầm, vẻ thất vọng

```
Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Portugal and the Portugal national team, in his current 2025-26 era, in a moody dejected pose walking into the stadium tunnel alone, head lowered slightly with a shadowed brooding expression, hands on hips. He wears the deep red Portugal home kit with the Portuguese Football Federation crest clearly visible on the chest and the captain's armband. Background: a dark moody graphic backdrop suggesting a stadium tunnel with cold low light, a huge faded Portugal federation crest watermark, dramatic downward shafts of cool light creating a somber atmosphere. Moody saturated dark-red palette, high contrast, glossy graphic-design finish. Stylized like a World Cup disappointment editorial poster. The Portugal crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] interview → `interview.png` — Cristiano Ronaldo (Bồ Đào Nha)

**Subject:** Ronaldo ký tặng fan, trả lời Sport TV bênh vực đồng đội

```
Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Portugal and the Portugal national team, in his current 2025-26 era, in a calm composed pose mid-speech with a slight reassuring gesture of one hand, a measured determined expression, as if defending his team in an interview. He wears the deep red Portugal home kit with the Portuguese Football Federation crest clearly visible on the chest. Background: a bold dark-red and green Portugal graphic backdrop with a huge stylized Portugal federation crest watermark, dramatic light rays radiating outward, faint stylized fan-crowd silhouettes in red and green as graphic color bands at the lower edge. Vibrant saturated red-and-green palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup post-match editorial poster. The Portugal crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] goal-drought → `goal-drought.png` — Cristiano Ronaldo (Bồ Đào Nha)

**Subject:** Ronaldo tịt ngòi 10 trận liên tiếp ở giải lớn

```
Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Portugal and the Portugal national team, in his current 2025-26 era, in a frustrated pose with both hands on his head after a missed clear chance, eyes wide with disbelief, a ghostly transparent action-replay of a shot sailing just wide in the background. He wears the deep red Portugal home kit with the Portuguese Football Federation crest clearly visible on the chest. Background: a moody dark-red graphic backdrop with a huge faded Portugal federation crest watermark, dramatic cold light rays creating a tense atmosphere. Moody saturated dark-red palette, very high contrast, glossy graphic-design finish. Stylized like a World Cup near-miss editorial poster. The Portugal crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [6] oldest-portugal → `oldest-portugal.png` — Cristiano Ronaldo (Bồ Đào Nha)

**Subject:** Ronaldo 41 tuổi — cầu thủ lớn tuổi nhất lịch sử Bồ Đào Nha, vượt Pepe

```
Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Portugal and the Portugal national team, in his current 2025-26 era at age 41, in a commanding veteran hero pose with arms folded and a proud determined expression, exuding longevity and authority. He wears the deep red Portugal home kit with the Portuguese Football Federation crest clearly visible on the chest and the captain's armband on his left arm. Background: a bold dark-red and green Portugal graphic backdrop with a huge stylized Portugal federation crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward, faint stylized milestone-record ribbon motif across the lower frame in gold. Vibrant saturated red-and-green palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a historic-record promotional poster. The Portugal crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [7] messi-record → `messi-record.png` (split-frame ghép từ 2 ảnh dưới)

**Subject:** Ronaldo cân bằng Messi — 6 kỳ World Cup góp mặt (split-frame)

### [7a] messi-record-1 → `messi-record-1.png` (TRÁI — Ronaldo)

```
Vertical 9:16 football poster artwork featuring Cristiano Ronaldo, the Portuguese forward and captain for Portugal and the Portugal national team, in his current 2025-26 era, framed chest-up with his head in the upper third, in a proud composed hero pose with a determined expression. He wears the deep red Portugal home kit with the Portuguese Football Federation crest clearly visible on the chest and the captain's armband. Background: a bold dark-red and green Portugal graphic backdrop with a huge stylized Portugal federation crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward. Vibrant saturated red-and-green palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a historic-record promotional poster. The Portugal crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

### [7b] messi-record-2 → `messi-record-2.png` (PHẢI — Messi)

```
Vertical 9:16 football poster artwork featuring Lionel Messi, the Argentine forward and captain for Argentina and the Argentina national team, in his current 2025-26 era, framed chest-up with his head in the upper third, in a proud composed hero pose with a calm confident expression. He wears the light-blue-and-white striped Argentina home kit with the Argentine Football Association crest clearly visible on the chest and the captain's armband. Background: a bold sky-blue and white Argentina graphic backdrop with a huge stylized Argentina federation crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward. Vibrant saturated sky-blue-and-white palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a historic-record promotional poster. The Argentina crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [8] milla-record → `milla-record.png` — Roger Milla (Cameroon)

**Subject:** Roger Milla — kỷ lục cầu thủ lớn tuổi nhất World Cup (42 tuổi 39 ngày, 1994)

```
Vertical 9:16 football poster artwork featuring Roger Milla, the legendary Cameroonian forward for the Cameroon national team, depicted in his iconic 1994 World Cup era, in a joyful celebratory hero pose mid-stride, exuding the energy of a record-setting veteran. He wears the green Cameroon home kit with the Cameroon federation crest clearly visible on the chest. Background: a bold green-red-yellow Cameroon graphic backdrop with a huge stylized Cameroon federation crest floating faintly behind him as a watermark, dramatic golden light rays radiating outward, a faint stylized 1994 USA World Cup trophy motif in a corner as a graphic accent. Vibrant saturated green-red-yellow palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a historic-record promotional poster. The Cameroon crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 9 tab grok.com cùng lúc (8 ô + 1 ảnh phụ split), paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **9 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/ronaldo-benh-vuc-bo-dao-nha-sau-hoa/`) với stem đúng như file đã ghi (`hook`, `draw-congo`, `tunnel`, `interview`, `goal-drought`, `oldest-portugal`, `messi-record-1`, `messi-record-2`, `milla-record`).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`.
   - `messi-record-1` + `messi-record-2` sẽ tự ghép thành `messi-record.png` lúc stage.
4. Khi đủ ảnh, chạy: `/create-video video/input/ronaldo-benh-vuc-bo-dao-nha-sau-hoa/ronaldo-benh-vuc-bo-dao-nha-sau-hoa.txt`
