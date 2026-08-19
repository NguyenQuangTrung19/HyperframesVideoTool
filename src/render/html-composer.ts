import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Aspect, Script, TemplateDataType } from "./script-schema.js";
import type { TiktokConfig } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "templates");

/**
 * Canvas per aspect. 9:16 is the TikTok/Reels default every skill but
 * `/news-roundup` uses; 16:9 is the YouTube landscape canvas, which loads
 * `styles-landscape.css` on top of the shared stylesheet (see CANVAS below and
 * the header of that file for how the two layers divide the work).
 */
export const CANVAS: Record<Aspect, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
};

/** Body class the landscape stylesheet scopes every one of its overrides to. */
const LANDSCAPE_BODY_CLASS = "ar-16x9";

// Default TikTok config (used if not passed)
const DEFAULT_TIKTOK: TiktokConfig = {
  displayName: "SportsForAllTV",
  handle: "@bonglan0702",
  followers: "1.2M followers",
};

export interface SceneAudio {
  id: string;
  durationSec: number;
}

export interface ComposeArgs {
  script: Script;
  sceneAudio: SceneAudio[];
  gapSec: number;
  /**
   * Silence prepended to the voice track by the pipeline. Absorbed into scene
   * 1's duration so the picture is up from frame 0 while the voice waits — see
   * the timing block below for why it is not applied as a start offset.
   * Defaults to 0 for callers that build their own audio (design-shot harness).
   */
  leadInSec?: number;
  /**
   * Map of scene id → relative image path (from output dir).
   * Hook gets og:image (or AI image if no og:image); callout/stat-hero get AI images
   * if their scene defines `imagePrompt`. Scenes not in the map render gradient bg.
   */
  sceneImages: Record<string, string>;
  /**
   * Map of scene id → image aspect ratio (width / height), when known.
   * Landscape images (aspect ≥ LANDSCAPE_MIN) render as a framed hero card
   * over a graphic deck instead of a cropped full-bleed `cover` background,
   * so a 16:9 Getty photo shows in full without distortion. Missing entry →
   * keep the default full-bleed cover fit.
   */
  sceneImageAspect?: Record<string, number>;
  audioRelPath: string;
  /** TikTok follow card config (injected into outro scene). Optional — defaults used if omitted. */
  tiktok?: TiktokConfig;
  /** Relative path to avatar image inside the output dir (e.g. "tiktok-avatar.jpg"). */
  tiktokAvatarRelPath?: string;
  /** Extra seconds added to outro scene visual duration after voice ends (TikTok card hold). Default 3. */
  outroHoldSec?: number;
}

export function composeHtml(args: ComposeArgs): string {
  const { script, sceneAudio, gapSec, sceneImages, audioRelPath } = args;
  // `aspect` is filled in by the zod default, but composeHtml is also handed
  // raw JSON.parse'd scripts (scripts/_design-shots.ts) and older script.json
  // files that predate the field — so fall back rather than crash on undefined.
  const aspect: Aspect = script.metadata.aspect ?? "9:16";
  const canvas = CANVAS[aspect];
  const tiktok = args.tiktok ?? DEFAULT_TIKTOK;
  const tiktokAvatar = args.tiktokAvatarRelPath ?? "tiktok-avatar.jpg";
  const outroHoldSec = args.outroHoldSec ?? 3;
  const leadInSec = args.leadInSec ?? 0;

  // Compute timing per scene. Outro scene gets extra HOLD seconds so the
  // TikTok follow card stays visible after the voice ends.
  //
  // The voice lead-in is added to scene 1's DURATION, not to its start time.
  // Do NOT "simplify" this to `cursor = leadInSec` — hyperframes only mounts a
  // `.clip` element inside its own data-start window, so a hook starting at 0.35
  // leaves the opening third of a second genuinely empty (measured: 3.8 luma
  // stddev through t=0.20, vs 38.8 the moment the window opens). Every later
  // scene still lands on its true audio time because scene 1 absorbed the shift.
  let cursor = 0;
  const timing = script.scenes.map((scene, idx) => {
    const audio = sceneAudio.find((a) => a.id === scene.id);
    if (!audio) throw new Error(`No audio entry for scene id=${scene.id}`);
    const isOutro = scene.type === "outro";
    const dur = audio.durationSec + gapSec
      + (isOutro ? outroHoldSec : 0)
      + (idx === 0 ? leadInSec : 0);
    const start = cursor;
    cursor += dur;
    return { scene, start, duration: dur };
  });
  const totalDuration = cursor;

  // Chapter-marker numbering: body scenes get an N/total chip in the corner.
  // hook + outro are excluded — they have their own visual identity. A scene
  // carrying its own `marker` (roundups: "TIN 3/7") prints that instead, and is
  // left out of the auto count so the two numbering schemes never disagree.
  const autoChapterScenes = script.scenes.filter((s) => s.type === "body" && !s.marker);
  const bodyTotal = autoChapterScenes.length;
  let bodyIdx = 0;

  // Render scenes
  const sceneHtml = timing.map(({ scene, start, duration }) => {
    const sceneImg = sceneImages[scene.id] ?? null;
    const sceneAspect = args.sceneImageAspect?.[scene.id] ?? null;
    let chapter: ChapterChip | null = null;
    if (scene.marker) {
      chapter = { label: scene.marker };
    } else if (scene.type === "body" && bodyTotal > 1) {
      bodyIdx += 1;
      chapter = { idx: bodyIdx, total: bodyTotal };
    }
    return renderScene(scene, start, duration, sceneImg, sceneAspect, tiktok, tiktokAvatar, chapter);
  }).join("\n");

  // Persistent shell — channel name + logo in top-left
  const shellHtml = renderShell(script.metadata, tiktokAvatar);

  // Glitch shader transitions at up to 2 "accent" scene boundaries (opt-in,
  // data-driven — shader.js + animations.js read window.__FX_TRANSITIONS).
  const fxHtml = buildFxTransitions(timing, sceneImages, args.sceneImageAspect, canvas);

  // animations.js is referenced externally by base.html.tmpl and copied to
  // outputDir by the pipeline (src/pipeline.ts copyFile). Keeping it external
  // (instead of inlining) keeps index.html under the hyperframes 300-line
  // composition lint threshold, which lets Chrome auto-worker calibration
  // stay at 4 workers instead of dropping to 1 (~4x render speedup).
  const tpl = readFileSync(join(TPL_DIR, "base.html.tmpl"), "utf8");
  const isLandscape = aspect === "16:9";
  return tpl
    .replace("{{TITLE}}", escapeHtml(script.metadata.title))
    .replace(/\{\{TOTAL_DURATION\}\}/g, totalDuration.toFixed(2))
    .replace(/\{\{WIDTH\}\}/g, String(canvas.w))
    .replace(/\{\{HEIGHT\}\}/g, String(canvas.h))
    .replace("{{BODY_CLASS}}", isLandscape ? LANDSCAPE_BODY_CLASS : "")
    .replace(
      "{{EXTRA_CSS}}",
      isLandscape ? `  <link rel="stylesheet" href="styles-landscape.css">` : "",
    )
    .replace("{{SHELL}}", shellHtml)
    .replace("{{SCENES}}", sceneHtml)
    .replace("{{FX}}", () => fxHtml)
    .replace(/src="voice\.mp3"/g, `src="${audioRelPath}"`);
}

/**
 * Glitch shader transitions at up to 2 "accent" scene boundaries.
 * Only boundaries where BOTH adjacent scenes render as full-bleed `cover`
 * images qualify — the shader samples each scene's background image as a
 * texture, so card / data-driven scenes (no single bg image) are skipped and
 * those boundaries keep the default CSS crossfade. Picks the first + last
 * eligible boundary (1–2 accents/video) so the effect stays punchy, not
 * fatiguing. Returns "" when nothing qualifies → no canvas, no behavior change.
 */
function buildFxTransitions(
  timing: { scene: Script["scenes"][number]; start: number; duration: number }[],
  sceneImages: Record<string, string>,
  sceneImageAspect: Record<string, number> | undefined,
  canvas: { w: number; h: number },
): string {
  const coverImageOf = (scene: Script["scenes"][number]): string | null => {
    const img = sceneImages[scene.id] ?? null;
    if (!img) return null;
    const tmpl = scene.templateData.template;
    const cardEligible =
      tmpl === "stat-hero" || tmpl === "callout" || tmpl === "feature-list";
    // Mirrors renderScene's fit decision: any card-eligible template with an
    // image renders as a framed card, never as a full-bleed texture the shader
    // could sample. In practice that leaves the hook alone, so a video rarely
    // has two adjacent cover scenes and the glitch stays off — by design.
    return cardEligible ? null : img;
  };

  const eligible: { at: number; texA: string; texB: string }[] = [];
  for (let i = 0; i < timing.length - 1; i++) {
    const a = coverImageOf(timing[i].scene);
    const b = coverImageOf(timing[i + 1].scene);
    if (a && b) eligible.push({ at: timing[i + 1].start, texA: a, texB: b });
  }
  if (eligible.length === 0) return "";

  const picks =
    eligible.length === 1 ? [eligible[0]] : [eligible[0], eligible[eligible.length - 1]];

  const preload = picks
    .map(
      (p, idx) =>
        `  <img id="fx-tex-${idx}-a" src="${p.texA}" crossorigin="anonymous" alt="">\n` +
        `  <img id="fx-tex-${idx}-b" src="${p.texB}" crossorigin="anonymous" alt="">`,
    )
    .join("\n");
  const config = picks.map((p) => ({ at: Number(p.at.toFixed(2)), dur: 0.68, preset: "glitch" }));

  return `<!-- FX: glitch shader transitions at accent boundaries -->
<div class="fx-tex-preload" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden">
${preload}
</div>
<canvas id="fx-transition" width="${canvas.w}" height="${canvas.h}" style="position:absolute;inset:0;width:${canvas.w}px;height:${canvas.h}px;z-index:40;opacity:0;pointer-events:none"></canvas>
<script>window.__FX_TRANSITIONS=${JSON.stringify(config)};</script>`;
}

// ── PERSISTENT SHELL ───────────────────────────────────────────────────────
function renderShell(metadata: Script["metadata"], avatarRelPath: string): string {
  const channel = escapeHtml(metadata.channel);
  // Drifting dust — the only motion left in the shell. The v2 shell also had a
  // rotating gradient and three 120px-blurred orbs; those made the surface tone
  // wander from scene to scene, which is half of why the background read as
  // muddy. The grid + vignette in `.shell-bg` is static by design.
  const particleCount = 16;
  const particleColors = [
    'rgba(14,134,201,0.22)', 'rgba(255,178,36,0.20)', 'rgba(135,146,166,0.18)',
  ];
  const particlesHtml = Array.from({ length: particleCount }, (_, i) => {
    const size = 3 + Math.round(Math.random() * 6);
    const left = Math.round(Math.random() * 100);
    const dur = 10 + Math.round(Math.random() * 15);
    const delay = Math.round(Math.random() * 12);
    const color = particleColors[i % particleColors.length];
    return `<div class="particle" style="width:${size}px;height:${size}px;left:${left}%;background:${color};animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
  }).join('');

  return `
<!-- Shell: persistent brand elements (no data-start → always visible) -->
<div class="shell-bg"></div>
<div class="shell-vignette"></div>

<div class="particles-layer">${particlesHtml}</div>

<div class="brand-shell-header">
  <div class="brand-icon"><img src="${escapeHtml(avatarRelPath)}" alt="${escapeHtml(metadata.channel)}" crossorigin="anonymous" /></div>
  <div class="brand-text">
    <div class="brand-name">${channel}</div>
    <div class="brand-tag">TIN TỨC BÓNG ĐÁ</div>
  </div>
</div>`.trim();
}

// ── SCENE DISPATCH ─────────────────────────────────────────────────────────
/**
 * Shape bucket — picks WHICH fixed slot the photo covers (see `.bg-card` in
 * styles.css). It does not decide cover-vs-card; every body image is a framed
 * card.
 *
 * SQUARE IS ITS OWN BUCKET, not a rounding error. With only two buckets the
 * cut sat at 1.05, so a 736×736 grok output landed in the 0.767 PORTRAIT slot
 * and lost 23% of its width — on `hosts-2030` that ate the S off "SPAIN" and
 * half of "MOROCCO". Square outputs are common enough from grok to deserve a
 * slot of their own; the band is generous (0.88–1.22) because anything in it
 * crops to 1:1 for under 10%.
 */
const SQUARE_MIN = 0.88;
const SQUARE_MAX = 1.22;

type ImageShape = "landscape" | "square" | "portrait";

/**
 * Corner progress chip. Either the auto "N / total" body counter, or a literal
 * label a scene set through `marker` (roundups group several scenes per news
 * item, so counting scenes would mislead).
 */
type ChapterChip = { idx: number; total: number } | { label: string };

function renderChapterChip(chapter: ChapterChip | null): string {
  if (!chapter) return "";
  if ("label" in chapter) {
    return `<div class="chapter-marker chapter-label"><span class="chapter-idx">${escapeHtml(chapter.label)}</span></div>`;
  }
  return `<div class="chapter-marker"><span class="chapter-idx">${chapter.idx}</span><span class="chapter-sep">/</span><span class="chapter-total">${chapter.total}</span></div>`;
}

/**
 * Unknown aspect (image-dims couldn't parse the header) falls back to the wide
 * box — the most common shape by a wide margin.
 */
function shapeOf(aspect: number | null): ImageShape {
  if (aspect === null || aspect > SQUARE_MAX) return "landscape";
  if (aspect >= SQUARE_MIN) return "square";
  return "portrait";
}

function renderScene(
  scene: Script["scenes"][number],
  start: number,
  duration: number,
  sceneImageRelPath: string | null,
  sceneAspect: number | null,
  tiktok: TiktokConfig,
  tiktokAvatarRelPath: string,
  chapter: ChapterChip | null = null,
): string {
  const td = scene.templateData;

  // ONLY the hook is full-bleed (2026-07-27). Every body image — landscape OR
  // portrait — sits in a framed card drawn at the photo's TRUE aspect, so
  // nothing is cropped or stretched; the card's fit-box just changes shape.
  // Templates whose text is lower-anchored (stat-hero, callout, feature-list)
  // are the ones that can host that card; the rest carry no scene image.
  //
  // In 16:9 not even the hook is full-bleed — the landscape stylesheet reframes
  // its background into the same right-hand slot the body scenes use, so that
  // canvas never puts text on top of a photo. See styles-landscape.css.
  const cardEligible =
    td.template === "stat-hero" || td.template === "callout" || td.template === "feature-list";
  const fit: "cover" | "card" = sceneImageRelPath && cardEligible ? "card" : "cover";
  const shape = shapeOf(sceneAspect);

  let inner: string;
  let layoutName: string;

  switch (td.template) {
    case "hook":
      inner = renderHookInner(td, sceneImageRelPath);
      layoutName = "hook";
      break;
    case "comparison":
      inner = renderComparisonInner(td);
      layoutName = "comparison";
      break;
    case "stat-hero":
      inner = renderStatHeroInner(td, sceneImageRelPath, fit, sceneAspect);
      layoutName = "stat-hero";
      break;
    case "feature-list":
      inner = renderFeatureListInner(td, sceneImageRelPath, fit, sceneAspect);
      layoutName = "feature-list";
      break;
    case "callout":
      inner = renderCalloutInner(td, sceneImageRelPath, fit, sceneAspect);
      layoutName = "callout";
      break;
    case "big-quote":
      inner = renderBigQuoteInner(td, sceneImageRelPath);
      layoutName = "big-quote";
      break;
    case "timeline":
      inner = renderTimelineInner(td);
      layoutName = "timeline";
      break;
    case "formation-pitch":
      inner = renderFormationPitchInner(td);
      layoutName = "formation-pitch";
      break;
    case "group-intro":
      inner = renderGroupIntroInner(td);
      layoutName = "group-intro";
      break;
    case "match-results":
      inner = renderMatchResultsInner(td);
      layoutName = "match-results";
      break;
    case "bracket":
      inner = renderBracketInner(td);
      layoutName = "bracket";
      break;
    case "tactics-board":
      inner = renderTacticsBoardInner(td);
      layoutName = "tactics-board";
      break;
    case "form-compare":
      inner = renderFormCompareInner(td);
      layoutName = "form-compare";
      break;
    case "engagement-question":
      inner = renderEngagementQuestionInner(td);
      layoutName = "engagement-question";
      break;
    case "outro":
      inner = renderOutroInner(td, tiktok, tiktokAvatarRelPath);
      layoutName = "outro";
      break;
    default: {
      const _never: never = td;
      throw new Error(`Unknown template: ${(_never as any).template}`);
    }
  }

  const chapterHtml = renderChapterChip(chapter);

  return buildScene(scene, start, duration, layoutName, inner + chapterHtml, fit, shape);
}

/** Renders a Ken-Burns photo bg + dark overlay, or a gradient fallback. */
function bgWithImageOrGradient(imageRelPath: string | null, kbClass = "kb-zoom-in", overlayOpacity = 0.20): string {
  if (imageRelPath) {
    return `<div class="bg ${kbClass}" style="background-image: url('${imageRelPath}')"></div>
  <div class="overlay" style="opacity: ${overlayOpacity}"></div>`;
  }
  return `<div class="bg gradient-news-dark"></div>`;
}

/**
 * Body-image treatment (every non-hook image): the photo sits in a white-matted
 * card on the shared shell surface, and the surface is all that's behind it.
 *
 * Two layers are deliberately gone as of 2026-07-27:
 *  - the dark navy "deck" panel, which made body scenes a different world from
 *    the cream feature-list / question scenes one cut away;
 *  - the blurred copy of the photo behind the card. `blur(42px)` at
 *    `brightness(0.42)` turned every image into the same brown-grey, dropped
 *    gold text on it to 1.8:1, and read as a compression artefact rather than
 *    as design.
 *
 * The card's size no longer follows the photo's ratio — `shape` picks one of
 * two FIXED slots and the photo covers it (see `.bg-card` in styles.css for
 * why, and for the crop budget).
 */
function bgImageCard(imageRelPath: string, aspect: number | null): string {
  const shape = shapeOf(aspect);
  return `<div class="bg-card" data-shape="${shape}">
    <div class="bg-card-img kb-card-zoom" style="background-image: url('${imageRelPath}')"></div>
  </div>`;
}

// ── HOOK SCENE ─────────────────────────────────────────────────────────────
function renderHookInner(
  td: Extract<TemplateDataType, { template: "hook" }>,
  sceneImageRelPath: string | null,
): string {
  let bgHtml: string;
  if (sceneImageRelPath) {
    const kbClass = `kb-${td.kenBurns ?? "zoom-in"}`;
    bgHtml = `<div class="bg ${kbClass}" style="background-image: url('${sceneImageRelPath}')"></div>
  <div class="overlay" style="opacity: 0.05"></div>`;
  } else {
    bgHtml = `<div class="bg gradient-news-dark"></div>`;
  }

  const headline = wrapWordsWithBreaks(td.headline, "hh-word");
  const subhead = td.subhead ? escapeHtmlWithBreaks(td.subhead) : "";
  const bigStat = td.bigStat ? escapeHtml(td.bigStat) : "";

  // Kicker = competition / context strap (broadcast lower-third). Rendered only
  // when `eyebrow` is set; `eyebrowSub` adds an optional second line (matchweek).
  // No fallback to the channel name — the persistent shell already brands.
  const kickerHtml = td.eyebrow
    ? `<div class="hook-kicker">
      <span class="hook-kicker-bar"></span>
      <span class="hook-kicker-text">${escapeHtml(td.eyebrow)}${td.eyebrowSub ? `<small>${escapeHtml(td.eyebrowSub)}</small>` : ""}</span>
    </div>`
    : "";

  return `${bgHtml}
  <div class="bg-grade-overlay"></div>
  <div class="layout-hook">
    ${kickerHtml}
    ${bigStat ? `<div class="hook-bigstat" data-len="${td.bigStat!.length}">${bigStat}</div>
    <div class="hook-statbar"></div>` : ""}
    <div class="hook-headline">${headline}</div>
    ${subhead ? `<div class="hook-subhead">${subhead}</div>` : ""}
  </div>`;
}

// ── COMPARISON SCENE ───────────────────────────────────────────────────────
/**
 * Horizontal bar-chart comparison. Bars sized proportionally to the largest
 * numeric magnitude extracted from each side's value. Falls back to the
 * old 2-card layout when either side has no extractable number.
 */
function renderComparisonInner(td: Extract<TemplateDataType, { template: "comparison" }>): string {
  // Score-prediction scoreboard — when BOTH sides carry a flag/crest, render a
  // broadcast-style "flags + scoreline" board instead of bars. Used for the
  // predicted-result card in pre-match previews.
  if (td.left.flag && td.right.flag) {
    return renderComparisonScoreboard(td);
  }

  const lNum = extractMagnitude(td.left.value);
  const rNum = extractMagnitude(td.right.value);
  const canChart = lNum !== null && rNum !== null;

  if (!canChart) {
    // Fallback — keep the old 2-card layout for non-numeric comparisons
    // (e.g. "World Cup" vs "Euro + NL").
    const winnerClass = td.right.winner ? " card-winner" : "";
    return `
<div class="layout-comparison layout-comparison-cards">
  <div class="cmp-card cmp-left color-${td.left.color}">
    <div class="cmp-label">${escapeHtml(td.left.label)}</div>
    <div class="cmp-value">${escapeHtml(td.left.value)}</div>
  </div>
  <div class="cmp-vs">VS</div>
  <div class="cmp-card cmp-right color-${td.right.color}${winnerClass}">
    <div class="cmp-label">${escapeHtml(td.right.label)}</div>
    <div class="cmp-value">${escapeHtml(td.right.value)}</div>
    ${td.right.winner ? '<div class="cmp-winner-badge">WINNER</div>' : ""}
  </div>
</div>`.trim();
  }

  // Chart mode — proportional bars
  const max = Math.max(lNum, rNum);
  const lPct = (lNum / max) * 100;
  const rPct = (rNum / max) * 100;

  // Determine winner: numeric wins; else fallback to td.right.winner flag
  const lWin = lNum > rNum;
  const rWin = rNum > lNum;
  const lWinnerClass = lWin ? " row-winner" : "";
  const rWinnerClass = (rWin || (lNum === rNum && td.right.winner)) ? " row-winner" : "";

  const delta = Math.abs(lNum - rNum);
  let deltaHtml = "";
  if (delta > 0) {
    const leaderLabel = lWin ? td.left.label : td.right.label;
    deltaHtml = `<div class="cmp-delta"><span class="cmp-delta-arrow">▲</span><span class="cmp-delta-leader">${escapeHtml(leaderLabel)}</span> dẫn <span class="cmp-delta-num">+${delta}</span></div>`;
  } else {
    deltaHtml = `<div class="cmp-delta cmp-delta-tie">Hai bên ngang ngửa</div>`;
  }

  return `
<div class="layout-comparison layout-comparison-chart">
  <div class="cmp-row cmp-left color-${td.left.color}${lWinnerClass}">
    <div class="cmp-side-head">
      <span class="cmp-side-label">${escapeHtml(td.left.label)}</span>
      <span class="cmp-bar-value">${renderComparisonValue(td.left.value)}</span>
    </div>
    <div class="cmp-bar-track">
      <div class="cmp-bar-fill" data-pct="${lPct.toFixed(1)}"></div>
    </div>
  </div>
  <div class="cmp-row cmp-right color-${td.right.color}${rWinnerClass}">
    <div class="cmp-side-head">
      <span class="cmp-side-label">${escapeHtml(td.right.label)}</span>
      <span class="cmp-bar-value">${renderComparisonValue(td.right.value)}</span>
    </div>
    <div class="cmp-bar-track">
      <div class="cmp-bar-fill" data-pct="${rPct.toFixed(1)}"></div>
    </div>
  </div>
  ${deltaHtml}
</div>`.trim();
}

/**
 * Score-prediction scoreboard variant of the comparison scene. Two team blocks
 * (flag + name) flanking a big centered scoreline. The higher numeric score
 * glows as the winner (ties → no glow). Same dark "prediction board" aesthetic
 * as group-intro / match-results so all forecast cards feel like one family.
 */
function renderComparisonScoreboard(td: Extract<TemplateDataType, { template: "comparison" }>): string {
  const lNum = extractMagnitude(td.left.value);
  const rNum = extractMagnitude(td.right.value);
  const lWin = lNum !== null && rNum !== null && lNum > rNum;
  const rWin = lNum !== null && rNum !== null && rNum > lNum;

  const eyebrow = td.eyebrow ? escapeHtml(td.eyebrow) : "Dự đoán tỉ số";
  const foot = td.foot ? escapeHtml(td.foot) : "Dự đoán của <b>SportsForAllTV</b>";
  const noteHtml = td.note ? `\n  <div class="cs-note">${escapeHtml(td.note)}</div>` : "";

  // Fixture mode: an unplayed match carries no scoreline. Use the "?" sentinel
  // on both sides to render a clean "VS" badge instead of an ugly "? - ?".
  const isFixture = td.left.value.trim() === "?" && td.right.value.trim() === "?";
  const scoreHtml = isFixture
    ? `<div class="cs-score cs-score-vs"><span class="cs-vs">VS</span></div>`
    : `<div class="cs-score">
      <span class="cs-sc cs-sc-l${lWin ? " cs-sc-win" : ""}">${escapeHtml(td.left.value)}</span>
      <span class="cs-dash">-</span>
      <span class="cs-sc cs-sc-r${rWin ? " cs-sc-win" : ""}">${escapeHtml(td.right.value)}</span>
    </div>`;

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-comparison layout-comparison-score">
  <div class="cs-eyebrow">${eyebrow}</div>
  <div class="cs-board">
    <div class="cs-side cs-left color-${td.left.color}${lWin ? " cs-win" : ""}">
      <div class="cs-flag"><img src="${escapeHtml(td.left.flag!)}" alt="${escapeHtml(td.left.label)}" /></div>
      <div class="cs-team">${escapeHtml(td.left.label)}</div>
    </div>
    ${scoreHtml}
    <div class="cs-side cs-right color-${td.right.color}${rWin ? " cs-win" : ""}">
      <div class="cs-flag"><img src="${escapeHtml(td.right.flag!)}" alt="${escapeHtml(td.right.label)}" /></div>
      <div class="cs-team">${escapeHtml(td.right.label)}</div>
    </div>
  </div>${noteHtml}
  <div class="cs-foot">${foot}</div>
</div>`.trim();
}

// ── STAT HERO SCENE (v2 — photo-hero top + text stack below) ──────────────
// Redesigned 2026-05-26 per visual-overhaul slide-deck pivot.
// - Image is a HERO ROUNDED CARD (≈63% width, ≈48% height) in upper frame,
//   not a fullbleed background. User feedback: images must be VISIBLY dominant.
// - Text content stacks below (value HUGE, label, highlights, context).
// - Kinetic entry (scale + fade) for stop-scroll on info-dense slides.
// - Premium dark backdrop (radial deep-navy), no fullbleed photo blur.
function renderStatHeroInner(
  td: Extract<TemplateDataType, { template: "stat-hero" }>,
  sceneImageRelPath: string | null,
  fit: "cover" | "card" = "cover",
  aspect: number | null = null,
): string {
  let bgHtml: string;
  if (sceneImageRelPath && fit === "card") {
    bgHtml = bgImageCard(sceneImageRelPath, aspect);
  } else if (sceneImageRelPath) {
    bgHtml = `<div class="bg kb-zoom-in" style="background-image: url('${sceneImageRelPath}')"></div>
  <div class="overlay" style="opacity: 0.03"></div>
  <div class="bg-grade-overlay" style="background: radial-gradient(ellipse 80% 70% at 50% 40%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.32) 60%, rgba(0,0,0,0.48) 100%)"></div>`;
  } else {
    bgHtml = `<div class="bg gradient-forest"></div>`;
  }

  const context = td.context ? `<div class="stat-context">${escapeHtml(td.context)}</div>` : "";
  const highlights = td.highlights && td.highlights.length > 0
    ? `<div class="stat-highlights">
    ${td.highlights.map((h, i) => (
      `<div class="stat-highlight" data-idx="${i}"><div class="stat-highlight-dot"></div><div class="stat-highlight-text">${escapeHtml(h)}</div></div>`
    )).join("\n    ")}
  </div>`
    : "";
  const counter = pickCounterTarget(td.value);
  const counterAttr = counter !== null ? ` data-counter-to="${counter}"` : "";
  const initialText = counter !== null ? "0" : escapeHtml(td.value);
  return `${bgHtml}
<div class="layout-stat-hero stat-hero-v2">
  <div class="stat-hero-content">
    <div class="stat-value"${counterAttr}>
      <span class="stat-value-text">${initialText}</span>
    </div>
    <div class="sh2-divider">
      <div class="sh2-div-line"></div>
      <div class="sh2-div-diamond"></div>
      <div class="sh2-div-line"></div>
    </div>
    <div class="stat-label">${escapeHtmlWithBreaks(td.label)}</div>
    ${highlights}
    ${context}
  </div>
</div>`.trim();
}

// ── FEATURE LIST SCENE (broadcast lower-third cards + optional image) ────────
/**
 * "Broadcast" cards — each bullet is a deep-green lower-third card with a gold
 * hairline, an emerald tick node, and a gold accent edge. Because the items are
 * peers (team news, head-to-head, talking points), there is NO numbering — a
 * numeral would imply a ranking that doesn't exist.
 *
 * An optional scene image always renders as a framed hero card above the list
 * (2026-07-27 — only the hook is full-bleed now). The card is drawn at the
 * photo's true ratio; CSS fits landscape into a wide box and portrait into a
 * tall-but-narrower one, so neither shape is cropped. No image → cards sit on
 * the persistent cream deck. When an image is present the safe zone is
 * tighter, so bullets are capped at 3.
 */
function renderFeatureListInner(
  td: Extract<TemplateDataType, { template: "feature-list" }>,
  sceneImageRelPath: string | null = null,
  fit: "cover" | "card" = "cover",
  aspect: number | null = null,
): string {
  const cardMode = !!sceneImageRelPath && fit === "card"; // framed hero card
  const bullets = sceneImageRelPath ? td.bullets.slice(0, 3) : td.bullets;

  const cards = bullets.map((b, i) =>
    `<div class="feat-card" data-idx="${i}">
      <div class="feat-node"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#0a2e1e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="feat-text">${escapeFeatBullet(b)}</div>
    </div>`
  ).join("\n    ");

  // Hero card sits inside the list layout (kept out of the shared bg-card
  // sizing so the list owns the lower frame). No injected background — the
  // persistent cream shell shows through, so the green cards keep the same
  // high-contrast look as the no-image mode.
  const shape = shapeOf(aspect);
  let heroHtml = "";
  if (cardMode) {
    const ar = Math.min(Math.max(aspect ?? 1.6, 0.5), 2.0);
    heroHtml = `<div class="feat-hero" data-shape="${shape}" style="--ar: ${ar.toFixed(3)}; aspect-ratio: ${ar.toFixed(3)}">
    <div class="feat-hero-img kb-card-zoom" style="background-image: url('${sceneImageRelPath}')"></div>
  </div>`;
  }

  const modeClass = cardMode
    ? ` feat-withcard${shape === "portrait" ? " feat-portrait" : ""}`
    : "";

  return `
<div class="layout-feature-list${modeClass}">
  ${heroHtml}
  <div class="feat-header">
    <div class="feat-eyebrow"></div>
    <div class="feat-title">${escapeHtmlWithBreaks(td.title)}</div>
  </div>
  <div class="feat-cards">
    ${cards}
  </div>
</div>`.trim();
}

// ── CALLOUT SCENE (v2 — image card top + quote-style statement below) ────
// Redesigned 2026-05-26 per visual-overhaul slide-deck pivot. Premium-slow
// staggered entries — image fade-up first, tag scale-in, statement word-reveal.
function renderCalloutInner(
  td: Extract<TemplateDataType, { template: "callout" }>,
  sceneImageRelPath: string | null,
  fit: "cover" | "card" = "cover",
  aspect: number | null = null,
): string {
  let bgHtml: string;
  if (sceneImageRelPath && fit === "card") {
    bgHtml = bgImageCard(sceneImageRelPath, aspect);
  } else if (sceneImageRelPath) {
    bgHtml = `<div class="bg kb-zoom-in" style="background-image: url('${sceneImageRelPath}')"></div>
  <div class="overlay" style="opacity: 0.04"></div>
  <div class="bg-grade-overlay" style="background: radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 60%, rgba(0,0,0,0.42) 100%)"></div>`;
  } else {
    bgHtml = `<div class="bg gradient-cream"></div>`;
  }

  const tag = td.tag ? `<div class="callout-tag">${escapeHtml(td.tag)}</div>` : "";
  return `${bgHtml}
<div class="layout-callout">
  <div class="callout-content">
    ${tag}
    <div class="callout-statement">${wrapWordsWithBreaks(td.statement, "co-word")}</div>
  </div>
</div>`.trim();
}

// ── BIG QUOTE SCENE ────────────────────────────────────────────────────────
/** Portrait image on top half + huge pull quote card on bottom half. */
function renderBigQuoteInner(
  td: Extract<TemplateDataType, { template: "big-quote" }>,
  sceneImageRelPath: string | null,
): string {
  const portrait = sceneImageRelPath
    ? `<div class="bq-portrait" style="background-image: url('${sceneImageRelPath}')"></div>
  <div class="bq-portrait-fade"></div>`
    : `<div class="bq-portrait bq-portrait-gradient"></div>
  <div class="bq-portrait-fade"></div>`;

  const quote = wrapWordsWithBreaks(td.quote, "bq-word");

  return `${portrait}
<div class="layout-big-quote">
  <div class="bq-card">
    <div class="bq-mark">"</div>
    <div class="bq-quote">${quote}</div>
    <div class="bq-attribution">— ${escapeHtml(td.attribution)}</div>
  </div>
</div>`.trim();
}

// ── FORMATION PITCH SCENE ──────────────────────────────────────────────────
/**
 * Tactical pre-match graphic — green pitch with player tokens placed by
 * formation rows. `rows` is back→front (GK first, ST last); CSS uses
 * flex-direction:column-reverse so GK lands at the bottom of the pitch.
 * Players within a row spread evenly. Each token fades in row-by-row.
 */
function renderFormationPitchInner(
  td: Extract<TemplateDataType, { template: "formation-pitch" }>,
): string {
  let playerIdx = 0;
  const rowsHtml = td.rows
    .map(
      (row, rowIdx) => `
    <div class="fp-row" data-row="${rowIdx}">
      ${row
        .map(
          (name) =>
            `<div class="fp-player${rowIdx === 0 ? " fp-gk" : ""}" data-idx="${playerIdx++}">
        <div class="fp-token"></div>
        <div class="fp-name">${escapeHtml(name)}</div>
      </div>`,
        )
        .join("\n      ")}
    </div>`,
    )
    .join("\n    ");

  return `
<div class="bg gradient-news-dark"></div>
<div class="layout-formation-pitch">
  <div class="fp-header">
    <div class="fp-eyebrow"></div>
    <div class="fp-title">${escapeHtml(td.title)}</div>
    <div class="fp-formation">${escapeHtml(td.formation)}</div>
  </div>
  <div class="fp-pitch">
    <div class="fp-pitch-lines"></div>
    <div class="fp-goal"></div>
    ${rowsHtml}
  </div>
</div>`.trim();
}

// ── GROUP INTRO SCENE ──────────────────────────────────────────────────────
/**
 * Data-driven group-stage reveal (flags/crests + team names + predicted
 * finish), rendered in HTML/CSS — no AI image. Teams are listed in predicted
 * finishing order; index+1 is the displayed rank. `qualify` gold-highlights a
 * row + uses the gold chip. `flag` is an <img> src (flag/crest URL or path).
 */
function renderGroupIntroInner(
  td: Extract<TemplateDataType, { template: "group-intro" }>,
): string {
  const rows = td.teams
    .map(
      (t, i) => `
    <div class="gi-team${t.qualify ? " gi-qualify" : ""}" data-idx="${i}">
      <div class="gi-rank">${i + 1}</div>
      <div class="gi-flag"><img src="${escapeHtml(t.flag)}" alt="${escapeHtml(t.name)}" /></div>
      <div class="gi-name">
        <div class="gi-name-t">${escapeHtml(t.name)}</div>
        ${t.note ? `<div class="gi-name-s">${escapeHtml(t.note)}</div>` : ""}
      </div>
      <div class="gi-chip ${t.qualify ? "go" : "out"}">${escapeHtml(t.result)}</div>
    </div>`,
    )
    .join("\n");

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-group-intro">
  <div class="gi-head">
    <div class="gi-eyebrow">Dự đoán · World Cup 2026</div>
    <div class="gi-group"><span class="gi-group-lbl">Bảng</span>${escapeHtml(td.group)}</div>
    <div class="gi-rule"></div>
  </div>
  <div class="gi-teams">
    ${rows}
  </div>
  <div class="gi-foot">Thứ hạng dự đoán của <b>SportsForAllTV</b></div>
</div>`.trim();
}

// ── MATCH RESULTS SCENE ────────────────────────────────────────────────────
/**
 * Data-driven results board (list of predicted scorelines) — no AI image.
 * Each row: home (right-aligned) · score-score · away (left-aligned), with an
 * optional small note (e.g. "luân lưu"). Used for group game-by-game scores
 * and knockout-round result lists. Same dark-green board aesthetic as
 * group-intro.
 */
function renderMatchResultsInner(
  td: Extract<TemplateDataType, { template: "match-results" }>,
): string {
  const rows = td.matches
    .map(
      (m, i) => `
    <div class="mr-row" data-idx="${i}">
      <div class="mr-home">${escapeHtml(m.home)}</div>
      <div class="mr-score">
        <div class="mr-sc-line"><span class="mr-sc">${escapeHtml(m.homeScore)}</span><span class="mr-sep">-</span><span class="mr-sc">${escapeHtml(m.awayScore)}</span></div>
        ${m.note ? `<div class="mr-note">${escapeHtml(m.note)}</div>` : ""}
      </div>
      <div class="mr-away">${escapeHtml(m.away)}</div>
    </div>`,
    )
    .join("\n");

  const eyebrow = escapeHtml(td.eyebrow ?? "Dự đoán · World Cup 2026");
  const footHtml = td.foot ? escapeHtml(td.foot) : "Tỉ số dự đoán của <b>SportsForAllTV</b>";

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-match-results">
  <div class="mr-head">
    <div class="mr-eyebrow">${eyebrow}</div>
    <div class="mr-title">${escapeHtml(td.title)}</div>
    ${td.subtitle ? `<div class="mr-sub">${escapeHtml(td.subtitle)}</div>` : ""}
    <div class="mr-rule"></div>
  </div>
  <div class="mr-rows${td.matches.length > 6 ? " mr-dense" : ""}">
    ${rows}
  </div>
  <div class="mr-foot">${footHtml}</div>
</div>`.trim();
}

// ── BRACKET SCENE ──────────────────────────────────────────────────────────
/**
 * Knockout-bracket "chia nhánh" summary. Matches split into two columns that
 * funnel (via connector stubs + a center spine) toward a round badge. Pure
 * data (flags + names), no AI image — same dark board family as group-intro.
 */
function renderBracketInner(td: Extract<TemplateDataType, { template: "bracket" }>): string {
  const half = Math.ceil(td.matches.length / 2);
  const left = td.matches.slice(0, half);
  const right = td.matches.slice(half);

  const teamHtml = (t: { name: string; flag: string }) =>
    `<div class="brk-team"><span class="brk-flag"><img src="${escapeHtml(t.flag)}" alt="${escapeHtml(t.name)}" /></span><span class="brk-name">${escapeHtml(t.name)}</span></div>`;

  const matchHtml = (m: { left: { name: string; flag: string }; right: { name: string; flag: string }; note?: string }) => `
    <div class="brk-match">
      ${teamHtml(m.left)}
      ${teamHtml(m.right)}
      ${m.note ? `<div class="brk-when">${escapeHtml(m.note)}</div>` : ""}
    </div>`;

  const centerLabel = escapeHtml(td.centerLabel ?? "Vòng 1/8");

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-bracket">
  <div class="brk-head">
    <div class="brk-title">${escapeHtml(td.title)}</div>
    ${td.subtitle ? `<div class="brk-sub">${escapeHtml(td.subtitle)}</div>` : ""}
  </div>
  <div class="brk-grid">
    <div class="brk-col brk-col-l">
      ${left.map(matchHtml).join("\n")}
    </div>
    <div class="brk-center">
      <div class="brk-badge">${centerLabel}</div>
    </div>
    <div class="brk-col brk-col-r">
      ${right.map(matchHtml).join("\n")}
    </div>
  </div>
</div>`.trim();
}

// ── TACTICS BOARD SCENE ────────────────────────────────────────────────────
/**
 * Two-column "đấu pháp" tactical comparison — each side shows formation,
 * approach headline, key mechanisms and the tactical linchpin, split by a
 * center VS spine. Data-driven (no AI image), same dark board family as
 * group-intro / bracket.
 */
function renderTacticsBoardInner(
  td: Extract<TemplateDataType, { template: "tactics-board" }>,
): string {
  const side = (
    t: Extract<TemplateDataType, { template: "tactics-board" }>["left"],
    which: "l" | "r",
  ) => {
    const flagHtml = t.flag
      ? `<span class="tac-flag"><img src="${escapeHtml(t.flag)}" alt="${escapeHtml(t.name)}" /></span>`
      : "";
    const pts = t.points
      .map((p) => `<div class="tac-point"><span class="tac-dot"></span><span class="tac-ptext">${escapeHtml(p)}</span></div>`)
      .join("\n        ");
    const keyHtml = t.keyPlayer
      ? `<div class="tac-key"><span class="tac-key-lbl">Chìa khóa</span><span class="tac-key-name">${escapeHtml(t.keyPlayer)}</span></div>`
      : "";
    return `
    <div class="tac-col tac-${t.color} tac-col-${which}">
      <div class="tac-team">${flagHtml}<span class="tac-name">${escapeHtml(t.name)}</span></div>
      <div class="tac-form">${escapeHtml(t.formation)}</div>
      <div class="tac-approach">${escapeHtml(t.approach)}</div>
      <div class="tac-points">
        ${pts}
      </div>
      ${keyHtml}
    </div>`;
  };

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-tactics">
  <div class="tac-head">
    <div class="tac-eyebrow">Đấu pháp</div>
    <div class="tac-title">${escapeHtml(td.title ?? "Lối chơi dự kiến")}</div>
    <div class="tac-rule"></div>
  </div>
  <div class="tac-grid">
    ${side(td.left, "l")}
    <div class="tac-center"><div class="tac-vs">VS</div></div>
    ${side(td.right, "r")}
  </div>
</div>`.trim();
}

// ── FORM COMPARE SCENE ─────────────────────────────────────────────────────
/**
 * Recent-form comparison board — BOTH teams' last few results in ONE
 * two-column scene. Each side lists opponent + scoreline with a W/D/L outcome
 * chip (W green / D gold / L red). Data-driven (no AI image), same dark board
 * family as tactics-board / group-intro. Replaces two separate match-results
 * boards in previews.
 */
function renderFormCompareInner(
  td: Extract<TemplateDataType, { template: "form-compare" }>,
): string {
  const side = (
    t: Extract<TemplateDataType, { template: "form-compare" }>["left"],
    which: "l" | "r",
  ) => {
    const flagHtml = t.flag
      ? `<span class="fc-flag"><img src="${escapeHtml(t.flag)}" alt="${escapeHtml(t.name)}" /></span>`
      : "";
    const rows = t.results
      .map(
        (r) => `
        <div class="fc-row">
          <span class="fc-chip fc-${r.outcome}">${escapeHtml(r.outcome)}</span>
          <span class="fc-opp">${escapeHtml(r.opponent)}</span>
          <span class="fc-score">${escapeHtml(r.score)}</span>
        </div>`,
      )
      .join("\n");
    return `
    <div class="fc-col fc-${t.color} fc-col-${which}">
      <div class="fc-team">${flagHtml}<span class="fc-name">${escapeHtml(t.name)}</span></div>
      <div class="fc-rows">
        ${rows}
      </div>
    </div>`;
  };

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-form-compare">
  <div class="fc-head">
    <div class="fc-eyebrow">Phong độ</div>
    <div class="fc-title">${escapeHtml(td.title ?? "Phong độ gần đây")}</div>
    <div class="fc-rule"></div>
  </div>
  <div class="fc-grid">
    ${side(td.left, "l")}
    <div class="fc-center"><div class="fc-vs">VS</div></div>
    ${side(td.right, "r")}
  </div>
</div>`.trim();
}

// ── ENGAGEMENT QUESTION SCENE ──────────────────────────────────────────────
/**
 * Comment-prompt scene that always sits right before the outro. The question
 * is content-derived (forces a viewer opinion / pick); the CTA prompts a
 * comment. Same glass-card aesthetic as callout but with the question
 * (60px) + bouncing arrow CTA pill below.
 */
function renderEngagementQuestionInner(
  td: Extract<TemplateDataType, { template: "engagement-question" }>,
): string {
  const tag = td.tag ? `<div class="eq-tag">${escapeHtml(td.tag)}</div>` : "";
  const question = wrapWordsWithBreaks(td.question, "eq-word");

  // NO `.bg-grade-overlay` here. That overlay is a black radial reaching 0.5
  // alpha, built to sink a PHOTO back so text can sit on it — and this scene
  // has no photo. Over the light background it just multiplied the surface down
  // to #9a9792, which is the dirty grey the whole scene rendered as, with a
  // near-white card floating invisibly on top of it.
  return `
<div class="bg gradient-news-dark"></div>
<div class="layout-engagement-question">
  <div class="eq-card">
    ${tag}
    <div class="eq-question">${question}</div>
    <div class="eq-divider"></div>
    <div class="eq-cta">
      <span class="eq-cta-arrow">↓</span>
      <span class="eq-cta-text">${escapeHtml(td.cta)}</span>
    </div>
  </div>
</div>`.trim();
}

// ── TIMELINE SCENE ─────────────────────────────────────────────────────────
function renderTimelineInner(td: Extract<TemplateDataType, { template: "timeline" }>): string {
  const items = td.items.map((it, i) => `
    <div class="tl-item" data-idx="${i}">
      <div class="tl-card">
        <div class="tl-year">${escapeHtml(it.year)}</div>
        <div class="tl-event">${escapeHtml(it.event)}</div>
      </div>
      <div class="tl-connector"></div>
      <div class="tl-dot"></div>
    </div>`).join("\n  ");

  return `
<div class="bg gradient-news-dark"></div>
<div class="layout-timeline">
  <div class="tl-title">${escapeHtmlWithBreaks(td.title)}</div>
  <div class="tl-items">
    <div class="tl-spine"></div>
    ${items}
  </div>
</div>`.trim();
}

// ── OUTRO SCENE ────────────────────────────────────────────────────────────
function renderOutroInner(
  td: Extract<TemplateDataType, { template: "outro" }>,
  tiktok: TiktokConfig,
  avatarRelPath: string,
): string {
  const ttCard = renderTiktokCard(tiktok, avatarRelPath);
  return `
<div class="layout-outro">
  <div class="out-cta-top">${escapeHtml(td.ctaTop)}</div>
  <div class="out-channel">${escapeHtml(td.channelName)}</div>
  <div class="out-underline"></div>
</div>
${ttCard}`.trim();
}

/**
 * TikTok follow card — adapted from HyperFrames `tiktok-follow` block.
 * Slides up from bottom mid-outro. Animations are added by animations.js
 * targeting elements with id="tt-card", id="tt-follow-btn", etc.
 */
function renderTiktokCard(tiktok: TiktokConfig, avatarRelPath: string): string {
  return `
<div id="tt-card" class="tt-card">
  <img class="tt-avatar" src="${escapeHtml(avatarRelPath)}" alt="${escapeHtml(tiktok.displayName)}" crossorigin="anonymous" />
  <div class="tt-profile-info">
    <div class="tt-display-name">${escapeHtml(tiktok.displayName)}</div>
    <div class="tt-handle">${escapeHtml(tiktok.handle)}</div>
    <div class="tt-followers">${escapeHtml(tiktok.followers)}</div>
  </div>
  <div id="tt-follow-btn" class="tt-follow-btn">
    <span id="tt-btn-follow" class="tt-btn-text">Follow</span>
    <span id="tt-btn-following" class="tt-btn-text tt-btn-text-following">
      <span>Following</span>
      <span class="tt-check-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
    </span>
  </div>
</div>`.trim();
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function buildScene(
  scene: Script["scenes"][number],
  start: number,
  duration: number,
  layoutName: string,
  innerHtml: string,
  fit: "cover" | "card" = "cover",
  shape: ImageShape = "landscape",
): string {
  return `
<div class="scene clip" id="scene-${scene.id}"
     data-start="${start.toFixed(2)}" data-duration="${duration.toFixed(2)}" data-active="0"
     data-layout="${layoutName}" data-fit="${fit}" data-shape="${shape}">
  ${innerHtml}
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Like escapeHtml but converts the soft-break marker `|` → `<br>`.
 * Use only on fields rendered with very large fonts where the writer
 * needs phrasing-aware control over line breaks (hook headline, callout
 * statement, feature-list title, stat-hero label). Other fields should
 * stay on `escapeHtml` so a stray `|` renders verbatim instead of
 * silently fragmenting tight one-line UI labels.
 */
function escapeHtmlWithBreaks(s: string): string {
  return escapeHtml(s).replace(/\|/g, "<br>");
}

/**
 * Feature-list bullet escape: like escapeHtml but promotes a single
 * `**key phrase**` span to <b> (gold highlight via `.feat-text b`) so a
 * player/team name pops. Escaping runs first, so only the literal `**`
 * markers survive to be matched — no HTML injection surface.
 */
function escapeFeatBullet(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

/**
 * Split a text field into word-level <span class="${cls}"> for staggered
 * entrance animations. Honors the `|` → `<br>` soft-break marker the same
 * way escapeHtmlWithBreaks does. Words are space-separated in the output
 * so natural typography (spacing, line-wrap) is preserved when CSS makes
 * the spans inline-block.
 */
function wrapWordsWithBreaks(s: string, cls: string): string {
  return escapeHtml(s)
    .split("|")
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .map((w) => `<span class="${cls}">${w}</span>`)
        .join(" ")
    )
    .join("<br>");
}

/**
 * Detects values that can be tweened with a numeric count-up animation
 * (e.g. "79", "200", "5000"). Compound or decorated values like
 * "15+8", "€80M", "#7", "1m70", "3:1" — and decimals — are skipped:
 * the animation falls back to the standard scale-pop reveal for them.
 */
function pickCounterTarget(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Extract a magnitude from a comparison value string for bar-chart sizing.
 * "8 QBV" → 8, "44 cúp" → 44, "821 bàn" → 821, "€80M" → 80, "1m70" → 170,
 * "World Cup" → null, "Euro + NL" → null.
 * Concatenates all digit runs so multi-part numbers ("1m70") still compare
 * proportionally with similarly-formatted siblings.
 */
function extractMagnitude(s: string): number | null {
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Render a comparison value with count-up support: if it matches
 * "<integer><optional space><suffix>", wrap the integer in a span the
 * animator can tween from 0. Otherwise return escaped HTML as-is.
 */
function renderComparisonValue(value: string): string {
  const m = value.match(/^(\d+)(\s.+)?$/);
  if (!m) return escapeHtml(value);
  const num = m[1];
  const suffix = m[2] ?? "";
  return `<span class="cmp-num" data-target="${num}">0</span>${escapeHtml(suffix)}`;
}
