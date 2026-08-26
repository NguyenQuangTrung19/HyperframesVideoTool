---
name: match-preview
description: Read a football match link (Goal.com match page, preview article, fixture URL, or a "X vs Y" topic), confirm it's a PRE-MATCH PREVIEW, then research and write a rich Vietnamese preview .txt under SportsForAllTV with score prediction + probable lineups for BOTH teams + expected playing style of each team + stars to watch + press-conference quotes from BOTH managers, save it to video/input/<slug>/<slug>.txt, and chain into images-for-videos. If the link is NOT a preview, hand off to /read-rewrite. The user-facing slash command is /match-preview <url-or-topic>.
---

# Match-Preview Skill

Match link → classify → (if preview) research-rich Vietnamese preview `.txt` → image plan, in one command.

This is the **preview-specialized entry point** for the video pipeline. It exists because a pre-match preview needs data that a single article page rarely carries in full — both probable XIs, a score prediction, and press-conference quotes from both camps. Goal.com match pages in particular are JS-rendered, so `WebFetch` returns only the page chrome. This skill compensates by **researching across sources with WebSearch**, not by trusting one fetch.

The output `.txt` matches the canonical preview shape proven on `video/input/nhan-dinh-han-quoc-vs-sec-wc-2026/` and `video/input/nhan-dinh-canada-vs-bosnia-wc-2026/`. Downstream, `/images-for-videos` plans hero images and `/create-video` renders the 9:16 motion-graphic video.

## When to use

User runs `/match-preview <url-or-topic>`, OR pastes a match/fixture link and asks for a preview. Examples:

- `/match-preview https://www.goal.com/en/match/canada-vs-bosnia-and-herzegovina/lineups/JJwT9wAsUuHF3aoeMKYNC`
- `/match-preview https://www.goal.com/en/match/republic-of-korea-vs-czechia/fE4Kl8TDt5GkVQ9xvEl14`
- `/match-preview https://www.espn.com/soccer/.../preview`
- `/match-preview Hàn Quốc vs Séc World Cup 2026` (topic string, no URL — go straight to research)

## Input contract

A single argument: either a `http(s)://` URL pointing to a match/fixture/preview page, or a free-text "X vs Y [competition]" topic string. Both are accepted — a URL gives a starting anchor, a topic string skips straight to research. If the argument is empty, ask which two teams + competition.

## Workflow (MUST follow in order)

### Step 1: Read the link (best-effort) + identify the fixture

If given a URL, `WebFetch` it once to pull the basics: the two teams, date, venue, competition, and any preview body that does render.

> Extract the two teams, kickoff date, venue, competition/round, and any preview text, probable lineups, team news, quotes, prediction, and odds present. List every player name exactly.

**Expect a thin result from Goal.com match pages — that is normal, not a failure.** Goal.com (and many fixture pages) render lineups/predictions client-side, so `WebFetch` returns mostly navigation. Do NOT bail. Take whatever the fetch gives (usually teams + date + venue + competition), then move to Step 2 to fill the rest with search.

If given only a topic string, skip the fetch — go to Step 2.

### Step 2: Confirm content type

This skill is for **PRE-MATCH PREVIEW** only (including tournament-scope squad/fixture previews). Confirm via [`classify-football-content`](../classify-football-content/SKILL.md) signals — future tense, upcoming date, no final score, lineup speculation, head-to-head framing.

- If it classifies as **PRE-MATCH PREVIEW** → continue.
- If it is clearly a different type (match recap with a final score, transfer news, ranking, profile, drama, etc.) → **do not force the preview format.** Tell the user one line and hand off to [`read-rewrite`](../read-rewrite/SKILL.md):
  ```
  ℹ Link này là <TYPE>, không phải preview trước trận → chuyển sang /read-rewrite để xử lý đúng format.
  ```
  Then invoke `/read-rewrite` on the same URL and stop following this skill.
- If the source isn't football at all → bail: `⚠ Link này không phải bóng đá — SportsForAllTV chỉ làm content bóng đá.`

### Step 3: Research the preview (WebSearch — the core step)

Gather the full picture with WebSearch (fire several queries; prefer Sports Mole, Opta/The Analyst, ESPN, WhoScored, RotoWire, FIFA, UEFA, CBC, club/federation sites, and the channel's usual VN sources). Collect ALL of:

1. **Stakes / context** — competition, group, round, what's on the line; venue; qualification route.
2. **Recent form + head-to-head (from the Overview)** — each team's **last 5 results** with actual scorelines (friendlies, qualifiers, playoff), most recent first, AND the all-time head-to-head record between the two teams (W-D-L, standout/World Cup meeting, last meeting, or "first-ever meeting" if they've never played). The match-page Overview is the primary source; search `"<teamA> last 5 results 2026"`, `"<teamB> recent results form"`, `"<teamA> vs <teamB> head to head"`. ⚠️ Attribute each result to the correct team — send-off friendlies are team-specific, easy to mix up. This feeds 2 dedicated scenes downstream (H2H feature-list + ONE combined `form-compare` board showing BOTH teams' recent results side by side — NOT a separate board per team).
   - **⚠️ MATCHDAY 2+ OF A TOURNAMENT GROUP — the previous group game IS the most recent result and MUST lead the form + anchor the analysis (user 2026-06-18).** When the fixture is matchday 2/3 of a group, each team has already played 1–2 games in THIS tournament. Those results are the freshest and most relevant — they MUST be the first entry in the team's last-5 list, tagged `(World Cup)`, and the lead paragraph + analysis MUST reference the previous group match (e.g. "Canada bị Bosnia cầm chân 1-1 ở lượt mở màn, nay tiếp Qatar"). Do NOT lead the form with pre-tournament friendlies.
   - **VERIFY each tournament result with a dedicated per-team search — do not trust one aggregated form list.** Tournament results are AFTER the assistant's knowledge cutoff, so a wrong scoreline or a vague "chuỗi vòng loại" placeholder slips through easily. Search `"<teamA> vs <opponent> World Cup 2026 result score"` for EACH team's group game(s) and confirm the exact scoreline + scorers before writing. (Real misses caught 2026-06-18: a 0-2 written as 0-1; one side's last-5 left as "hòa X, và chuỗi vòng loại trước đó" with no scorelines.)
3. **Probable lineups for BOTH teams** — formation + the full starting XI (every named player). This is mandatory; a preview without both XIs is incomplete. If a source only gives one team, search again for the other.
4. **Score prediction — kênh TỰ CHỐT, không copy 1 nguồn (user 2026-06-16, bỏ ESPN/O'Hanlon scoreline).** Tổng hợp dữ kiện ĐÃ có ở các mục trên thành MỘT tỷ số "kênh dự đoán":
   - **Đội kèo trên** = đội có Opta win% cao hơn. Nếu Opta sát nhau (chênh ≲10 điểm %) → nghiêng hòa hoặc thắng sát 1 bàn.
   - **Biên độ bàn** từ form 5 trận: đội ghi đều/thủ chắc → +1 cách biệt; cả hai cùng ghi bàn tốt → tỷ số mở (2-1, 2-2); hàng thủ 1 đội rò rỉ (thủng lưới ở ≥5 trận gần) → cho thủng thêm. H2H lệch hẳn thì nghiêng theo.
   - **Mỏ neo (anchor):** đối chiếu với tỷ số `We say: X-Y` mà Sports Mole in sẵn trên trang preview (cùng trang lấy đội hình). Nếu hợp lý với suy luận Opta+form → chốt gần nó; nếu lệch nhiều → tin suy luận của mình, đừng copy mù.
   Chốt **1 tỷ số duy nhất**, trình bày là "Dự đoán của kênh". Opta % vẫn nêu như dữ kiện hỗ trợ (ghi "theo Opta"). **KHÔNG dùng tỷ số ESPN / O'Hanlon / DTAI nữa.**
5. **Stars to watch** — **2–3 marquee names PER TEAM (so 4–6 total), balanced across both sides** (top scorer, captain, playmaker, breakout talent, key defender/keeper), each with a concrete stat. **This is a knockout-stage upgrade (2026-07-06): the deeper the round, the more the individual duels matter, so give each team its own 2–3 named stars — not a shared pool of 2–3.** Keep each BRIEF (see the section rule below) — one tight fact per name, not a paragraph. Downstream each becomes its own `stat-hero` image scene, so name real, image-worthy players.
   - **Anchor each star's fact to their MOST RECENT showing, not a stale season/career stat (user 2026-06-18).** For matchday 2+ fixtures that means the group opener: who scored, shone, or flopped THERE (e.g. "Vinicius là Cầu thủ hay nhất trận hòa Maroc", "Jonathan David mờ nhạt, sút thẳng vào thủ môn", "Güler tung 8 cú sút nhiều nhất giải mà chưa có bàn"). Search the opener's player ratings (`"<teamA> vs <opp> player ratings World Cup 2026"`) to get this. Prefer the latest match over "ghi bàn thứ 15 vào lưới Bolivia" type older references.
   - If a team's actual standout from the last match isn't a marquee/imaged star, still surface them inside that team's blurb (e.g. note the super-sub or goalscorer) rather than dropping the most relevant name.
6. **Team news** — injuries, suspensions, doubtful starters, new call-ups.
7. **Press-conference quotes from BOTH managers** — at least one substantive quote per side, attributed to the named manager. Search e.g. `"<manager> press conference <opponent> <competition>"`. If a real quote for one side genuinely can't be found, summarize that manager's stated approach/philosophy instead of fabricating a quote.
8. **Expected playing style / tactical approach per team — richer for knockouts (2026-07-06).** For EACH team gather enough to fill a tactical board: (a) an **approach headline** (≤28 chars, e.g. "Kiểm soát & pressing", "Phòng ngự phản công", "Chơi biên & tạt cánh"), (b) **2–3 concrete mechanisms** (≤42 chars each — how they build, where they press, the transition trigger, set-piece threat; e.g. "Lên bóng qua số 6 Rodri", "Vây ráp ngay phần sân đối thủ", "Rình phản công tốc độ Mbappe"), and (c) the **1 tactical linchpin** whose name anchors the plan ("chìa khóa"). Search `"<team> tactics style of play 2026"`, `"<manager> system <team>"`, plus how they set up in the previous knockout/group game. Aim for the CONTRAST between the two sides (one controls, the other springs). This feeds the dedicated **`tactics-board`** scene downstream (two-column đấu pháp graphic) — so it's now a small structured block per team, not one throwaway line.

Run queries in parallel where independent. Cross-check names/numbers across ≥2 sources when they disagree; prefer the most recent (the current month is shown in the environment).

**When sources give different XIs/formations, DON'T list both — pick ONE from the more authoritative source.** Probable lineups genuinely differ source-to-source (e.g. Sports Mole may predict 4-2-3-1 while WhoScored predict 4-3-3); commit to the higher-trust pick rather than hedging with "4-3-3 / 4-2-3-1". Trust order, highest first:
1. Official federation / FIFA / UEFA team-sheet or confirmed XI
2. Opta / The Analyst
3. WhoScored, RotoWire (data-backed, update close to kickoff)
4. Editorial previews written early — Sports Mole, ESPN (good for context/quotes, but their XI was often penned days out)

Within the same tier, prefer the source updated latest. Still flag a genuinely doubtful starter inline (e.g. `Mazraoui (?)`) when team news is unsettled — that's an honest signal, not hedging.

**DEFAULT lineup source = Sports Mole (user choice 2026-06-13).** For the probable XIs, default to **Sports Mole's predicted-lineup page** — it prints both XIs as TEXT, so `WebFetch` reads them directly (fast, cheap, fully automatable). Use the dedicated `predicted-lineups/...predicted-<team>-lineup-vs-<opp>` pages (cleanest), or the `preview/...prediction-team-news-lineups` page (both XIs). WhoScored, RotoWire, ESPN are text fallbacks if Sports Mole is missing a team.

**Win probabilities = Opta / The Analyst (TEXT, no vision).** The Analyst prediction pages print Opta supercomputer win/draw/win % as text — `WebFetch` extracts them directly. Cite these as "theo Opta". Do NOT read the Opta lineup GRAPHIC by default — `curl`+vision on the predicted-lineup image works but costs ~3-4× the tokens + manual steps, so only do it if the user explicitly asks for Opta lineups on a marquee match.

**SofaScore and FotMob are JS SPAs behind Cloudflare** — both the page and their JSON API return 403/empty to fetch, so DON'T plan on them; only use a SofaScore/FotMob XI if the user pastes/screenshots it.

### Step 4: Write the preview .txt (EXACT template)

Write this literal structure (plain markdown, UTF-8). This is the canonical preview shape — match it section-for-section:

```markdown
Nhận định <Đội A> vs <Đội B> — <giải đấu>: dự đoán tỷ số, đội hình và những cái tên đáng xem

<Lead 1 đoạn: chủ nhà / bối cảnh, sân + ngày, điều đặt cược (stakes), hành trình 2 đội. Kết câu lead bằng:> Video ngắn — tập trung dự đoán, đội hình, ngôi sao hai đội và phát biểu họp báo.

## Dự đoán tỷ số
- Dự đoán của kênh: <đội> thắng <tỷ số>, <lý do 1 vế>.
- <Mô hình/tipster ngoài: Opta %, Sports Mole tỷ số, kèo nghiêng đội nào>.
- <Ghi chú chiến thuật: vì sao trận chặt / cởi mở, điểm mạnh mỗi bên>.

## Phong độ gần đây & đối đầu
- Đối đầu: <thành tích H2H W-D-L / "lần đầu gặp nhau"> · <trận lịch sử/World Cup nổi bật + tỷ số> · <lần gần nhất + tỷ số>.
- <Đội A> · 5 trận gần nhất: <kq1>, <kq2>, <kq3>, <kq4>, <kq5> (mỗi kết quả kèm đối thủ + tỷ số, mới nhất trước).
- <Đội B> · 5 trận gần nhất: <kq1>, <kq2>, <kq3>, <kq4>, <kq5> (mỗi kết quả kèm đối thủ + tỷ số, mới nhất trước).

## Đội hình dự kiến
- <Đội A> (<sơ đồ>): <GK>; <hậu vệ>; <tiền vệ>; <tiền đạo>.
- <Đội B> (<sơ đồ>): <GK>; <hậu vệ>; <tiền vệ>; <tiền đạo>.

## Lối chơi dự kiến
- <Đội A> (<sơ đồ>) — <approach headline ≤28 ký tự>: <cơ chế 1>; <cơ chế 2>; <cơ chế 3 nếu có>. Chìa khóa: <1 cầu thủ>.
- <Đội B> (<sơ đồ>) — <approach headline>: <cơ chế 1>; <cơ chế 2>; <cơ chế 3 nếu có>. Chìa khóa: <1 cầu thủ>. (nêu rõ tương phản với đội A nếu có — vd A cầm bóng, B rình phản công.)

## Ngôi sao đáng xem
- <Đội A — Cầu thủ 1> (<CLB/tuổi>): <vai trò + 1 số liệu cụ thể, gắn màn trình diễn gần nhất>.
- <Đội A — Cầu thủ 2> (<CLB/tuổi>): <vai trò + số liệu>.
- <Đội B — Cầu thủ 1> (<CLB/tuổi>): <vai trò + số liệu>.
- <Đội B — Cầu thủ 2> (<CLB/tuổi>): <vai trò + số liệu>.
- (tùy chọn — trận lớn thêm Cầu thủ 3 mỗi đội; tổng 4–6 ngôi sao, cân đối 2 đội.)

## Tin lực lượng
- <Chấn thương / treo giò / nghi ngờ ra sân của đội A>.
- <Chấn thương / treo giò của đội B>.

## Phát biểu họp báo đáng chú ý
- <HLV đội A> (huấn luyện viên <đội A>, <ghi chú>): "<trích dẫn>". <Câu thứ hai nếu có>.
- <HLV đội B> (huấn luyện viên <đội B>, <ghi chú>): "<trích dẫn>" hoặc <tóm tắt triết lý nếu không có quote thật>.

---
## Giới hạn thời lượng (cho /create-video — KHÔNG đọc lên, KHÔNG lên hình)
- Mục tiêu: 55-65 giây. Trần cứng: 65 giây.
- Tổng voiceText MỌI scene cộng lại: **≤ 240 từ** (đo thật 0,256 giây/từ trên 27 video đã render).
- **Mỗi body scene tối đa 2 câu, ≤ 26 từ** — 1 cảnh = 1 hình đứng yên ~6,5 giây. Hook ≤ 18 từ.
- Số scene GIỮ NGUYÊN — video dài hơn bằng cách nói đầy hơn mỗi cảnh, không phải bằng cách thêm cảnh.
- Tổng scene: **≤ 13** (9 ảnh + tactics-board / form-compare / formation-pitch + engagement-question + outro). Preview được nới 13 vì có nhiều scene data-driven bắt buộc.
- Fact nào không kịp nói thì cho lên `highlights`/`context` để người xem tắt tiếng vẫn đọc được.
- Check trước khi render: `npx tsx _validate-script.ts <script.json>` (chặn cứng, exit 1 = không render).

---
Nguồn: <domain1>, <domain2>, ... · <full URL gốc>
Ngày: <ngày xuất bản / today>
```

⚠️ **Block `## Giới hạn thời lượng` là BẮT BUỘC** (2026-08-03) — copy nguyên văn. Nó nằm ở khu metadata sau `---` nên không trôi vào voiceText. Preview là type dễ phình nhất vì có sẵn nhiều scene data-driven (tactics-board, form-compare, formation-pitch, comparison scoreboard) **tốn thời lượng y hệt scene có ảnh** — chúng chỉ tiết kiệm công gen ảnh, KHÔNG tiết kiệm thời lượng. Đếm chúng vào trần 13 scene ngay từ lúc plan. Dưới luật nhịp mới chúng cũng chỉ được ≤26 từ thoại như mọi cảnh khác: bảng đấu pháp / đội hình tự nó đã nói hết, giọng chỉ cần một câu dẫn.

Section rules:

- **Title (line 1):** keep the literal pattern `Nhận định <A> vs <B> — <giải đấu>: dự đoán tỷ số, đội hình và những cái tên đáng xem`. Sentence case. Keep `vs` and the tournament name readable (e.g. `World Cup 2026`).
- **Lead:** 1 paragraph, ends with the fixed sentence `Video ngắn — tập trung dự đoán, đội hình, ngôi sao hai đội và phát biểu họp báo.`
- **Dự đoán tỷ số:** the first bullet is the **channel's own derived pick** (`Dự đoán của kênh: ...`) — chốt bằng Opta % (kèo trên) + form 5 trận (biên độ bàn) + mỏ neo Sports Mole "We say", KHÔNG copy ESPN/O'Hanlon. Second bullet = Opta win% as supporting data (`theo Opta`). Third = a tactical one-liner. Trong voiceText tỷ số CHỈ nói "kênh dự đoán", chỉ % mới gán "theo Opta".
- **Phong độ gần đây & đối đầu:** the head-to-head line first (record / "first-ever meeting" + standout & last meeting), then **each team's last 5 results with scorelines, most recent first**. This renders downstream as **2 scenes** — an H2H `feature-list` + **ONE combined `form-compare` board showing BOTH teams' recent results side by side** (2 cột split, mỗi kết quả 1 chip W/D/L + đối thủ + tỷ số). ⚠️ **KHÔNG tách 2 bảng riêng mỗi đội** — gộp chung 1 scene split cho gọn (feedback user 2026-07-06). Keep facts concrete (real scorelines + the H2H record), never vague ("đang có phong độ tốt"). ⚠️ Don't confuse the two sides' recent results — verify each scoreline belongs to the right team (e.g. send-off friendlies are team-specific). **For matchday 2+ group fixtures, the previous group game leads the list with a `(World Cup)` tag** (e.g. `hòa Bosnia 1-1 (World Cup), ...`); never leave a side as `hòa X, và chuỗi vòng loại trước đó` — list 5 real scorelines or as many as are verifiable.
- **Đội hình dự kiến:** both XIs, formation in parentheses, positions separated by `;`, players by `,`. Mandatory both teams.
- **Lối chơi dự kiến — 1 bullet/đội, dạng CÓ CẤU TRÚC cho tactics-board.** Mỗi đội: `(<sơ đồ>) — <approach headline ≤28 ký tự>: <2–3 cơ chế, mỗi cơ chế ≤42 ký tự, ngăn bằng ";">. Chìa khóa: <1 cầu thủ>.` **Ưu tiên nêu tương phản** giữa 2 lối chơi (A cầm bóng — B rình phản công). Vẫn NGẮN, không phải bài tactical dài — nhưng đủ dữ kiện để lấp thẻ đấu pháp. Downstream `/create-video` render dưới dạng scene **`tactics-board`** (thẻ đấu pháp 2 cột: sơ đồ + approach + 2–3 cơ chế + chìa khóa mỗi đội, có phân nhánh VS ở giữa) — data-driven, KHÔNG cần ảnh riêng.
- **Ngôi sao đáng xem — 2–3 NGÔI SAO MỖI ĐỘI (4–6 tổng), cân đối 2 bên + MỚI NHẤT.** Mỗi đội có riêng 2–3 cái tên đáng xem (đừng gộp chung 2–3 cho cả trận). Mỗi bullet ONE tight line: name (CLB/tuổi) + a single concrete fact **gắn với màn trình diễn gần nhất** (trận vòng trước): ai ghi bàn / tỏa sáng / mờ nhạt ở đó — KHÔNG dùng thống kê mùa giải cũ. No multi-sentence backstory — quick hit, không phải deep dive. **Càng vào sâu (tứ kết → bán kết → chung kết) càng cần đủ 3 sao/đội** vì các cuộc đối đầu cá nhân là điểm nhấn. Downstream `/create-video` renders each as its own stat-hero image (1–2 short voice sentences), nên `/images-for-videos` sẽ plan 1 ảnh/ngôi sao.
- **Tin lực lượng:** injuries/suspensions/doubts. Omit the whole section only if there is genuinely no team news.
- **Phát biểu họp báo đáng chú ý:** one bullet per manager, attributed by name + role. Quote in double quotes; if no real quote exists for a side, summarize their stated approach (don't invent a quote).
- **Source line:** list the domains used + the original URL.
- **Date:** publication date if known, else today's date from the environment.

#### ⚠️ Channel typography + voice (apply before saving)

These are the same rules baked into `/read-rewrite` and `/create-video` — apply them here:

- **Strip diacritics on foreign names** (`Dzeko`, `Kolasinac`, `Muharemovic`, `Mbappe`, `Crepeau`), **keep Vietnamese diacritics** always.
- **Arabic digits on screen** (`1-0`, `58,3 phần trăm`, `40 tuổi`, `6 bàn`). Voice spelling-out is handled downstream by `/create-video` — write the source readable.
- **Football lexicon** (chọc khe, nhạc trưởng, đặt điểm rơi, club nicknames) per `memory/feedback_football_lexicon.md`.
- **No clickbait, active voice, fact-lead, attribution rõ.** Read every sentence aloud in your head for ambiguity (the `phải` modal/body-side trap, subject-less fragments, abrupt 1st-person quotes) per the semantic filter in `/read-rewrite`.
- **Preserve information** — every player, number, quote, and stakes detail you researched goes in; curation happens downstream.

### Step 5: Slug + folder

Slugify the fixture as `nhan-dinh-<teamA>-vs-<teamB>-<comp>` (strip Vietnamese diacritics, lowercase, `-`-separated, cap ~40 chars at a word boundary), matching the existing examples:
- `nhan-dinh-han-quoc-vs-sec-wc-2026`
- `nhan-dinh-canada-vs-bosnia-wc-2026`

New content goes under `video/input/<slug>/`. **If `video/input/<slug>/` already exists with files, READ the existing `<slug>.txt` and `images-plan.json` first** — the fixture may have been prepped earlier (possibly with images already generated). In that case, **upgrade the existing `.txt` in place** to the full preview template rather than creating a suffixed duplicate, and keep the existing `images-plan.json` scene `filename`s/prompts intact (only refresh the `title` field to match). Tell the user you reused the existing folder. Otherwise create the folder and write `<slug>.txt`.

### Step 6: Hand off to images-for-videos

Invoke [`images-for-videos`](../images-for-videos/SKILL.md) on `video/input/<slug>/<slug>.txt` — UNLESS the folder already had a valid `images-plan.json` + generated images covering the scenes (then skip planning and just point the user at `/create-video`). That skill classifies (→ PRE-MATCH PREVIEW), plans scenes (hook split-frame, stat-hero per star, callout per manager, formation-pitch for the XIs where useful), and writes `images-plan.json` (full English prompts in each scene's `prompt`) + `anh-can-tao.md` (lightweight VN checklist). Do not duplicate its logic.

**Rendering convention (downstream `/create-video`):** a preview renders in the shape of `nhan-dinh-han-quoc-vs-sec-wc-2026` — the **predicted scoreline goes in the hook** (`bigStat: "1-0"`, voiceText opens with the result), and the **prediction/verdict card is a `comparison` scoreboard with both national flags + the scoreline** (set `flag` on both sides → `https://flagcdn.com/<iso2>.svg`), not a feature-list or bar chart. The `.txt` already carries the score in `## Dự đoán tỷ số`; `/create-video` lifts it into the hook + scoreboard. See `/create-video` SKILL "PRE-MATCH PREVIEW — standard shape".

**Feature-list images (optional, 2026-07-04):** the H2H (`Lịch sử đối đầu`) and team-news (`Tin lực lượng`) scenes render as `feature-list` broadcast cards and can now carry ONE supporting image. When `/images-for-videos` decides a photo reinforces the whole list — team-news anchored by a key absentee/returnee, H2H anchored by a historic-clash shot — it adds that scene to the plan (aspect-flexible; landscape → hero card, portrait → full-bleed with cards floating). It's optional: a numeric/mixed list stays image-less. Bullets cap at 3 when the scene has an image.

### Step 6.5: Record the source in the video queue (queue.xlsx)

After the image plan is written (or after reusing an already-prepped folder), append this source to the batch render queue so it shows up in `/video-queue` and the worksheet tracks every prepped source in one place. ALWAYS do this when the skill produced (or confirmed) a usable `<slug>.txt` + `images-plan.json`.

1. **Read the queue** to find the next free row and avoid duplicates:
   ```bash
   npm run video-queue --silent -- list
   ```
   Parse the JSON. Let `maxRow` = the largest `rowIdx` (or `1` if the queue is empty / only the header exists). The next free row is `maxRow + 1`.
2. **Dedup:** if any existing row's `source` already equals `video/input/<slug>/<slug>.txt`, do NOT add a duplicate. Leave it as-is and skip to Step 7 (mention it was already queued). One exception: if that row's `status` is `done` or `error` and the user clearly wants a fresh render, leave the decision to them — don't silently reset it.
3. **Append the row** with the base `.txt` as `source` and `status=planned`. `planned` is exactly the "prepped, waiting for images" state `/video-queue` Pass 2 expects (the `.txt` + `images-plan.json` exist but the user still has to gen images). If the folder was reused with images already generated, still use `status=planned` — Pass 2 will detect the images are present and render immediately. Always write the BASE source path even if `/images-for-videos` auto-split into parts — the queue fans out parts itself:
   ```bash
   npm run video-queue --silent -- set <maxRow+1> source=video/input/<slug>/<slug>.txt status=planned notes="match-preview"
   ```
   Only write `source`, `status`, `notes` — leave `result`/`error` empty.
4. If the helper errors (e.g. queue.xlsx open/locked in Excel), do NOT fail the whole skill — note it in the reply and continue; the user can add the row manually.

### Step 7: Reply concisely

```
✓ Preview đã viết: video/input/<slug>/<slug>.txt
✓ Image plan: video/input/<slug>/images-plan.json (prompt English ở field `prompt`)
✓ Checklist ảnh: video/input/<slug>/anh-can-tao.md (xem cần tạo ảnh gì)

Phân loại: PRE-MATCH PREVIEW
Đã gom: dự đoán tỷ số (kênh + <nguồn>), đội hình dự kiến 2 đội, lối chơi 2 đội, <N> ngôi sao, họp báo 2 HLV.
<N> ảnh cần tạo trên grok.com (hook 9:16 full-bleed; body ngang/dọc đều được — vào thẻ đúng tỉ lệ):
✓ Đã thêm vào hàng đợi render: video/input/queue.xlsx (row <N>, status=planned)

Tiếp theo:
1. Mở anh-can-tao.md → xem cần ảnh gì (prompt English đầy đủ ở images-plan.json) → grok.com (mở nhiều tab gen song song) → save về cùng folder đúng tên file
2. Khi đủ ảnh, chạy: /create-video video/input/<slug>/<slug>.txt — hoặc gen ảnh hết rồi chạy /video-queue để render cả loạt
```

If you reused an existing prepped folder (images already there), say so and skip straight to the `/create-video` line.

## What this skill does NOT do

- Does not generate images itself — manual on grok.com (visual-first workflow).
- Does not write `script.json` or render — that's `/create-video`, run after images are saved.
- Does not handle non-preview links — hands those to `/read-rewrite`.
- Does not fabricate lineups, quotes, or stats — if a fact genuinely can't be sourced, it's summarized honestly or omitted, never invented.

## Edge cases

| Situation | Action |
|---|---|
| Goal.com match page returns only chrome via WebFetch | Expected — proceed to Step 3 WebSearch; do not bail |
| Link is a match RECAP (final score already played) | Hand off to `/read-rewrite` (MATCH RECAP template) |
| Only one team's XI is findable | Search again specifically for the other side before writing; note "dự kiến" if still partial |
| No real manager quote for one side | Summarize that manager's stated approach/philosophy; never invent a quote |
| Topic string instead of URL | Skip Step 1 fetch, go straight to research |
| Folder already prepped (images exist from earlier) | Upgrade `.txt` in place, keep image plan filenames, skip re-planning |
| Not football | Bail with the football-only message |

## Relationship to other skills

```
match link ──/match-preview──► classify
                                  │ PRE-MATCH PREVIEW
                                  ▼
                    WebSearch research (lineups + prediction + quotes both sides)
                                  │
                                  ▼
                    video/input/<slug>/<slug>.txt  (rich preview template)
                                  │
                                  ├──/images-for-videos (chained)──► images-plan.json + anh-can-tao.md
                                  │                                          │
                                  │                                user gens images on grok.com
                                  │                                          │
                                  └──/create-video (user runs)──────────────► video/output/<slug>/video.mp4

  (not a preview) ──► hand off to /read-rewrite
```
