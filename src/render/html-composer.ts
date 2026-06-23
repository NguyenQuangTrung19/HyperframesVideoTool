import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Script, TemplateDataType } from "./script-schema.js";
import type { TiktokConfig } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "templates");

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
   * Map of scene id → relative image path (from output dir).
   * Hook gets og:image (or AI image if no og:image); callout/stat-hero get AI images
   * if their scene defines `imagePrompt`. Scenes not in the map render gradient bg.
   */
  sceneImages: Record<string, string>;
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
  const tiktok = args.tiktok ?? DEFAULT_TIKTOK;
  const tiktokAvatar = args.tiktokAvatarRelPath ?? "tiktok-avatar.jpg";
  const outroHoldSec = args.outroHoldSec ?? 3;

  // Compute timing per scene. Outro scene gets extra HOLD seconds so the
  // TikTok follow card stays visible after the voice ends.
  let cursor = 0;
  const timing = script.scenes.map((scene) => {
    const audio = sceneAudio.find((a) => a.id === scene.id);
    if (!audio) throw new Error(`No audio entry for scene id=${scene.id}`);
    const isOutro = scene.type === "outro";
    const dur = audio.durationSec + gapSec + (isOutro ? outroHoldSec : 0);
    const start = cursor;
    cursor += dur;
    return { scene, start, duration: dur };
  });
  const totalDuration = cursor;

  // Chapter-marker numbering: body scenes get an N/total chip in the corner.
  // hook + outro are excluded — they have their own visual identity.
  const bodyTotal = script.scenes.filter((s) => s.type === "body").length;
  let bodyIdx = 0;

  // Render scenes
  const sceneHtml = timing.map(({ scene, start, duration }) => {
    const sceneImg = sceneImages[scene.id] ?? null;
    let chapter: { idx: number; total: number } | null = null;
    if (scene.type === "body" && bodyTotal > 1) {
      bodyIdx += 1;
      chapter = { idx: bodyIdx, total: bodyTotal };
    }
    return renderScene(scene, start, duration, sceneImg, tiktok, tiktokAvatar, chapter);
  }).join("\n");

  // Persistent shell — channel name + logo in top-left
  const shellHtml = renderShell(script.metadata, tiktokAvatar);

  // animations.js is referenced externally by base.html.tmpl and copied to
  // outputDir by the pipeline (src/pipeline.ts copyFile). Keeping it external
  // (instead of inlining) keeps index.html under the hyperframes 300-line
  // composition lint threshold, which lets Chrome auto-worker calibration
  // stay at 4 workers instead of dropping to 1 (~4x render speedup).
  const tpl = readFileSync(join(TPL_DIR, "base.html.tmpl"), "utf8");
  return tpl
    .replace("{{TITLE}}", escapeHtml(script.metadata.title))
    .replace(/\{\{TOTAL_DURATION\}\}/g, totalDuration.toFixed(2))
    .replace("{{SHELL}}", shellHtml)
    .replace("{{SCENES}}", sceneHtml)
    .replace(/src="voice\.mp3"/g, `src="${audioRelPath}"`);
}

// ── PERSISTENT SHELL ───────────────────────────────────────────────────────
function renderShell(metadata: Script["metadata"], avatarRelPath: string): string {
  const channel = escapeHtml(metadata.channel);
  // Particles HTML — 20 random floating dots generated at build time
  const particleCount = 20;
  const particleColors = [
    'rgba(16,185,129,0.35)', 'rgba(196,163,90,0.30)',
    'rgba(5,150,105,0.25)', 'rgba(255,255,255,0.20)',
  ];
  const particlesHtml = Array.from({ length: particleCount }, (_, i) => {
    const size = 3 + Math.round(Math.random() * 6);
    const left = Math.round(Math.random() * 100);
    const dur = 10 + Math.round(Math.random() * 15);
    const delay = Math.round(Math.random() * 12);
    const color = particleColors[i % particleColors.length];
    return `<div class="particle" style="width:${size}px;height:${size}px;left:${left}%;background:${color};box-shadow:0 0 ${size * 2}px ${color};animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
  }).join('');

  return `
<!-- Shell: persistent brand elements (no data-start → always visible) -->
<div class="shell-bg">
  <div class="glow-orb glow-orb-1"></div>
  <div class="glow-orb glow-orb-2"></div>
  <div class="glow-orb glow-orb-3"></div>
</div>

<div class="dot-grid-layer"></div>

<div class="particles-layer">${particlesHtml}</div>

<div class="corner-accent corner-tl"></div>
<div class="corner-accent corner-tr"></div>
<div class="corner-accent corner-bl"></div>
<div class="corner-accent corner-br"></div>

<div class="progress-bar">
  <div class="progress-fill" id="progress-fill"></div>
  <div class="progress-dot" id="progress-dot"></div>
</div>

<div class="brand-shell-header">
  <div class="brand-icon"><img src="${escapeHtml(avatarRelPath)}" alt="${escapeHtml(metadata.channel)}" crossorigin="anonymous" /></div>
  <div class="brand-text">
    <div class="brand-name">${channel}</div>
    <div class="brand-tag">TIN TỨC BÓNG ĐÁ</div>
  </div>
</div>`.trim();
}

// ── SCENE DISPATCH ─────────────────────────────────────────────────────────
function renderScene(
  scene: Script["scenes"][number],
  start: number,
  duration: number,
  sceneImageRelPath: string | null,
  tiktok: TiktokConfig,
  tiktokAvatarRelPath: string,
  chapter: { idx: number; total: number } | null = null,
): string {
  const td = scene.templateData;

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
      inner = renderStatHeroInner(td, sceneImageRelPath);
      layoutName = "stat-hero";
      break;
    case "feature-list":
      inner = renderFeatureListInner(td);
      layoutName = "feature-list";
      break;
    case "callout":
      inner = renderCalloutInner(td, sceneImageRelPath);
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

  const chapterHtml = chapter
    ? `<div class="chapter-marker"><span class="chapter-idx">${chapter.idx}</span><span class="chapter-sep">/</span><span class="chapter-total">${chapter.total}</span></div>`
    : "";

  return buildScene(scene, start, duration, layoutName, inner + chapterHtml);
}

/** Renders a Ken-Burns photo bg + dark overlay, or a gradient fallback. */
function bgWithImageOrGradient(imageRelPath: string | null, kbClass = "kb-zoom-in", overlayOpacity = 0.20): string {
  if (imageRelPath) {
    return `<div class="bg ${kbClass}" style="background-image: url('${imageRelPath}')"></div>
  <div class="overlay" style="opacity: ${overlayOpacity}"></div>`;
  }
  return `<div class="bg gradient-news-dark"></div>`;
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

  return `
<div class="bg group-intro-bg"></div>
<div class="layout-comparison layout-comparison-score">
  <div class="cs-eyebrow">Dự đoán tỉ số</div>
  <div class="cs-board">
    <div class="cs-side cs-left color-${td.left.color}${lWin ? " cs-win" : ""}">
      <div class="cs-flag"><img src="${escapeHtml(td.left.flag!)}" alt="${escapeHtml(td.left.label)}" /></div>
      <div class="cs-team">${escapeHtml(td.left.label)}</div>
    </div>
    <div class="cs-score">
      <span class="cs-sc cs-sc-l${lWin ? " cs-sc-win" : ""}">${escapeHtml(td.left.value)}</span>
      <span class="cs-dash">-</span>
      <span class="cs-sc cs-sc-r${rWin ? " cs-sc-win" : ""}">${escapeHtml(td.right.value)}</span>
    </div>
    <div class="cs-side cs-right color-${td.right.color}${rWin ? " cs-win" : ""}">
      <div class="cs-flag"><img src="${escapeHtml(td.right.flag!)}" alt="${escapeHtml(td.right.label)}" /></div>
      <div class="cs-team">${escapeHtml(td.right.label)}</div>
    </div>
  </div>
  <div class="cs-foot">Dự đoán của <b>SportsForAllTV</b></div>
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
): string {
  const bgHtml = sceneImageRelPath
    ? `<div class="bg kb-zoom-in" style="background-image: url('${sceneImageRelPath}')"></div>
  <div class="overlay" style="opacity: 0.03"></div>
  <div class="bg-grade-overlay" style="background: radial-gradient(ellipse 80% 70% at 50% 40%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.32) 60%, rgba(0,0,0,0.48) 100%)"></div>`
    : `<div class="bg gradient-forest"></div>`;

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

// ── FEATURE LIST SCENE ─────────────────────────────────────────────────────
/**
 * Numbered cards layout — each bullet is its own glass card with a large
 * cyan numeral on the left. Stagger-slides in from the right.
 */
function renderFeatureListInner(td: Extract<TemplateDataType, { template: "feature-list" }>): string {
  const cards = td.bullets.map((b, i) =>
    `<div class="feat-card" data-idx="${i}">
      <div class="feat-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="feat-divider"></div>
      <div class="feat-text">${escapeHtml(b)}</div>
    </div>`
  ).join("\n    ");

  return `
<div class="layout-feature-list">
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
): string {
  const bgHtml = sceneImageRelPath
    ? `<div class="bg kb-zoom-in" style="background-image: url('${sceneImageRelPath}')"></div>
  <div class="overlay" style="opacity: 0.04"></div>
  <div class="bg-grade-overlay" style="background: radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 60%, rgba(0,0,0,0.42) 100%)"></div>`
    : `<div class="bg gradient-cream"></div>`;

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

  return `
<div class="bg gradient-news-dark"></div>
<div class="bg-grade-overlay"></div>
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
): string {
  return `
<div class="scene clip" id="scene-${scene.id}"
     data-start="${start.toFixed(2)}" data-duration="${duration.toFixed(2)}" data-active="0"
     data-layout="${layoutName}">
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
