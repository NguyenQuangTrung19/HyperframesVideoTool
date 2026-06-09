# Grok prompts — Nhận định trận đấu giữa Hàn Quốc và Cộng hòa Séc tại World Cup 2026

6 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

---

## [1] hook → `hook.png`

**Subject:** Son Heung-min đối đầu Patrik Schick

```
Vertical 9:16 split-frame football poster artwork showing a 2026 FIFA World Cup group stage matchup between South Korea and Czech Republic. Left half: Son Heung-min, the South Korean forward, in the red South Korea home kit with the KFA Tiger crest visible, roaring celebration pose. Behind him, a vibrant red graphic backdrop with a huge faint Tiger crest watermark and glowing light beams. Right half: Patrik Schick, the Czech striker, in the red-and-blue Czech Republic home kit with the FACR crest visible, intense focused hero pose. Behind him, a red-white-and-blue graphic backdrop with a huge faint Czech lion crest watermark. Down the centre seam: a diagonal glowing lightning-burst separator, with the 2026 World Cup trophy rendered as a stylized graphic accent in the middle. Saturated vibrant color palette, very high contrast, glossy graphic finish. Both crests visible on jerseys, no on-image text.
```

---

## [2] hong → `hong.png` — #1 Hong Myung-bo (South Korea)

**Subject:** HLV Hong Myung-bo của tuyển Hàn Quốc

```
Vertical 9:16 football poster artwork featuring Hong Myung-bo, the legendary South Korean manager, in red coaching apparel, standing with arms crossed and a determined, tactical expression on his face. Background: a stylized red and white graphic backdrop with a giant faint South Korean Tiger crest watermark and radiating light bursts. Saturated red-and-white palette, high contrast, glossy graphic-design finish. Stylized like a World Cup manager profile graphic. The South Korea crest visible on his jacket, no on-image text.
```

---

## [3] koubek → `koubek.png` — #2 Miroslav Koubek (Czech Republic)

**Subject:** HLV Miroslav Koubek 74 tuổi của tuyển Séc

```
Vertical 9:16 football poster artwork featuring Miroslav Koubek, the 74-year-old veteran Czech manager, in a smart dark suit, looking thoughtful and tactical with a focused expression. Background: a stylized red, white, and blue graphic backdrop with a giant faint Czech Republic national team crest watermark, soft cold blue light rays. Saturated palette, high contrast, glossy graphic finish. Stylized like an international football manager profile graphic. The Czech crest visible on the background watermark, no on-image text.
```

---

## [4] son → `son.png` — #3 Son Heung-min (South Korea)

**Subject:** Đội trưởng Son Heung-min

```
Vertical 9:16 football poster artwork featuring Son Heung-min, the South Korean winger and captain of Tottenham and South Korea, in a hero pose celebrating a goal with his signature 'camera' finger gesture, smiling brightly. He wears the red South Korea home kit with the Tiger crest visible on the chest. Background: a vibrant red graphic backdrop with a giant faint Tiger crest watermark and diagonal light trails. Vibrant saturated palette, high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The South Korea crest visible on the jersey, no on-image text.
```

---

## [5] kim → `kim.png` — #4 Kim Min-jae (South Korea)

**Subject:** Quái vật phòng ngự Kim Min-jae

```
Vertical 9:16 football poster artwork featuring Kim Min-jae, the South Korean centre-back for Bayern Munich and South Korea, in a hero pose making an intense sliding tackle, focused powerful expression. He wears the red South Korea home kit with the Tiger crest visible on the chest. Background: a stylized red graphic backdrop with a giant faint Tiger crest watermark and dramatic diagonal light bursts. Saturated red palette, high contrast, glossy graphic-design finish. Stylized like a defensive hero promotional poster. The South Korea crest visible on the jersey, no on-image text.
```

---

## [6] schick → `schick.png` — #5 Patrik Schick (Czech Republic)

**Subject:** Tiền đạo Patrik Schick của CH Séc

```
Vertical 9:16 football poster artwork featuring Patrik Schick, the tall Czech striker for Bayer Leverkusen and Czech Republic, in a hero pose rising high above defenders for an aerial header, intense focused expression. He wears the red-and-blue Czech Republic home kit with the Czech crest visible on the chest. Background: a bold red, white, and blue graphic backdrop with a huge faint Czech crest watermark, dramatic light rays radiating from behind him. Saturated palette, high contrast, glossy graphic finish. Stylized like a UEFA matchday promotional poster. The Czech crest visible on the jersey, no on-image text.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 6 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **6 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-han-quoc-vs-sec-wc-2026/`) với stem đúng như file đã ghi (`hook`, `hong`, ...).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
4. Khi đủ 6 ảnh, chạy: `/create-video video/input/nhan-dinh-han-quoc-vs-sec-wc-2026/nhan-dinh-han-quoc-vs-sec-wc-2026.txt`
