# Grok prompts — Tám cặp anh em ruột thi đấu tại World Cup 2026

**1 ảnh hook + 8 cặp (mỗi cặp 2 ảnh đơn) = 17 ảnh.** Gen trên grok.com (Imagine, tỉ lệ **9:16**), save về cùng folder này theo đúng tên file.

> ⚙️ **Split-frame tự động.** Mỗi cặp anh em chỉ cần **2 ảnh đơn** (1 người/ảnh) đặt tên `<scene>-1` và `<scene>-2`. Khi bạn chạy `/create-video`, bước `images:stage` sẽ **tự ghép** `<scene>-1` + `<scene>-2` → `<scene>.png` (split trái | gạch vàng | phải). Khỏi cần tìm ảnh chụp chung 2 người.
> Nếu bạn TÌNH CỜ có sẵn 1 ảnh chụp chung 2 người đẹp → cứ lưu thẳng thành `<scene>.png` và **bỏ qua** 2 ảnh `-1/-2` của cặp đó; helper thấy không có `-1/-2` thì để nguyên.
> Muốn xem trước bản ghép mà chưa render: `npm run images:combine -- video/input/tam-cap-anh-em-ruot-tai-world-cup-2026`

---

## [1] hook → `hook.png`

**Subject:** Hero hook — 8 cặp anh em ruột tại World Cup 2026

```
Vertical 9:16 football poster artwork celebrating brother pairs at the FIFA World Cup 2026. Centre composition: two elite footballers standing back-to-back in a heroic pose, both in generic national-team kits, arms folded, intense confident expressions, symbolizing siblings on opposite teams. Background: a layered gold-and-navy graphic backdrop with a huge stylized FIFA World Cup 2026 trophy floating faintly as a glowing watermark, dramatic golden light rays radiating outward from behind the two figures, faint stylized flags of France, Spain, Netherlands and Ghana arranged as graphic color bands flanking the lower frame. Vibrant saturated gold-and-blue palette, very high contrast, glossy graphic-design finish. Stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [2] Cặp Doué — `pair-doue.png` (ghép từ -1 + -2)

### `pair-doue-1.png` — Guela Doué (Bờ Biển Ngà / Strasbourg)
```
Vertical 9:16 football poster artwork of Guela Doue, the Ivorian right-back for Strasbourg and the Côte d'Ivoire national team, in an orange Côte d'Ivoire national kit, confident hero pose, framed chest-up with his head in the upper third. Orange-and-green graphic backdrop with a faint Côte d'Ivoire flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-doue-2.png` — Desiré Doué (Pháp / PSG)
```
Vertical 9:16 football poster artwork of Desire Doue, the young French forward for Paris Saint-Germain and the France national team, in a navy-blue France national kit, dynamic celebration pose, framed chest-up with his head in the upper third. Navy-and-red France graphic backdrop with a faint French cockerel motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [3] Cặp Williams — `pair-williams.png` (ghép từ -1 + -2)

### `pair-williams-1.png` — Iñaki Williams (Ghana / Bilbao)
```
Vertical 9:16 football poster artwork of Inaki Williams, the Ghanaian forward for Athletic Bilbao and the Ghana national team, in a white-and-black Ghana national kit, powerful driving-forward hero pose, framed chest-up with his head in the upper third. Black-white-and-red Ghana graphic backdrop with a faint Ghana flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-williams-2.png` — Nico Williams (Tây Ban Nha / Bilbao)
```
Vertical 9:16 football poster artwork of Nico Williams, the Spanish winger for Athletic Bilbao and the Spain national team, in a red Spain national kit, explosive sprinting pose, framed chest-up with his head in the upper third. Red-and-gold Spain graphic backdrop with a faint Spain flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [4] Cặp Souttar — `pair-souttar.png` (ghép từ -1 + -2)

### `pair-souttar-1.png` — John Souttar (Scotland / Rangers)
```
Vertical 9:16 football poster artwork of John Souttar, the Scottish centre-back for Rangers and the Scotland national team, in a dark-blue Scotland national kit, commanding defensive hero pose, framed chest-up with his head in the upper third. Navy-and-white Scotland graphic backdrop with a faint Saltire flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-souttar-2.png` — Harry Souttar (Australia)
```
Vertical 9:16 football poster artwork of Harry Souttar, the very tall Australian centre-back for the Australia national team, in a gold Australia national kit, towering aerial defensive pose, framed chest-up with his head in the upper third. Green-and-gold Australia graphic backdrop with a faint Australian flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [5] Cặp Brobbey — `pair-brobbey.png` (ghép từ -1 + -2)

### `pair-brobbey-1.png` — Derrick Brobbey (Ghana)
```
Vertical 9:16 football poster artwork of Derrick Brobbey, the Ghanaian forward for the Ghana national team, in a white-and-black Ghana national kit, determined hero pose, framed chest-up with his head in the upper third. Black-white-and-red Ghana graphic backdrop with a faint Ghana flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-brobbey-2.png` — Brian Brobbey (Hà Lan / Sunderland)
```
Vertical 9:16 football poster artwork of Brian Brobbey, the powerful Dutch striker for Sunderland and the Netherlands national team, in a bright-orange Netherlands national kit, strong physical shielding pose, framed chest-up with his head in the upper third. Orange graphic backdrop with a faint Netherlands lion crest motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [6] Cặp Timber — `pair-timber.png` (ghép từ -1 + -2) — sinh đôi, tuyển Hà Lan

### `pair-timber-1.png` — Jurriën Timber (Arsenal)
```
Vertical 9:16 football poster artwork of Jurrien Timber, the Dutch defender for Arsenal and the Netherlands national team, in a bright-orange Netherlands national kit, composed commanding defensive hero pose, framed chest-up with his head in the upper third. Orange graphic backdrop with a faint Netherlands lion crest motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-timber-2.png` — Quinten Timber (Marseille)
```
Vertical 9:16 football poster artwork of Quinten Timber, the Dutch midfielder for Marseille and the Netherlands national team, in a bright-orange Netherlands national kit, mid-stride driving pose, framed chest-up with his head in the upper third. Orange graphic backdrop with a faint Netherlands lion crest motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [7] Cặp Hernández — `pair-hernandez.png` (ghép từ -1 + -2) — tuyển Pháp

### `pair-hernandez-1.png` — Lucas Hernández (Pháp / PSG)
```
Vertical 9:16 football poster artwork of Lucas Hernandez, the French defender for Paris Saint-Germain and the France national team, in a navy-blue France national kit, gritty determined defensive hero pose, framed chest-up with his head in the upper third. Navy-and-red France graphic backdrop with a faint French cockerel motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-hernandez-2.png` — Theo Hernández (Pháp / Al Hilal)
```
Vertical 9:16 football poster artwork of Theo Hernandez, the French left-back for Al Hilal and the France national team, in a navy-blue France national kit, explosive overlapping attacking-run pose, framed chest-up with his head in the upper third. Navy-and-red France graphic backdrop with a faint French cockerel motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [8] Cặp Bacuna — `pair-bacuna.png` (ghép từ -1 + -2) — tuyển Curaçao

### `pair-bacuna-1.png` — Leandro Bacuna (đội trưởng)
```
Vertical 9:16 football poster artwork of Leandro Bacuna, the Curaçao captain and former Premier League player, in a royal-blue Curaçao national kit with a captain's armband, proud leadership hero pose, framed chest-up with his head in the upper third. Royal-blue-and-yellow Curaçao graphic backdrop with a faint Curaçao flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-bacuna-2.png` — Juninho Bacuna
```
Vertical 9:16 football poster artwork of Juninho Bacuna, the Curaçao midfielder, in a royal-blue Curaçao national kit, energetic driving-forward pose, framed chest-up with his head in the upper third. Royal-blue-and-yellow Curaçao graphic backdrop with a faint Curaçao flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## [9] Cặp Duarte — `pair-duarte.png` (ghép từ -1 + -2) — tuyển Cape Verde

### `pair-duarte-1.png` — Laros Duarte (Puskás Akadémia)
```
Vertical 9:16 football poster artwork of Laros Duarte, the Cape Verde midfielder for Puskás Akadémia in Hungary, in a blue Cape Verde national kit, composed playmaking hero pose, framed chest-up with his head in the upper third. Blue-white-and-red Cape Verde graphic backdrop with a faint Cape Verde flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```
### `pair-duarte-2.png` — Deroy Duarte (Ludogorets)
```
Vertical 9:16 football poster artwork of Deroy Duarte, the Cape Verde midfielder for Ludogorets Razgrad in Bulgaria, in a blue Cape Verde national kit, dynamic passing pose, framed chest-up with his head in the upper third. Blue-white-and-red Cape Verde graphic backdrop with a faint Cape Verde flag motif and radiating light rays. Single subject, centered. Vibrant saturated palette, very high contrast, glossy graphic-design finish, stylized like a FIFA World Cup promotional poster. No on-image text or captions, no scoreboard graphics.
```

---

## Tiếp theo

⚡ **Gen song song.** Mở nhiều tab grok.com cùng lúc (Imagine, 9:16), paste prompt, bấm generate đồng loạt rồi mới chờ.

1. Mỗi cặp: gen **2 ảnh đơn**, lưu đúng tên `<scene>-1` và `<scene>-2` (ví dụ `pair-doue-1.jpg`, `pair-doue-2.jpg`). Hook lưu `hook.png`.
   - Đuôi nào cũng được: `.png` / `.jpg` / `.jpeg` / `.webp`.
2. (Tùy chọn) xem trước bản ghép: `npm run images:combine -- video/input/tam-cap-anh-em-ruot-tai-world-cup-2026`
3. Khi đủ ảnh, chạy: `/create-video video/input/tam-cap-anh-em-ruot-tai-world-cup-2026/tam-cap-anh-em-ruot-tai-world-cup-2026.txt`
   - Bước `images:stage` sẽ tự ghép các cặp `-1/-2` → `<scene>.png` rồi mới render. Không cần thao tác thủ công.
