---
name: classify-football-content
description: Classify a Vietnamese football content source (file/URL/topic) into one of 10 canonical content types and propose a script structure (scene count, templates, voice tone, hook pattern). Used as a shared reference by /create-video and /images-for-videos, and can be invoked standalone to preview a structure before generating a full video.
---

# Football Content Classifier

A shared reference + standalone tool for classifying Vietnamese football content and producing a structured script outline. The downstream skills (`create-video`, `images-for-videos`) call this logic when handling user-provided source material.

## Why this exists

Football content has many distinct shapes — ranking lists are NOT structured the same as VS comparisons, and a pre-match preview reads completely differently from a post-match analysis. Treating all input as "generic notes" produces flat, undifferentiated videos. This skill standardizes content-type detection and gives each type an opinionated structure.

## When to use

- **Standalone (diagnostic):** `/classify-football-content input/foo.txt` → returns classification + proposed scene outline (no video generated). Useful for previewing structure before committing to a full render.
- **Inside other skills:** `/create-video` and `/images-for-videos` invoke this logic at Step 2 when input is a file/URL.

## Routing — which skill renders the output

All 11 content types render through `/create-video` (motion-graphic, AI poster images per scene). The classifier's job ends with the type label + proposed scene structure; the downstream skill picks templates accordingly.

Earlier the channel ran a separate `/create-bio-video` skill that backed bio/history content with real archival footage from a curated `video/library/<concept>/` tree. That skill was removed on 2026-05-25 — sourcing usable real footage per chapter turned out to be much harder than generating one AI poster image per scene. Bio + history content now ride the same image-based pipeline as everything else.

## Workflow

### Step 1: Detect type

For each source (file content, URL article body, or topic string):

1. Check filename pattern (strongest signal if present)
2. Scan body for structural cues (numbered list, parallel columns, score line, etc.)
3. Scan for keyword cues (transfer fee, lineup, score, "vs", "Top", etc.)
4. If ambiguous → choose the type that maximizes scene budget for the available content

### Step 2: Output

Return:
- **Type** (one of 8 below)
- **Confidence** (high / medium / low)
- **Proposed structure** (scene count + template sequence + voice tone)
- **Suggested hook line** (Vietnamese, 1-2 sentences)
- **Notes** (any concerns: insufficient content, mixed signals, recommended fallback)

If invoked standalone, present this as a markdown report. If invoked from another skill, return as a structured handoff.

---

## The 10 content types

### 1. RANKING — Xếp hạng / Top N

**Filename signals:** `Top10*.txt`, `Top5*.txt`, `Best*.txt`, `*Ranking.txt`, `*BestPlayers.txt`, `*XuatSac.txt`

**Body signals:**
- Numbered list (`1.`, `2.`, ... or `#1`, `#2`, ... or `Hạng 1`, `Hạng 2`, ...)
- 5+ named items, each with stats / 1-paragraph description
- Often has a "honorable mentions" or "tiếc nuối" section at end

**Sub-types:**
| Sub-type | Detection | `stat-hero.value` |
|---|---|---|
| **A1. Metric-driven** | Ranking IS a clear number — top scorers by goals, fastest goal, most expensive transfer | The metric (`"41"`, `"€222M"`, `"6.5s"`) |
| **A2. Editorial** | Ranking is a judgment — best players, greatest moments, most influential | The rank itself (`"#7"`, `"#6"`, ..., `"#1"`) |

**Structure (N items, N+3 to N+4 scenes total):**
1. Hook (1) — anticipation claim ("Số một sẽ khiến bạn bất ngờ")
2. Ranking countdown #N → #1 (N scenes, all `stat-hero`)
3. Optional: 1 callout tease before #1 ("Hạng nhất không phải tên bạn nghĩ")
4. Context callout (1) — 1-line meta insight ("Thế hệ vàng mới đã đến")
5. Optional: honorable mentions callout (1) — names not on the list
6. Outro (1)

**Voice tone:** countdown energy, building anticipation. Each rank scene starts with `"Hạng [number], [Name] —"`.

**Suggested hook patterns:**
- "[N] cầu thủ này đang thống trị [domain]. Số một sẽ khiến bạn bất ngờ."
- "Ai mới là [superlative] hiện tại? Đây là top [N]."

**Example file → structure:**
```
top7CBsITW.txt → Type: RANKING (A2 editorial), 11 scenes
hook → rank-7 ... rank-1 → evolution callout → honorable-mentions callout → outro
```

---

### 2. VS — Đối đầu / X vs Y

**Filename signals:** `XvsY.txt`, `MessiVsRonaldo.txt`, `XOrY.txt` (RonaldoOrMessi), `*VS*.txt`, `*Doi-Dau*.txt`

**Body signals:**
- Two named subjects mentioned roughly equally
- Parallel structure: two columns / two bullet lists / paired stats
- Question framing: "ai vĩ đại hơn", "ai số một"

**Structure (5–7 metrics + framing, 9–12 scenes total):**
1. Hook (1) — frame the question ("Ai mới thực sự là số một?")
2. Comparison scenes (5–7) — one per metric, all `comparison` template
   - Each scene: `left`/`right` with `winner: true` on the leading side
   - Common metrics: bàn thắng, kiến tạo, danh hiệu, QBV, đấu trường quốc tế, thể hình, phong cách
3. Style/qualitative callout (0–1) — when difference isn't numeric ("Messi tinh tế. Ronaldo bùng nổ.")
4. Verdict callout (1) — balanced or weighted conclusion
5. Outro (1)

**Voice tone:** balanced, debating, even-handed. Don't oversell a winner unless the data does.

**Suggested hook patterns:**
- "[Name A] và [Name B]: ai mới thực sự là [superlative]? Số liệu sẽ trả lời."
- "Đây là so sánh sâu nhất bạn từng xem giữa [A] và [B]."

---

### 3. MATCH ANALYSIS — Phân tích trận đấu

**Filename signals:** `*Match*.txt`, `*Tactics.txt`, `*Analysis.txt`, `*VS*Match.txt`, `Round*.txt`

**Body signals:**
- Score line ("Arsenal 2-1 Chelsea", "Real 3-0 Barca")
- Date / matchday context
- Tactical observations (formation, pressing, transition)
- Player ratings or MVP mention
- xG, possession %, key passes stats

**Structure (10–13 scenes):**
1. Hook (1) — frame the result drama ("Đây là cách [Team A] đánh bại [Team B]")
2. Score scene (1) — `stat-hero` with score as value
3. Tactical breakdown (3–5) — `callout` per insight (formation, key moment, weakness exploited)
4. Stats scene (1–2) — `stat-hero` for xG, possession, key numbers
5. MVP scene (1) — `stat-hero` or `feature-list` for player of the match
6. Closing reflection (1) — `callout` on what this means
7. Outro (1)

**Voice tone:** analytical, informed. Use tactical vocabulary (pressing, transition, half-space, overload).

**Suggested hook patterns:**
- "[Team A] đã làm [Team B] gục ngã bằng đúng một thứ vũ khí."
- "Trận này đã định nghĩa lại [tournament] mùa giải."

---

### 3b. MATCH RECAP — Tổng hợp trận đấu + Chấm điểm cầu thủ

**Filename signals:** `*Ratings*.txt`, `*PlayerRatings*.txt`, `*ChamDiem*.txt`, `*Recap*.txt`, `*TongHop*.txt`

**Body signals:**
- Score line present ("PSG 1-1 Arsenal", "Man City 3-2 Liverpool")
- Multiple players named with **numerical ratings** (e.g. `7/10`, `8/10`, `4/10`)
- Per-player performance paragraphs (key actions, missed chances, saves)
- Penalty shootout details (if applicable)
- Source often from Goal.com player ratings, WhoScored, FotMob match reports
- MVP / Man of the Match mentioned

**Sub-type contrast — when MATCH RECAP vs MATCH ANALYSIS:**
| | MATCH RECAP (type 3b) | MATCH ANALYSIS (type 3) |
|---|---|---|
| Focus | **Per-player performance + ratings** | Tactical breakdown + formations |
| Key data | Player ratings (N/10), key actions per player | xG, possession %, pressing triggers |
| Typical source | Goal.com player ratings, WhoScored | Tactical blog, coach analysis |
| Image density | **HIGH** — 1 image per rated player (10-15 total) | MEDIUM — 1 image per tactical moment (5-8 total) |

**Structure (12–16 scenes — one scene per key player):**
1. Hook (1) — split-frame matchup poster (Team A vs Team B)
2. Key match events (3–5) — `stat-hero`/`callout` per goal, penalty, turning point. Each named player gets their own scene.
3. Player rating scenes (5–10) — `stat-hero` per rated player. Prioritize:
   - MVP (highest rating) — golden badge
   - Worst performer (lowest rating) — red warning badge
   - Goal scorers
   - Key saves / assists
   - Surprise performances (high or low)
4. Context scenes (1–2) — `callout` for manager tactics, historical significance
5. Closing scene (1) — trophy lift / celebration / aftermath
6. Outro (1)

**⚠️ CRITICAL: Plan ONE image per named player with a rating.** If the source rates 10 players, plan 10 player images + hook + context = ~13 total. Never compress 10 rated players into 5-6 images.

**Voice tone:** broadcast recap, energetic for goals, analytical for ratings. Use "Điểm [N]/10" naturally in voice text.

**Suggested hook patterns:**
- "[Team A] vừa [đánh bại / hạ gục / bảo vệ ngôi vương] trước [Team B]. Ai xuất sắc nhất? Ai tệ nhất?"
- "Chung kết [Tournament] đã khép lại. Đây là chấm điểm từng cầu thủ."
- "[Player] chỉ nhận [N]/10. Chuyện gì đã xảy ra?"

---

### 3c. NEWS DRAMA — Drama MXH / Phản ứng ngoài sân cỏ

**Filename signals:** `*Troll*.txt`, `*Drama*.txt`, `*MXH*.txt`, `*PhanUng*.txt`, `*Reaction*.txt`, `*Social*.txt`

**Body signals:**
- Social media posts / tweets mentioned (club official accounts, player posts)
- Fan reactions, banter, rivalry content
- "Trending", "viral", "triệu lượt", "bình luận", "troll"
- Off-pitch controversy or celebration
- Multiple clubs / fan bases reacting to the same event
- No match tactical analysis — focus is on the REACTION, not the game itself

**Structure (10–13 scenes — one scene per distinct reaction/moment):**
1. Hook (1) — split-frame rivalry poster (provocateur vs target)
2. Trigger event scene (1) — `callout` for what caused the drama
3. Main drama scenes (4–7) — `stat-hero`/`callout` per distinct reaction:
   - Club social media post
   - Historical context (why this hurts / matters)
   - Fan reactions from rival fan bases
   - Player reactions
   - Named individuals involved (each gets own scene)
4. Context scenes (1–2) — `callout` for broader implications
5. Outro (1)

**Voice tone:** storytelling with humor, banter-aware. Playful but not cruel. Use social-media vocabulary naturally.

**Suggested hook patterns:**
- "[Club A] vừa đăng một bài viết. Và cả thế giới bóng đá phản ứng."
- "[Club A] troll [Club B] sau [event]. Đây là chuyện gì đã xảy ra."
- "Bài đăng này đã trending toàn cầu trong [N] giờ."

---

### 4. PRE-MATCH PREVIEW — Thông tin trước trận đấu

**Filename signals:** `*Preview.txt`, `*Coming.txt`, `Pre*.txt`, `*BeforeMatch.txt`, `*TruocTran*.txt`, `Preview-XvsY.txt`

**Body signals:**
- Future tense ("sẽ đối đầu", "vào tối thứ"), specific upcoming date
- Lineup speculation ("dự kiến ra sân"), absent players (chấn thương / treo giò)
- Head-to-head record
- Key matchup discussion (player X vs player Y)
- No final score yet

**Structure (10–12 scenes):**
1. Hook (1) — set the date + stakes ("Trận chiến của tuần: [A] gặp [B] đêm thứ Bảy")
2. Context callout (1) — what's at stake (table position, knockout)
3. Head-to-head stat (1) — `stat-hero` with H2H record
4. Key matchup scenes (2–3) — `comparison` template per player matchup
5. Tactical prediction callouts (2–3) — what each side will try to do
6. Lineup scene (0–2):
   - **Predicted XI** (full starting eleven named) → `formation-pitch` template (green pitch + player tokens; never use `feature-list` for a full XI — see "Lineup / starting XI scenes" rule in `/create-video/SKILL.md`).
   - **Absences / new signings only** (no full XI, just 2–4 names) → `feature-list`.
7. Bold prediction (1) — `callout` with the writer's call
8. Outro (1)

**Tournament-scope variant — SQUAD ANNOUNCEMENT / SQUAD REVEAL:** A 26-man / 23-man squad reveal for a major tournament (World Cup, Euro, Copa, AFF Cup) is structurally PRE-MATCH PREVIEW at tournament scope. Same template sequence, with these adjustments: (a) `stat-hero` highlights or `feature-list` for each position group (GK / DEF / MID / FWD), (b) `formation-pitch` for the predicted XI from that squad — this is the centerpiece scene, (c) `callout` for notable absences (injury / form / age-out).

**Voice tone:** anticipatory, confident but cautious. Use future tense.

**Suggested hook patterns:**
- "Trận đại chiến đêm nay sẽ định đoạt [stakes]."
- "Ba lý do để [Team A] thắng [Team B]."
- "Đây là cách [Team A] có thể hạ gục [Team B]."

---

### 5. PLAYER PROFILE / STATS DEEP-DIVE — Thông số cầu thủ

**Filename signals:** `*Profile.txt`, `*Player.txt`, `*Stats.txt`, single name files (`Haaland.txt`, `Messi.txt`, `Vinicius.txt`)

**Body signals:**
- One player named throughout
- Career milestones (đội bóng từng khoác áo, danh hiệu)
- Current season stats (bàn thắng, kiến tạo, phút chơi, xG)
- Strengths / playing style description
- Heat-map style observations (vị trí ưa thích, side ưa thích)

**Structure (10–13 scenes):**
1. Hook (1) — striking achievement or claim ("Cầu thủ này đang đi vào lịch sử")
2. Career milestone scenes (2–3) — `stat-hero` for trophies, debut age, transfer fees
3. Current season stats (3–4) — `stat-hero` per key metric (goals, assists, xG, big chances created)
4. Strengths breakdown (1) — `feature-list` of 3–4 signature traits
5. Style callout (1–2) — narrative on how they play differently
6. Comparison scene (0–1) — `comparison` vs peer in same position (optional)
7. Future / legacy callout (1) — what's next
8. Outro (1)

**Voice tone:** profile, narrative, admiring but factual.

**Suggested hook patterns:**
- "Cầu thủ này đã làm điều mà chưa ai từng làm."
- "Đây là lý do [Name] đáng giá [fee]."
- "Bạn có biết [Name] đã ghi bàn sau mỗi [N] phút?"

---

### 6. BIO-PLAYER — Tiểu sử / Sự nghiệp cầu thủ

**Filename signals:** `Bio*.txt`, `*Career.txt`, `*Journey*.txt`, `*Story.txt`, `*HanhTrinh*.txt`, `*TieuSu*.txt`, `HistoryOf-<player>.txt`

**Body signals:**
- ONE player named throughout, told chronologically
- Childhood / origin story present (birthplace, family, first club)
- Multiple career eras mentioned (junior → first club → peak club → late career)
- Achievements span 5+ years
- Legacy / impact framing toward the end
- Narrative tone (past tense dominant), not stats-table tone

**Sub-type contrast — when this type vs PLAYER PROFILE (type 5):**
| | BIO-PLAYER (type 6) | PLAYER PROFILE (type 5) |
|---|---|---|
| Time scope | Full career arc (5+ years) | Current season / single era stats |
| Tone | Storytelling, past tense, evocative | Analytical, data-heavy |
| Dominant templates | `timeline`, `stat-hero`, `callout` | `stat-hero`, `comparison`, `feature-list` |

Both render through `/create-video`. BIO-PLAYER differs in scene composition: each scene = one career milestone or era beat, anchored by a year/age opener and a single load-bearing fact. Source dense enough for 20+ scenes → split into Phần 1 / Phần 2 .txt files and run /create-video per part.

**Structure (10–15 scenes — one scene per milestone/era; no chapter-prose):**
1. Hook (1) — anchor-in-time / counterfactual / verdict-as-question
2. Origin scene (1) — `stat-hero` or `callout` (birthplace, breakthrough year, formative event)
3. Early-career scenes (1–2) — `stat-hero` per signature first-club moment (debut age, first trophy, transfer fee)
4. Timeline scene (0–1) — `timeline` template with 3–5 era markers if dates are dense
5. Peak-era scenes (3–5) — `stat-hero` per signature trophy / record / iconic moment
6. Late-career scenes (1–2) — `callout` for transitions, leadership, or pivot-club facts
7. Legacy scene (1) — `callout` with verdict / record / impact line
8. Engagement question (1) + outro (1)

**Voice tone:** journalistic narrative, past tense dominant for milestones, present tense for legacy framing. Each scene voiceText still 1–2 short sentences. Use year/age openers (`"Mùa hè năm 1991..."`, `"Mười sáu tuổi..."`) rather than chapter-prose flow.

**Suggested hook patterns:**
- "Mùa hè năm [year], [event with full intrigue]. Không ai biết... — [N] năm sau, [outcome]."
- "Đây là cách [Name] trở thành [legacy verdict]."
- "Câu chuyện [Name] không bắt đầu trên sân cỏ. Nó bắt đầu ở [unexpected place]."

---

### 6b. HISTORY-CLUB — Lịch sử CLB / đội bóng

**Filename signals:** `LichSu-<club>.txt`, `<club>-History.txt`, `100Nam-<club>.txt`, `<club>-Story.txt`

**Body signals:**
- ONE club named throughout, told across decades
- Founding year / founding story present
- Multiple eras mentioned (early decades, golden era, rebuild, modern)
- Manager / president succession as narrative anchors
- "Thành lập", "đầu tiên", "kỷ lục", "thế hệ" recurring vocabulary
- Spans 50+ years typically

**Structure (10–15 scenes — one scene per era / dynasty, all motion-graphic):**
1. Hook (1) — anchor-in-time / verdict-as-question
2. Founding scene (1) — `stat-hero` (founding year + first crest moment)
3. Timeline scene (0–1) — `timeline` for 3–5 era markers
4. First-golden-era scenes (2–3) — `stat-hero` for trophy counts, iconic XI moments
5. Middle-era scenes (1–2) — `callout` for rebuild / reinvention beats
6. Modern-era scenes (2–3) — `stat-hero` for recent records, manager-era trophies
7. Current-state + legacy scene (1) — `callout` with "today" framing
8. Engagement question (1) + outro (1)

**Voice tone:** journalistic, reverent, era-flavored. Past tense for events; present tense allowed for ongoing legacy framing. Same 1–2 sentence per scene rule as other types.

**Suggested hook patterns:**
- "[Year], khi [founding event], không ai ngờ [club] sẽ trở thành [verdict]."
- "[Club] không phải đội bóng giàu nhất khi mới thành lập. Họ là đội bóng đã định nghĩa lại [aspect]."
- "Cho đến hôm nay, kỷ lục [N] [achievement] vẫn chưa ai phá."

---

### 6c. HISTORY-NATIONAL-TEAM — Lịch sử đội tuyển quốc gia

**Filename signals:** `LichSu-Tuyen<X>.txt`, `Tuyen<X>-Story.txt`, `<NT>-History.txt`, `<NT>-WC-history.txt`

**Body signals:**
- ONE national team named throughout
- Tournament-by-tournament narrative (World Cup editions, continental cups)
- Generation framing ("thế hệ 1986", "thế hệ vàng", "thế hệ thất bại")
- Heartbreaks + redemptions as narrative beats
- Coach / captain succession

**Structure (10–15 scenes — one scene per tournament / generation, all motion-graphic):**
1. Hook (1)
2. Founding / first-tournament scene (1) — `stat-hero` (year + result)
3. Timeline scene (0–1) — `timeline` for major-tournament results across decades
4. First-trophy era scene(s) (1–2) — `stat-hero` for the title moments
5. Heartbreak generation scene(s) (1–2) — `callout` for near-miss runs / final losses
6. Comeback / golden generation scene(s) (2–3) — `stat-hero` for redemption results
7. Current state scene (1) — `callout`
8. Engagement question (1) + outro (1)

**Voice tone:** journalistic, emotional, generational. Past tense dominant; emotion-anchored sentence openers ("Cả một thế hệ đã chờ...", "Đêm đó tại Yokohama...").

**Suggested hook patterns:**
- "[N] năm, [NT] đã đợi để chạm tay vào [trophy]. Đây là câu chuyện của hành trình đó."
- "Từ một đội bóng [adjective], [NT] đã trở thành [verdict]."
- "Đây là [N] thế hệ đã làm nên lịch sử [NT]."

---

### 6d. HISTORY-TOURNAMENT — Lịch sử giải đấu

**Filename signals:** `LichSu-UCL.txt`, `LichSu-WC.txt`, `WCQuaCacKy.txt`, `<Tournament>-History.txt`, `<Tournament>-Editions.txt`

**Body signals:**
- ONE tournament named throughout (Champions League, World Cup, Euro, Copa, AFF Cup)
- Edition-by-edition narrative
- Format changes mentioned (group stage introduction, knockout reform, expansion)
- Iconic finals / moments as narrative anchors
- Dynasty / serial-champion framing ("Real Madrid 5 lần liên tiếp", "Bayern thập kỷ thống trị")
- Spans multiple decades

**Structure (10–15 scenes — one scene per edition / dynasty / format era, all motion-graphic):**
1. Hook (1)
2. Founding-edition scene (1) — `stat-hero` (year + first winner)
3. Timeline scene (0–1) — `timeline` for major format reforms or trophy-winner clusters
4. Early-decades scene(s) (1–2) — `callout` for first iconic finals
5. Format-reform scene (0–1) — `callout` (UCL rebrand, WC expansion)
6. Dynasty-era scene(s) (2–3) — `stat-hero` for serial-champion records
7. Modern-era + current-state scene(s) (1–2) — `callout` + `stat-hero`
8. Engagement question (1) + outro (1)

**Voice tone:** journalistic, sweeping, awe-anchored. Past tense; use "kỳ", "thế hệ", "kỷ nguyên" as era markers.

**Suggested hook patterns:**
- "Từ [N] đội bóng năm [year] đến [current state], đây là [N] năm của [tournament]."
- "[Tournament] không phải giải đấu hấp dẫn nhất khi mới ra đời. Đây là cách nó trở thành [verdict]."
- "[N] đêm chung kết. [N] thế hệ huyền thoại. Một chiếc cúp."

---

### 7. TRANSFER NEWS — Tin chuyển nhượng

**Filename signals:** `*Transfer*.txt`, `*Signing*.txt`, `*Rumor*.txt`, `*ChuyenNhuong*.txt`, `*BomTan*.txt`

**Body signals:**
- Transfer fee mentioned (£XXm, €XXm, USD)
- Two clubs (origin → destination)
- Words: "chính thức", "thông báo", "đặt bút", "phá kỷ lục", "đề nghị", "tin đồn"
- Player age + contract length

**Structure (8–11 scenes — usually shorter than other analysis types):**
1. Hook (1) — the announcement ("Bom tấn vừa nổ — [Name] đến [Team] với giá [fee]")
2. Fee stat-hero (1) — the number front and center
3. Origin → destination scene (1) — `comparison` template (old club vs new club)
4. Why now callout (1–2) — reason for the move (financial, ambition, age)
5. Tactical fit scene (1) — `callout` on how they fit the new team
6. Predicted impact (1–2) — `callout` or `feature-list` on what changes
7. Reaction / wider context (1) — fan reaction, market signal
8. Outro (1)

**Voice tone:** news-style, urgent, with hype where data supports it.

**Suggested hook patterns:**
- "Bom tấn [N] triệu vừa nổ: [Name] chính thức gia nhập [Team]."
- "[Team] đã làm điều ai cũng nghĩ là không thể."
- "Sau [N] tháng đàm phán, [deal] cuối cùng đã hoàn tất."

---

### 8. TRIVIA / DID-YOU-KNOW — Sự thật ít biết

**Filename signals:** `*Trivia*.txt`, `*Facts*.txt`, `*DidYouKnow*.txt`, `*Records*.txt`, `*KyLuc*.txt`, `*BatNgo*.txt`

**Body signals:**
- Multiple unrelated short facts
- Phrases: "bạn có biết", "ít ai biết", "kỷ lục", "lần đầu tiên", "duy nhất"
- Surprising / counter-intuitive numbers

**Structure (8–11 scenes):**
1. Hook (1) — provocative question ("Bạn có biết... ?")
2. Fact scenes (5–7) — alternating `callout` (storytelling fact) and `stat-hero` (record number)
3. Final twist scene (1) — biggest / most surprising fact saved for last
4. Outro (1)

**Voice tone:** curious, surprising, casual. Each fact opens with hook phrase ("Bạn có biết...", "Sự thật là...", "Ít ai để ý...")

**Suggested hook patterns:**
- "[N] sự thật về [domain] mà chín mươi phần trăm fan không biết."
- "Đây là kỷ lục lạ lùng nhất [tournament]."
- "Bạn có biết... ?"

---

## Mixed-content fallback

If the file has clear signals for two types (e.g., a player profile that includes a long career history section), pick the type that matches the **dominant scene budget**:
- More milestone facts spanning multiple eras → BIO-PLAYER (all bio/history types route to `/create-video`)
- More current-season stats → PLAYER PROFILE (routes to `/create-video`)
- Single twin focus → could be VS
- Decade-spanning club narrative → HISTORY-CLUB

**Tone tiebreaker:** if the prose is told **chronologically** with **past-tense verbs dominating** + **evocative openers** + spans **5+ years**, lean toward a BIO-/HISTORY-* type (bio-video). If it's told as a **stat block** with **current-tense / present-tense verbs** + **bullet lists**, lean toward PLAYER PROFILE / RANKING (motion-graphic video).

When in doubt, default to PLAYER PROFILE (most flexible structure for motion-graphic).

## Output format when invoked standalone

When user runs `/classify-football-content input/foo.txt` directly:

```markdown
## Classification

**File:** input/foo.txt
**Type:** RANKING (A2 editorial) — confidence HIGH
**Why:** filename matches `Top*.txt` pattern; body has 7 numbered items with player names + 1-paragraph descriptions; ranking criterion is editorial judgment (no single metric).

## Proposed structure (11 scenes)

1. **hook** — "Bảy [subject] nào đang thống trị [domain] năm 2026? Số một sẽ khiến bạn bất ngờ."
2. **rank-7** — `stat-hero` value="#7"
3. **rank-6** — `stat-hero` value="#6"
4. ... (rank-5 through rank-1)
9. **evolution** — `callout` (era contrast)
10. **honorable-mentions** — `callout`
11. **outro**

## Notes

- All 7 ranking entries have ~50 words of context — enough for stat-hero with player name + age/club.
- Recommend imagePrompt for every rank scene (one player per image).
- Hook works best with crowd / silhouette imagery (not a specific player).
```

When invoked internally by another skill, return the same data as JSON-style structured output for the calling skill to consume.

## Channel context

This classifier writes for the **SportsForAllTV** football channel. All hook patterns are in spoken Vietnamese. Voice tone, structure, and template choice align with the brand's news+analysis dual format.

## ⚠️ Hook scene construction — see `/create-video` SKILL.md

The "Suggested hook patterns" listed under each content type above are **starter voiceText ideas only**. The full rules for building the hook scene — including the four hook archetypes (stat-shock / question / verdict / contradiction), the headline-vs-title test, the `bigStat` field, and the `kenBurns` kinetic motion options — live in `/create-video` SKILL.md under "Hook (most important — first 2s decide swipe-or-stay)". When generating a script, use those rules as the binding spec; treat the per-type patterns here as inspiration, not as fully-formed hooks.
