import { z } from "zod";

// ── Template data shapes (discriminated by template field) ─────────────────
//
// Soft line-break convention: in fields rendered with very large fonts —
// hook.headline, hook.subhead, callout.statement, feature-list.title,
// stat-hero.label — the character `|` is converted to <br> by the HTML
// composer, so writers can place phrasing-aware line breaks (e.g.
// "Top 5 vua phá lưới|Champions League"). The `|` counts toward the
// field's max-length cap. Other fields render `|` verbatim.

const HookData = z.object({
  template: z.literal("hook"),
  headline: z.string().min(1).max(40),
  subhead: z.string().max(40).optional(),
  /**
   * Kicker label (broadcast lower-third style) — competition / context, e.g.
   * "Ngoại hạng Anh", "Champions League". Rendered as the red-bar kicker above
   * the score/headline. If omitted, no kicker is shown (the persistent shell
   * already carries the channel brand).
   */
  eyebrow: z.string().max(30).optional(),
  /** Optional second line under the kicker, e.g. matchweek "Vòng 32" (≤24). */
  eyebrowSub: z.string().max(24).optional(),
  /**
   * Optional giant attention-grabber rendered ABOVE the headline at frame 0.
   * Use for stat-shock hooks: "19", "€80M", "22 NĂM", "0-7", "#1"
   * or short text phrases: "HUYỀN THOẠI", "KỶ LỤC".
   * Font auto-scales via CSS: ≤3 chars → 320px, 4-5 → 240px,
   * 6-8 → 180px, 9-12 → 140px, 13+ → 110px.
   */
  bigStat: z.string().min(1).max(20).optional(),
  /** background image path (literal "$source.image" → substituted at pipeline level) */
  bgSrc: z.string().optional(),
  /**
   * Background motion class. The kinetic options (impact-zoom, whip-pan,
   * shake-on-beat) are preferred for hooks on short-form video — they stop
   * scroll better than the slow Ken Burns pans. Use Ken Burns for
   * meditative/tribute hooks only.
   */
  kenBurns: z
    .enum([
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "impact-zoom",
      "whip-pan",
      "shake-on-beat",
      "drift-diagonal",
      "breathe",
    ])
    .default("impact-zoom"),
});

const ComparisonSide = z.object({
  label: z.string().min(1).max(30),
  value: z.string().min(1).max(20),
  color: z.enum(["cyan", "purple"]),
  /**
   * Optional flag/crest image (URL or local path, e.g. flagcdn
   * "https://flagcdn.com/ca.svg"). When BOTH sides set `flag`, the comparison
   * renders as a SCORE-PREDICTION SCOREBOARD — two flags + team names + a big
   * centered scoreline (left.value − right.value), with the higher score
   * glowing as the winner — instead of the proportional bar chart. Use for the
   * predicted-result card in pre-match previews. Leave unset for metric
   * comparisons (goals/trophies/etc), which keep the bar-chart treatment.
   */
  flag: z.string().min(1).optional(),
});

const ComparisonData = z.object({
  template: z.literal("comparison"),
  left: ComparisonSide,
  right: ComparisonSide.extend({ winner: z.boolean().optional() }),
  /**
   * Scoreboard-variant overrides (only used when BOTH sides carry `flag`).
   * Defaults suit pre-match previews; override for RECAP roundups so the board
   * reads as a final result, not a forecast.
   */
  /** Top pill label. Default "Dự đoán tỉ số". Recap → e.g. "Chung cuộc". */
  eyebrow: z.string().min(1).max(30).optional(),
  /** Footer line. Default "Dự đoán của SportsForAllTV". Recap → e.g. "Vòng 1/16 · World Cup 2026". */
  foot: z.string().min(1).max(40).optional(),
  /** Optional note under the scoreline, e.g. "Sau hiệp phụ" / "Chấm luân lưu". */
  note: z.string().min(1).max(30).optional(),
});

const StatHeroData = z.object({
  template: z.literal("stat-hero"),
  value: z.string().min(1).max(20),
  label: z.string().min(1).max(40),
  context: z.string().max(50).optional(),
  /**
   * Optional short trait bullets shown between label and context.
   * Use for ranking/list items where one-line context isn't enough —
   * e.g. ["Sức mạnh", "Không chiến", "24 bàn / 32 trận"].
   * Each bullet ≤ 30 chars, max 4 bullets. Chips stack vertically (38px Inter)
   * and wrap within the ~920px safe zone, so 30 chars fits comfortably on one line.
   */
  highlights: z.array(z.string().min(1).max(30)).min(1).max(4).optional(),
});

const FeatureListData = z.object({
  template: z.literal("feature-list"),
  title: z.string().min(1).max(40),
  // Peer talking points (team news / head-to-head / key points) — NOT ranked,
  // so the template renders no numerals. When the scene carries an image the
  // composer caps the visible bullets to 3 to fit the tighter safe zone.
  bullets: z.array(z.string().min(1).max(50)).min(1).max(4),
  icon: z.string().optional(),
});

const CalloutData = z.object({
  template: z.literal("callout"),
  statement: z.string().min(1).max(80),
  tag: z.string().max(20).optional(),
});

const BigQuoteData = z.object({
  template: z.literal("big-quote"),
  /** The quoted text (≤200 chars). */
  quote: z.string().min(1).max(200),
  /** Speaker + role line, e.g. "Florentino Perez, chủ tịch Real Madrid" (≤60). */
  attribution: z.string().min(1).max(60),
});

const TimelineItemData = z.object({
  year: z.string().min(1).max(8),
  event: z.string().min(1).max(60),
});

const TimelineData = z.object({
  template: z.literal("timeline"),
  title: z.string().min(1).max(40),
  /** 3–5 milestones, year + 1-line event. */
  items: z.array(TimelineItemData).min(3).max(5),
});

/**
 * Tactical pre-match formation graphic — green pitch with player tokens
 * placed by formation rows.
 *
 * `rows` is ordered from BACK (GK row) to FRONT (striker row). Each entry
 * is one horizontal line of the formation; players within a row spread
 * evenly. Total player count should equal 11 for a standard lineup.
 *
 * Example 4-2-3-1:
 *   rows: [
 *     ["Maignan"],                                          // GK
 *     ["Koundé", "Upamecano", "Saliba", "Théo Hernández"],  // 4 DEF
 *     ["Tchouaméni", "Rabiot"],                             // 2 DM
 *     ["Dembélé", "Olise", "Cherki"],                       // 3 AM
 *     ["Mbappé"]                                            // 1 ST
 *   ]
 */
const FormationPitchData = z.object({
  template: z.literal("formation-pitch"),
  title: z.string().min(1).max(40),
  /** Formation label shown in the header, e.g. "4-2-3-1", "4-3-3", "3-5-2". */
  formation: z.string().min(1).max(12),
  rows: z
    .array(z.array(z.string().min(1).max(24)).min(1).max(5))
    .min(2)
    .max(6),
});

/**
 * Engagement-question scene — sits between the last body scene and the
 * outro. Asks the viewer a content-derived question (forces opinion /
 * choice) and prompts a comment. Pattern is mandatory in every script
 * per channel convention (see `/create-video/SKILL.md` and
 * `memory/feedback_engagement_question_scene.md`).
 *
 * `question` should follow the "Theo bạn, …?" / "Ai mới là …?" /
 * "X hay Y?" forced-choice pattern derived from the video's central
 * debate or uncertainty. Use `|` to insert phrase-aware line breaks
 * for long questions rendered at 60px Inter.
 */
/**
 * Group-intro scene — data-driven group-stage reveal rendered in HTML/CSS
 * (flags/crests + team names + predicted finish), NOT an AI image. Used by the
 * World Cup prediction series' group parts. `teams` are listed in predicted
 * finishing order (first = top of the group). Each team's `flag` is an image
 * URL or local path (national flag SVG or federation crest).
 */
const GroupTeam = z.object({
  name: z.string().min(1).max(24),
  /** Flag/crest image — URL (e.g. flagcdn) or local path. */
  flag: z.string().min(1),
  /** Optional one-line descriptor under the name (≤40). */
  note: z.string().max(40).optional(),
  /** Short predicted-finish label, e.g. "Nhất bảng", "Đi tiếp", "Hạng 3", "Bị loại" (≤20). */
  result: z.string().min(1).max(20),
  /** Gold-highlight the row (advancing teams). */
  qualify: z.boolean().optional(),
});

const GroupIntroData = z.object({
  template: z.literal("group-intro"),
  /** Group label shown big after "BẢNG", e.g. "A", "F". */
  group: z.string().min(1).max(24),
  teams: z.array(GroupTeam).min(2).max(6),
});

/** One predicted match result row. Scores are strings to allow "2", "1 (4)" pen, etc. */
const MatchResult = z.object({
  home: z.string().min(1).max(20),
  homeScore: z.string().min(1).max(8),
  away: z.string().min(1).max(20),
  awayScore: z.string().min(1).max(8),
  /** Optional short note, e.g. "luân lưu", "vé vớt", "Nhất bảng" (≤20). */
  note: z.string().max(20).optional(),
});

const MatchResultsData = z.object({
  template: z.literal("match-results"),
  /** Board title, e.g. "Bảng A · Kết quả", "Vòng 16 đội". */
  title: z.string().min(1).max(40),
  /** Optional subtitle line (≤40). */
  subtitle: z.string().max(40).optional(),
  /**
   * Optional top-kicker override. Defaults to "Dự đoán · World Cup 2026"
   * (prediction boards). For ACTUAL past results (e.g. a team's last-5 form
   * board) set this to "Phong độ · World Cup 2026" or similar so the board
   * isn't mislabelled as a prediction.
   */
  eyebrow: z.string().max(40).optional(),
  /**
   * Optional footer override. Defaults to "Tỉ số dự đoán của SportsForAllTV".
   * For real results use e.g. "Kết quả gần đây · SportsForAllTV".
   */
  foot: z.string().max(60).optional(),
  matches: z.array(MatchResult).min(2).max(8),
});

/** One knockout-bracket leaf: two teams (flag + name), optional kickoff note. */
const BracketPair = z.object({
  left: z.object({ name: z.string().min(1).max(20), flag: z.string().min(1) }),
  right: z.object({ name: z.string().min(1).max(20), flag: z.string().min(1) }),
  /** Optional short kickoff note under the pairing, e.g. "00:00 · 5/7". */
  note: z.string().max(24).optional(),
});

/**
 * Knockout-bracket summary board — a "chia nhánh" fixture overview like sports
 * sites use. Matches are split into two columns funnelling toward a center
 * round badge. Data-driven (flags + names), NO AI image — same dark board
 * family as group-intro / match-results.
 */
const BracketData = z.object({
  template: z.literal("bracket"),
  title: z.string().min(1).max(40),
  subtitle: z.string().max(40).optional(),
  /** Center node label, e.g. "Vòng 1/8". Defaults to "Vòng 1/8". */
  centerLabel: z.string().max(20).optional(),
  matches: z.array(BracketPair).min(2).max(8),
});

/**
 * One side of a tactics board — a team's expected game-plan.
 * `approach` is the short headline tag (e.g. "Kiểm soát & pressing",
 * "Phòng ngự phản công"); `points` are 2–3 concrete mechanisms
 * ("Lên bóng qua số 6", "Rình phản công tốc độ Mbappe"); `keyPlayer`
 * is the single tactical linchpin whose name anchors the plan.
 */
const TacticsTeam = z.object({
  name: z.string().min(1).max(20),
  /** Flag/crest image — URL (e.g. flagcdn) or local path. Optional. */
  flag: z.string().min(1).optional(),
  /** Formation label, e.g. "4-2-3-1", "4-3-3", "3-5-2". */
  formation: z.string().min(1).max(12),
  /** Short approach headline, e.g. "Kiểm soát & pressing" (≤28). */
  approach: z.string().min(1).max(28),
  /** 2–3 concrete tactical mechanisms, each ≤42 chars. */
  points: z.array(z.string().min(1).max(42)).min(1).max(3),
  /** Optional tactical linchpin name shown in the "chìa khóa" footer (≤24). */
  keyPlayer: z.string().min(1).max(24).optional(),
  color: z.enum(["cyan", "purple"]),
});

/**
 * Tactics board — a two-column "đấu pháp" comparison rendered in HTML/CSS
 * (no AI image), same dark board family as group-intro / bracket. Each side
 * shows the team's formation, approach headline, key mechanisms, and tactical
 * linchpin, split by a center VS spine. Use for the pre-match tactical/style
 * scene (replaces the older two-callout or bar-comparison treatment).
 */
const TacticsBoardData = z.object({
  template: z.literal("tactics-board"),
  /** Board title, default "Lối chơi dự kiến". */
  title: z.string().min(1).max(40).optional(),
  left: TacticsTeam,
  right: TacticsTeam,
});

/** One recent result on a form-compare board (from the team's own perspective). */
const FormResult = z.object({
  /** Opponent name (strip foreign diacritics), ≤18. */
  opponent: z.string().min(1).max(18),
  /** Scoreline from THIS team's view first, e.g. "2-1", "0-0". Visible field — hyphen ok. */
  score: z.string().min(1).max(8),
  /** Outcome for this team: W win / D draw / L loss — colours the result chip. */
  outcome: z.enum(["W", "D", "L"]),
});

const FormTeam = z.object({
  name: z.string().min(1).max(20),
  flag: z.string().min(1).optional(),
  color: z.enum(["cyan", "purple"]),
  /** 3–6 recent results, most recent first. */
  results: z.array(FormResult).min(1).max(6),
});

/**
 * Recent-form comparison board — BOTH teams' last few results in ONE
 * two-column scene (concise side-by-side W/D/L + scoreline), replacing two
 * separate `match-results` boards. Data-driven (no AI image), same dark board
 * family as tactics-board / group-intro.
 */
const FormCompareData = z.object({
  template: z.literal("form-compare"),
  /** Board title, default "Phong độ gần đây". */
  title: z.string().min(1).max(40).optional(),
  left: FormTeam,
  right: FormTeam,
});

const EngagementQuestionData = z.object({
  template: z.literal("engagement-question"),
  question: z.string().min(1).max(120),
  cta: z.string().min(1).max(40),
  tag: z.string().max(20).optional(),
});

const OutroData = z.object({
  template: z.literal("outro"),
  ctaTop: z.string().min(1).max(30),
  channelName: z.string().min(1).max(30),
  source: z.string().min(1).max(40),
});

export const TemplateData = z.discriminatedUnion("template", [
  HookData,
  ComparisonData,
  StatHeroData,
  FeatureListData,
  CalloutData,
  BigQuoteData,
  TimelineData,
  FormationPitchData,
  GroupIntroData,
  MatchResultsData,
  BracketData,
  TacticsBoardData,
  FormCompareData,
  EngagementQuestionData,
  OutroData,
]);

export type TemplateDataType = z.infer<typeof TemplateData>;

// ── SFX schema ─────────────────────────────────────────────────────────────
/**
 * Per-scene sound effect override. If omitted, the pipeline picks a default
 * SFX based on the template type (see SKILL.md / pipeline DEFAULT_SFX).
 *
 * `name` examples: "transition/whoosh-soft", "emphasis/ding", "alert/notification"
 *   → resolves to assets/sfx/<name>.mp3
 * Set `name: "none"` to explicitly disable SFX for this scene.
 */
const SfxSpec = z.object({
  name: z.string().min(1),
  /** Volume 0–1, default 0.4 (so SFX doesn't drown the voice) */
  volume: z.number().min(0).max(1).default(0.4),
  /** Seconds offset from scene start (default 0). Negative = before scene. */
  startOffsetSec: z.number().default(0),
});

export type SfxSpecType = z.infer<typeof SfxSpec>;

// ── Scene schema ───────────────────────────────────────────────────────────

const Scene = z.object({
  id: z.string().min(1),
  type: z.enum(["hook", "body", "outro"]),
  voiceText: z.string().min(1),
  templateData: TemplateData,
  /**
   * Overrides the auto-numbered chapter chip ("3/11") in the corner with a
   * literal label, e.g. "TIN 3/7". Roundups group several scenes under one news
   * item, so counting body scenes tells the viewer nothing useful.
   */
  marker: z.string().min(1).max(16).optional(),
  /** Optional sound effect override (else pipeline picks per template) */
  sfx: SfxSpec.optional(),
  /**
   * Optional AI image prompt (English, sports photography style).
   * Only generated for templates: hook (when no og:image), callout, stat-hero,
   * feature-list. Ignored for comparison, outro.
   */
  imagePrompt: z.string().min(10).max(1500).optional(),
});

// ── Root schema ────────────────────────────────────────────────────────────

/**
 * Canvas shape. "9:16" (1080×1920, TikTok/Reels) is the default and covers
 * every skill except `/news-roundup`; "16:9" (1920×1080, YouTube) swaps in the
 * landscape override stylesheet and lifts the scene/duration ceilings, because
 * a landscape roundup runs minutes rather than seconds.
 */
export const AspectSchema = z.enum(["9:16", "16:9"]);
export type Aspect = z.infer<typeof AspectSchema>;

/** Scene-count ceiling per aspect — a 6-minute roundup needs far more scenes. */
export const MAX_SCENES: Record<Aspect, number> = { "9:16": 20, "16:9": 40 };

export const ScriptSchema = z.object({
  version: z.literal("1.0"),
  metadata: z.object({
    title: z.string().min(1),
    source: z.object({
      url: z.string(),
      domain: z.string(),
      image: z.string().url().nullable(),
    }),
    channel: z.string().min(1),
    /** Canvas shape. Omitted → "9:16", so every existing script keeps working. */
    aspect: AspectSchema.default("9:16"),
  }),
  voice: z.object({
    provider: z.enum(["vieneu", "ausynclab", "fptai", "vbee"]),
    voiceId: z.string().min(1),
    speed: z.number().min(0.5).max(2.0),
  }),
  scenes: z
    .array(Scene)
    .min(5)
    .max(
      MAX_SCENES["16:9"],
      `scenes must have at most ${MAX_SCENES["16:9"]} items`,
    )
    .refine(
      (s) => s[0]?.type === "hook",
      { message: "scenes[0] must be type=hook" }
    )
    .refine(
      (s) => s[s.length - 1]?.type === "outro",
      { message: "last scene must be type=outro" }
    ),
}).superRefine((script, ctx) => {
  // The array cap above is the loosest of the two aspects (zod validates the
  // field before the object, so it cannot read metadata.aspect). Tighten it
  // here: 9:16 keeps the old 20-scene ceiling (news 5–8, analysis 10–15).
  const max = MAX_SCENES[script.metadata.aspect];
  if (script.scenes.length > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scenes"],
      message: `scenes must have at most ${max} items for aspect ${script.metadata.aspect}`,
    });
  }
});

export type Script = z.infer<typeof ScriptSchema>;
