# Grok prompts — FIFA thay đổi nghi lễ hát quốc ca tại World Cup 2026

5 ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

---

## [1] hook → `hook.png`

**Subject:** Nghi lễ hát quốc ca hoành tráng tại World Cup 2026

```
Vertical 9:16 football poster artwork featuring the World Cup 2026 stadium filled with fans holding giant flags, and the FIFA World Cup trophy glowing brilliantly at the center of the pitch. Background: a stylized graphic backdrop in gold, blue, and white colors, a huge faint FIFA World Cup trophy watermark, dramatic light bursts radiating from the center. Saturated high-contrast color palette, glossy graphic-design finish. Stylized like a FIFA World Cup 2026 tournament promotional poster. No on-image text or captions.
```

---

## [2] all-players → `all-players.png`

**Subject:** Toàn bộ cầu thủ (cả dự bị) và trọng tài đứng ở vòng tròn trung tâm

```
Vertical 9:16 football poster artwork showing a large group of football players and referees standing together in unity around the green pitch's centre circle. The players wear national team kits of blue and white, while referees wear bright yellow official shirts. Background: a stylized green and gold graphic backdrop with radiating light rays and faint geometric shards. Saturated high-contrast color palette, glossy graphic-design finish. Stylized like an official tournament matchday promotional poster. No on-image text.
```

---

## [3] infantino → `infantino.png`

**Subject:** Chủ tịch FIFA Gianni Infantino phát biểu về quyết định

```
Vertical 9:16 football poster artwork featuring Gianni Infantino, the FIFA president, in a professional black suit and tie, looking confident and smiling. Background: a classy dark blue graphic backdrop with a giant faint gold FIFA logo watermark floating behind him, golden light beams radiating outward. Saturated palette, high contrast, glossy finish. Stylized like an official FIFA announcement promotional graphic. No on-image text.
```

---

## [4] stadium-360 → `stadium-360.png`

**Subject:** Trải nghiệm nghi lễ 360 độ hoành tráng

```
Vertical 9:16 football poster artwork featuring a futuristic 360-degree stadium view with massive flags of competing countries unfurled on the pitch. Fans in the stands hold shining flags under glowing neon spotlights. Background: a dark graphic backdrop with overlapping color panes in green, gold, and blue, light bursts radiating from the pitch. Saturated high-contrast color palette, glossy finish. Stylized like a tournament opening ceremony promotional poster. No on-image text.
```

---

## [5] captains → `captains.png`

**Subject:** Nghi thức bắt tay và tung đồng xu truyền thống

```
Vertical 9:16 football poster artwork featuring two team captains shaking hands at the centre of the pitch, a shiny silver coin flipping in the air between them. They wear national team kits of red and white. Background: a split red-and-white graphic backdrop with subtle radiating energy lines. Saturated color palette, high contrast, glossy finish. Stylized like a pre-match rivalry promotional poster. No on-image text.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở 5 tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **5 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/fifa-luat-hat-quoc-ca-moi/`) với stem đúng như file đã ghi (`hook`, `all-players`, ...).
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên, không cần đổi đuôi.
4. Khi đủ 5 ảnh, chạy: `/create-video video/input/fifa-luat-hat-quoc-ca-moi/fifa-luat-hat-quoc-ca-moi.txt`
