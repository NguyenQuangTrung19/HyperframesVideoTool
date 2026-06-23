# Grok prompts — Nhận định Saudi Arabia vs Uruguay (World Cup 2026)

7 scene ảnh cần tạo trên grok.com (Imagine, aspect ratio **9:16**), save về cùng folder này theo đúng tên file.

⚠️ **2 scene split-frame** (`hook`, `managers`) = mỗi scene gen **2 ảnh đơn** (`-1` trái, `-2` phải), pipeline tự ghép lúc `images:stage`. Tổng cộng phải gen **9 ảnh đơn**. Bạn cũng có thể tự thả 1 ảnh 2-người vào `hook.png` / `managers.png` để bỏ qua bước ghép.

---

## [1] hook → `hook.png` — Split-frame: Salem Al-Dawsari (Saudi) vs Valverde (Uruguay)

**Subject:** Hook đối đầu — cờ + crest hai đội, cúp World Cup ở giữa. Gen 2 ảnh đơn dưới đây.

### hook-1 (trái) → `hook-1.png` — Salem Al-Dawsari (Saudi Arabia)

```
Vertical 9:16 football poster artwork featuring Salem Al-Dawsari, the Saudi Arabian winger and captain for the Saudi Arabia national team, framed chest-up with his head in the upper third, in a determined focused hero pose. He wears a white Saudi Arabia home kit with green trim and the Saudi Arabia football federation crest clearly visible on the chest, the captain's armband on his left arm. Background: a bold green-and-white Saudi Arabia graphic backdrop with a huge stylized Saudi Arabia crest floating faintly behind him as a watermark, the green Saudi flag with its palm-and-swords emblem rendered as a graphic motif, dramatic green light rays radiating outward. Vibrant saturated green-and-white palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Saudi Arabia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

### hook-2 (phải) → `hook-2.png` — Federico Valverde (Uruguay)

```
Vertical 9:16 football poster artwork featuring Federico Valverde, the Uruguayan midfielder for Real Madrid and the Uruguay national team, framed chest-up with his head in the upper third, in an intense driving hero pose. He wears a sky-blue Uruguay home kit with the Uruguay AUF sun crest clearly visible on the chest. Background: a bold sky-blue Uruguay graphic backdrop with a huge stylized Uruguay sun crest floating faintly behind him as a watermark, the golden Sun of May from the Uruguayan flag glowing as a graphic accent, dramatic light rays radiating outward. Vibrant saturated sky-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Uruguay crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [2] score-pred → `score-pred.png` — Dự đoán tỷ số (Darwin Nunez)

**Subject:** Dự đoán tỷ số Uruguay thắng — Darwin Nunez dứt điểm

```
Vertical 9:16 football poster artwork featuring Darwin Nunez, the Uruguayan striker for the Uruguay national team, in a powerful hero pose striking the ball mid-stride with explosive intent, fierce determined expression. He wears a sky-blue Uruguay home kit with the Uruguay AUF sun crest clearly visible on the chest. Background: a bold sky-blue Uruguay graphic backdrop with a huge stylized Uruguay sun crest floating faintly behind him as a watermark, the golden Sun of May from the Uruguayan flag glowing as a graphic accent, dramatic golden light rays radiating outward, faint stylized fan-crowd silhouettes in sky-blue at the lower frame. Vibrant saturated sky-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Uruguay crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [3] h2h-2018 → `h2h-2018.png` — Đối đầu 2018 (Luis Suarez đánh đầu)

**Subject:** Cú đánh đầu của Luis Suarez hạ Saudi 1-0 tại World Cup 2018

```
Vertical 9:16 football poster artwork featuring Luis Suarez, the veteran Uruguayan striker for the Uruguay national team, rising for a powerful header mid-air with the ball just leaving his forehead, intense roaring expression, in his Uruguay sky-blue home kit with the Uruguay AUF sun crest clearly visible on the chest. Background: a dramatic sky-blue Uruguay graphic backdrop with a huge stylized Uruguay sun crest floating faintly behind him as a watermark, the golden Sun of May glowing as a graphic accent, bold radiating golden light rays behind his head, faint stylized 2018-era stadium-crowd silhouettes at the lower edge. Vibrant saturated sky-blue palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a historic World Cup moment promotional poster. The Uruguay crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [4] valverde → `valverde.png` — Federico Valverde (Uruguay / Real Madrid)

**Subject:** Nhạc trưởng tuyến giữa, mắt xích nối phòng ngự với tấn công

```
Vertical 9:16 football poster artwork featuring Federico Valverde, the Uruguayan midfielder for Real Madrid and the Uruguay national team, in a commanding hero pose driving forward with the ball at full stride, intense focused expression, sleeves rolled. He wears a sky-blue Uruguay home kit with the Uruguay AUF sun crest clearly visible on the chest. Background: a bold sky-blue Uruguay graphic backdrop with a huge stylized Uruguay sun crest floating faintly behind him as a watermark, the golden Sun of May glowing as a graphic accent, dramatic light rays radiating outward from behind. Vibrant saturated sky-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Uruguay crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [5] nunez → `nunez.png` — Darwin Nunez (Uruguay / Al-Hilal)

**Subject:** Vua phá lưới vòng loại Nam Mỹ của Uruguay với 5 bàn, nay đá ngay tại Saudi Arabia

```
Vertical 9:16 football poster artwork featuring Darwin Nunez, the Uruguayan striker for the Uruguay national team, in an explosive signature goal celebration with arms spread wide and a fierce roar, muscular driving energy. He wears a sky-blue Uruguay home kit with the Uruguay AUF sun crest clearly visible on the chest. Background: a bold sky-blue Uruguay graphic backdrop with a huge stylized Uruguay sun crest floating faintly behind him as a watermark, the golden Sun of May glowing as a graphic accent, dramatic golden light rays radiating outward, faint stylized fan-crowd silhouettes in sky-blue at the lower frame. Vibrant saturated sky-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Uruguay crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [6] salem → `salem.png` — Salem Al-Dawsari (Saudi Arabia)

**Subject:** Cầu thủ xuất sắc nhất châu Á đương nhiệm, niềm hy vọng số một của Saudi

```
Vertical 9:16 football poster artwork featuring Salem Al-Dawsari, the Saudi Arabian winger and captain for the Saudi Arabia national team, in a hero pose cutting inside on the ball with sharp dribbling intent, determined expression. He wears a white Saudi Arabia home kit with green trim and the Saudi Arabia football federation crest clearly visible on the chest, the captain's armband on his left arm. Background: a bold green-and-white Saudi Arabia graphic backdrop with a huge stylized Saudi Arabia crest floating faintly behind him as a watermark, the green Saudi flag with its palm-and-swords emblem rendered as a graphic motif, dramatic green light rays radiating outward, faint stylized green-clad fan silhouettes at the lower edge. Vibrant saturated green-and-white palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup matchday promotional poster. The Saudi Arabia crest visible on the jersey, no on-image text or captions, no scoreboard graphics.
```

---

## [7] managers → `managers.png` — Split-frame: Donis (Saudi) vs Bielsa (Uruguay)

**Subject:** Đối đầu băng ghế — tân HLV Georgios Donis vs Marcelo Bielsa. Gen 2 ảnh đơn dưới đây.

### managers-1 (trái) → `managers-1.png` — Georgios Donis (Saudi Arabia)

```
Vertical 9:16 football poster artwork featuring Georgios Donis, the Greek manager of the Saudi Arabia national team, framed chest-up with his head in the upper third, in a sharp dark touchline jacket giving tactical instructions with an intense focused expression. Background: a bold green-and-white Saudi Arabia graphic backdrop with a huge stylized Saudi Arabia crest floating faintly behind him as a watermark, the green Saudi flag with its palm-and-swords emblem rendered as a graphic motif, dramatic green light rays radiating outward. Vibrant saturated green-and-white palette with gold highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup managers-duel promotional poster. No on-image text or captions, no scoreboard graphics.
```

### managers-2 (phải) → `managers-2.png` — Marcelo Bielsa (Uruguay)

```
Vertical 9:16 football poster artwork featuring Marcelo Bielsa, the Argentine manager of the Uruguay national team, framed chest-up with his head in the upper third, in a grey training top in his iconic intense touchline pose. Background: a bold sky-blue Uruguay graphic backdrop with a huge stylized Uruguay sun crest floating faintly behind him as a watermark, the golden Sun of May from the Uruguayan flag glowing as a graphic accent, dramatic light rays radiating outward. Vibrant saturated sky-blue palette with golden highlights, very high contrast, glossy graphic-design finish. Stylized like a World Cup managers-duel promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Tip — gen ảnh song song để tiết kiệm thời gian.** Mở **9** tab grok.com cùng lúc, paste prompt vào từng tab, bấm generate đồng loạt rồi mới chờ. Cắt thời gian từ ~10-15 phút (sequential) xuống ~3-5 phút (batch parallel).

1. Mở https://grok.com trên **9 tab cùng lúc** → Imagine, aspect ratio **9:16**.
2. Copy từng block prompt phía trên, paste vào tab tương ứng, bấm generate **đồng loạt rồi mới chờ tất cả xong**.
3. Save mỗi ảnh vào cùng folder với .txt (`video/input/nhan-dinh-saudi-arabia-vs-uruguay-wc-2026/`) với stem đúng như file đã ghi:
   - Split-frame: `hook-1`, `hook-2`, `managers-1`, `managers-2` (pipeline tự ghép thành `hook.png` + `managers.png`).
   - Ảnh đơn: `score-pred`, `h2h-2018`, `valverde`, `nunez`, `salem`.
   - **Extension nào cũng được:** `.png` / `.jpg` / `.jpeg` / `.webp`. Grok export `.jpg` thì giữ nguyên.
4. Hai đội hình dự kiến (Saudi 4-2-3-1 + Uruguay 4-3-2-1) KHÔNG cần ảnh — render bằng template `formation-pitch` (sân xanh + token cầu thủ).
5. Khi đủ ảnh, chạy: `/create-video video/input/nhan-dinh-saudi-arabia-vs-uruguay-wc-2026/nhan-dinh-saudi-arabia-vs-uruguay-wc-2026.txt`
