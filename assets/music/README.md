# Thư viện nhạc nền — assets/music/

Nhạc nền cho pipeline `/create-video`. Thả file nhạc vào đây là xong: mỗi lần render, pipeline tự chọn **ngẫu nhiên 1 track** trong thư mục, lặp cho đủ độ dài video, và **ducking** (tự hạ nhạc xuống mỗi khi có tiếng nói).

Thư mục rỗng → không có nhạc, pipeline chạy bình thường như trước.

## Cách bật/tắt

| Muốn gì | Làm gì |
|---|---|
| Bật (mặc định) | Thả file `.mp3` / `.m4a` / `.wav` vào thư mục này |
| Tắt hẳn | `.env.local`: `VIDEO_BG_MUSIC=` (để trống) |
| Ghim đúng 1 bài | `.env.local`: `VIDEO_BG_MUSIC=ten-bai.mp3` |
| Dùng file ngoài thư mục | `VIDEO_BG_MUSIC=C:/duong/dan/bai.mp3` |
| To/nhỏ hơn | `VIDEO_BG_MUSIC_VOLUME=0.22` (mặc định) |

### Thang volume — đo trên nhạc thật, không phải ước lượng

Đo với nhạc thư viện Pixabay (mean ~−10,5 dB) dưới giọng đã dynaudnorm (mean ~−16,3 dB). Cột "cách giọng" là khoảng cách sau ducking; **chuẩn phát thanh cho nhạc nền dưới lời dẫn là 15–20 dB**.

| volume | bed | cách giọng | đánh giá |
|---|---|---|---|
| 0.10 | −37,4 dB | 21,1 dB | rất kín đáo, chủ kênh chê "như không có nhạc" |
| 0.14 | −34,4 dB | 18,1 dB | vừa, giữa chuẩn |
| 0.18 | −32,3 dB | 16,0 dB | rõ, vẫn trong chuẩn |
| **0.22** | −30,5 dB | **14,2 dB** | **mặc định — chủ kênh chọn sau khi nghe A/B** |

Mức 0.22 nằm hơi dưới chuẩn 15–20 dB, tức nhạc tranh với giọng nhiều hơn thông lệ. Đây là **lựa chọn có chủ đích của chủ kênh (2026-07-31)**, không phải sơ suất — đừng tự hạ xuống, muốn đổi thì hỏi.

⚠️ **0.22 là trần** — cao hơn nữa thì nhạc **át đuôi phụ âm tiếng Việt** (-ng, -nh, -n, -m), đúng lỗi đã bắt SFX phải cap ở 0.22. Ducking giúp nhiều nhưng không cứu được nếu volume quá tay.

Đỉnh đầu ra giữ ~−1,4 dB ở mọi mức nhờ `alimiter` cuối chuỗi (giọng sau dynaudnorm vốn đã chạm 0 dBFS, không có limiter là vỡ tiếng).

## ⚠️ Bản quyền — đọc trước khi thả file vào

**KHÔNG có loại nhạc nào "chắc chắn 100% không dính bản quyền".** Ngay cả nhạc miễn phí hợp lệ vẫn có thể bị Content ID quét nhầm (thường gỡ được bằng khiếu nại, nhưng mất thời gian). Mức độ an toàn thực tế, từ cao xuống thấp:

**1. An toàn nhất — thư viện của chính nền tảng**
- **TikTok Commercial Music Library**: chọn nhạc *trong app* khi đăng, dành riêng cho tài khoản Business. An toàn nhất trên TikTok vì chính TikTok cấp phép. Nhược điểm: phải thêm lúc đăng, không nằm sẵn trong file mp4.
- **YouTube Audio Library** (studio.youtube.com → Audio Library): miễn phí, dùng thương mại được, an toàn trên YouTube. Có bộ lọc "không cần ghi nguồn". Tải về được nên **thả thẳng vào thư mục này được**.

**2. Rất an toàn — trả phí có giấy phép + gỡ claim cho kênh**
- **Epidemic Sound**, **Artlist**, **Uppbeat** (có gói free), **Soundstripe**. Trả phí tháng, đổi lại có license rõ ràng và cơ chế whitelist kênh để không bị claim. Nếu kênh làm nghiêm túc, đây là lựa chọn đáng tiền nhất.

**3. Miễn phí, cần đọc kỹ điều khoản**
- **Pixabay Music** (pixabay.com/music) — license riêng của Pixabay, dùng thương mại được, không cần ghi nguồn. Dễ tải nhất.
- **Free Music Archive** — lọc `CC0` hoặc `CC BY`. `CC0` = tự do hoàn toàn. `CC BY` = **bắt buộc ghi nguồn** trong mô tả video.
- **Incompetech** (Kevin MacLeod) — `CC BY`, phải ghi nguồn đúng cú pháp họ yêu cầu.
- **Chosic**, **Bensound** (bản free cần ghi nguồn).

**4. TUYỆT ĐỐI KHÔNG** — nhạc thương mại, nhạc phim, nhạc trending trên TikTok tải từ YouTube/SoundCloud. Kể cả chỉ dùng 10 giây, kể cả đã hạ nhỏ volume.

> 📌 `assets/beat/` (dùng cho pipeline podcast) hiện đang có `seeyouagain.mp3` và `vetmua.m4a` — **đây là nhạc thương mại, sẽ bị claim**. Đừng copy chúng sang thư mục này. Pipeline podcast mặc định đã tắt nhạc nền vì đúng lý do đó.

## Gợi ý chọn nhạc cho kênh bóng đá

Tin tức/phân tích bóng đá hợp với: **cinematic sports**, **epic hybrid trailer**, **driving percussion**, **tension underscore**. Tránh nhạc có lời (đá nhau với giọng đọc), tránh nhạc đổi nhịp mạnh giữa bài (video cắt cảnh theo giọng nói, không theo nhạc).

Nên có sẵn 4–6 track để mỗi video ra một bài khác nhau — pipeline tự random nên không phải chỉnh gì.

## Nhật ký giấy phép

Mỗi lần thêm track, ghi 1 dòng vào đây. Sau này bị claim còn có bằng chứng nguồn gốc.

| File | Tên bài / tác giả | Nguồn | Giấy phép | Cần ghi nguồn? | Ngày tải |
|---|---|---|---|---|---|
| _(chưa có track nào)_ | | | | | |
