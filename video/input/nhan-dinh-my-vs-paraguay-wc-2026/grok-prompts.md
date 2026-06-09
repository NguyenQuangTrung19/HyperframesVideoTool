# Grok prompts — Nhận định bảng D World Cup 2026 giữa tuyển Mỹ và Paraguay

6 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

---

## [1] hook → `hook.png`

**Subject:** Christian Pulisic đọ sức Gustavo Gómez

```
Vertical 9:16 split-frame football poster artwork showing a 2026 FIFA World Cup group stage matchup between USA and Paraguay. Left half: Christian Pulisic, the American winger, in the white USA home kit with the USA Soccer crest visible, in a dynamic dribbling pose. Behind him, a navy-and-red USA graphic backdrop with a huge faint US Soccer crest watermark and radiating light rays. Right half: Gustavo Gómez, the Paraguayan defender, in the red-and-white striped Paraguay home kit with the APF Paraguay crest visible, in a dominant defensive stance. Behind him, a red-and-white graphic backdrop with a huge faint Paraguay crest watermark. Down the centre seam: a diagonal glowing lightning-burst separator, with the 2026 World Cup trophy rendered as a stylized graphic accent in the middle. Saturated vibrant color palette, very high contrast, glossy graphic finish. Both crests visible on jerseys, no on-image text.
```

---

## [2] pochettino → `pochettino.png` — #1 Mauricio Pochettino (USA)

**Subject:** HLV Mauricio Pochettino của tuyển Mỹ

```
Vertical 9:16 football poster artwork featuring Mauricio Pochettino, the Argentine manager of the United States men's national team, in navy USA coaching apparel, gesturing instructions on the touchline with a focused tactical look. Background: a stylized navy, white, and red graphic backdrop with a giant faint US Soccer crest watermark and radiating white light rays. Saturated palette, high contrast, glossy graphic-design finish. Stylized like a World Cup manager profile graphic. The USA crest visible on his jacket, no on-image text.
```

---

## [3] alfaro → `alfaro.png` — #2 Gustavo Alfaro (Paraguay)

**Subject:** HLV Gustavo Alfaro của Paraguay

```
Vertical 9:16 football poster artwork featuring Gustavo Alfaro, the Argentine manager of the Paraguay national team, in a sharp suit with a passionate motivating expression, shouting and clapping his hands. Background: a bold red-and-white graphic backdrop with a giant faint Paraguay national team crest watermark and intense light bursts. Saturated red-and-white palette, high contrast, glossy graphic-design finish. Stylized like a South American football matchday promotional poster. The Paraguay crest visible on the background watermark, no on-image text.
```

---

## [4] pulisic → `pulisic.png` — #3 Christian Pulisic (USA)

**Subject:** Christian Pulisic dẫn dắt tuyển Mỹ

```
Vertical 9:16 football poster artwork featuring Christian Pulisic, the American winger and captain of the United States national team, in a hero pose dribbling a football at high speed, kicking up turf sparks, intense determined expression. He wears the white USA home kit with the USA Soccer crest visible on the chest. Background: a stylized navy-blue graphic backdrop with a giant faint US Soccer crest watermark and diagonal red-and-white light trails. Vibrant saturated palette, high contrast, glossy graphic-design finish. Stylized like a World Cup tournament matchday graphic. The USA crest visible on the jersey, no on-image text.
```

---

## [5] gomez → `gomez.png` — #4 Gustavo Gómez (Paraguay)

**Subject:** Thủ quan Paraguay Gustavo Gómez

```
Vertical 9:16 football poster artwork featuring Gustavo Gómez, the veteran Paraguayan centre-back and captain of Palmeiras and the Paraguay national team, in a hero pose winning a physical header mid-air, commanding expression. He wears the red-and-white striped Paraguay national team jersey with the Paraguay crest visible on the chest. Background: a bold red-and-white graphic backdrop with a huge faint Paraguay crest watermark, dramatic light rays radiating from behind him. Saturated red-and-white palette, high contrast, glossy graphic finish. Stylized like a CONMEBOL matchday promotional poster. The Paraguay crest visible on the jersey, no on-image text.
```

---

## [6] almiron → `almiron.png` — #5 Miguel Almirón (Paraguay)

**Subject:** Miguel Almirón bứt tốc biên phải

```
Vertical 9:16 football poster artwork featuring Miguel Almirón, the high-intensity Paraguayan winger for Newcastle and the Paraguay national team, in a hero pose sprinting down the wing, wind in his hair, focused expression. He wears the red-and-white striped Paraguay national team jersey with the crest visible on the chest. Background: a dynamic red-and-white graphic backdrop with a giant faint Paraguay crest watermark and speed lines. Saturated red-and-white palette, high contrast, glossy graphic-design finish. Stylized like an international matchday promotional poster. The Paraguay crest visible on the jersey, no on-image text.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 6 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **6 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-my-vs-paraguay-wc-2026/`) với stem đúng như file đã ghi (`hook`, `pochettino`, ...).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
4. Khi đủ 6 ảnh, chạy: `/create-video video/input/nhan-dinh-my-vs-paraguay-wc-2026/nhan-dinh-my-vs-paraguay-wc-2026.txt`
