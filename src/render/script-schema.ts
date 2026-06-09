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
});

const ComparisonData = z.object({
  template: z.literal("comparison"),
  left: ComparisonSide,
  right: ComparisonSide.extend({ winner: z.boolean().optional() }),
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
   * Each bullet ≤ 20 chars, max 4 bullets.
   */
  highlights: z.array(z.string().min(1).max(20)).min(1).max(4).optional(),
});

const FeatureListData = z.object({
  template: z.literal("feature-list"),
  title: z.string().min(1).max(40),
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
  /** Optional sound effect override (else pipeline picks per template) */
  sfx: SfxSpec.optional(),
  /**
   * Optional AI image prompt (English, sports photography style).
   * Only generated for templates: hook (when no og:image), callout, stat-hero.
   * Ignored for comparison, feature-list, outro.
   */
  imagePrompt: z.string().min(10).max(1500).optional(),
});

// ── Root schema ────────────────────────────────────────────────────────────

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
  }),
  voice: z.object({
    provider: z.enum(["vieneu", "ausynclab"]),
    voiceId: z.string().min(1),
    speed: z.number().min(0.5).max(2.0),
  }),
  scenes: z
    .array(Scene)
    .min(5)
    .max(20, "scenes must have at most 20 items (news 5–8, analysis 10–15)")
    .refine(
      (s) => s[0]?.type === "hook",
      { message: "scenes[0] must be type=hook" }
    )
    .refine(
      (s) => s[s.length - 1]?.type === "outro",
      { message: "last scene must be type=outro" }
    ),
});

export type Script = z.infer<typeof ScriptSchema>;
