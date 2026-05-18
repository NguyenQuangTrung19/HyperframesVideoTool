import type { WordTiming } from "./align.js";

export interface CaptionOpts {
  /** Font family. Must be installed (libass uses fontconfig). Default: Segoe UI Black */
  font?: string;
  /** Font size in ASS pixel units (canvas is 1080x1920). Default: 100 */
  fontSize?: number;
  /**
   * How many words to show on screen at once (window centered on active word).
   * 3 is the TikTok-readable sweet spot. Use 1 for one-word-at-a-time flashes.
   */
  windowSize?: 1 | 3 | 5;
  /**
   * Vertical position 0..1. 0.55–0.6 places caption just above center, which
   * stays clear of TikTok's right-rail UI without covering on-screen faces.
   * Default 0.58.
   */
  yPosition?: number;
  /** Hex color (no #) for the active word. Default "FFFFFF" (white, pops over blue base). */
  activeColorRgb?: string;
  /** Hex color for non-active visible words. Default "7FDBFF" (light blue / cyan). */
  baseColorRgb?: string;
  /** Hex color for the outline. Default "000000" (black). */
  outlineColorRgb?: string;
  /** Outline width in pixels. Default 8. */
  outlineWidth?: number;
  /** Drop-shadow depth in px (0 disables). Default 4. */
  shadowDepth?: number;
  /**
   * Scale-pop animation on the active word: percentage to grow to. 100 disables.
   * Default 118 — a tasteful "punch" on entry.
   */
  popScale?: number;
  /** Pop animation duration in ms. Default 90. */
  popDurationMs?: number;
  /**
   * Left margin (px from canvas left edge) at which text wraps. Default 40.
   * Set higher to keep captions inside a narrower box (e.g. inside the card
   * outline). With WrapStyle 0 (smart wrap), text wider than
   * `PlayResX - marginL - marginR` automatically breaks to multiple lines.
   */
  marginL?: number;
  /** Right margin (px from canvas right edge). Default 40. */
  marginR?: number;
  /**
   * `\q` wrap style override:
   *   - 0 = smart wrap (default for chunks mode — keeps text inside margins)
   *   - 1 = end-of-line wrap (low quality)
   *   - 2 = NO wrap (only \N or \n forced breaks)
   *   - 3 = same as 0 but biases lower line to be the longer one
   */
  wrapStyle?: 0 | 1 | 2 | 3;
}

/** Canvas dimensions (always 9:16 portrait for TikTok). */
const PLAY_RES_X = 1080;
const PLAY_RES_Y = 1920;

/**
 * Build an .ass subtitle file with karaoke-style word highlighting.
 *
 * For each word in `words`, generate one Dialogue event that runs from that
 * word's start time until the next word's start (so events tile and the
 * caption is on screen continuously). Each event renders a sliding window of
 * surrounding words with the active word in `activeColorRgb` and the rest in
 * `baseColorRgb`.
 */
export function buildAssFromWords(words: WordTiming[], opts: CaptionOpts = {}): string {
  const font = opts.font ?? "Segoe UI";
  const fontSize = opts.fontSize ?? 48;
  const windowSize = opts.windowSize ?? 3;
  // 0.82 puts the caption near the bottom of the foreground card for typical
  // FG_MARGIN=120 (foreground bottom ≈ y=1706, caption center ≈ y=1574 →
  // ~90px gap from the card's bottom edge).
  const yPos = opts.yPosition ?? 0.82;
  const activeRgb = opts.activeColorRgb ?? "FFFFFF";
  const baseRgb = opts.baseColorRgb ?? "7FDBFF";
  const outlineRgb = opts.outlineColorRgb ?? "000000";
  const outlineWidth = opts.outlineWidth ?? 8;
  const shadowDepth = Math.max(0, opts.shadowDepth ?? 4);
  const popScale = Math.max(100, Math.min(200, opts.popScale ?? 100));
  const popDurMs = Math.max(0, Math.min(500, opts.popDurationMs ?? 90));

  const baseAssColor = rgbToAssBgr(baseRgb);
  const activeAssColor = rgbToAssBgr(activeRgb);
  const outlineAssColor = rgbToAssBgr(outlineRgb);

  const x = Math.round(PLAY_RES_X / 2);
  const y = Math.round(PLAY_RES_Y * yPos);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${baseAssColor},${baseAssColor},${outlineAssColor},&H80000000&,1,0,0,0,100,100,0,0,1,${outlineWidth},${shadowDepth},5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const halfWin = Math.floor(windowSize / 2);

  for (let i = 0; i < words.length; i++) {
    const cur = words[i];
    const next = words[i + 1];
    const startSec = cur.start;
    // Tile: end at next word's start, or hold 0.4s past last word.
    const endSec = next ? next.start : cur.end + 0.4;
    if (endSec <= startSec) continue; // skip zero/negative duration events

    // Build the visible word window centered on i.
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(words.length - 1, i + halfWin);
    const segments: string[] = [];
    // Active word gets a scale-pop tween at the start of its event:
    //   \fscx100\fscy100\t(0,POP_MS,\fscxN\fscyN)
    // Holds at N% scale for the rest of the event. Next event resets to 100%.
    const popAnim = popScale > 100 && popDurMs > 0
      ? `\\fscx100\\fscy100\\t(0,${popDurMs},\\fscx${popScale}\\fscy${popScale})`
      : "";
    for (let j = lo; j <= hi; j++) {
      const word = escapeAssText(words[j].w);
      if (j === i) {
        segments.push(`{${popAnim}\\c${activeAssColor}}${word}{\\fscx100\\fscy100\\c${baseAssColor}}`);
      } else {
        segments.push(word);
      }
    }
    const text = `{\\pos(${x},${y})}${segments.join(" ")}`;
    events.push(
      `Dialogue: 0,${fmtAssTime(startSec)},${fmtAssTime(endSec)},Default,,0,0,0,,${text}`,
    );
  }

  return header + events.join("\n") + "\n";
}

/** Convert "RRGGBB" hex (no #) to ASS color literal "&H00BBGGRR&". */
function rgbToAssBgr(rgb: string): string {
  const clean = rgb.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Invalid RGB hex "${rgb}", expected 6 hex chars`);
  }
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

/** Format seconds → ASS time "H:MM:SS.cc". */
function fmtAssTime(sec: number): string {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Escape characters that have special meaning inside ASS Dialogue text.
 *
 * `{` and `}` open/close override blocks (e.g. `{\c&Hxx&}`), and `\` is the
 * escape lead-in. Vietnamese diacritics pass through unchanged as long as the
 * .ass file is written as UTF-8 — which the consumer (writeFile) does by
 * default.
 */
function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

/**
 * Sentence-level karaoke: instead of a 3-word sliding window, show the
 * ENTIRE current sentence on screen with the active word highlighted.
 * Cleaner for podcast-style narration where the viewer wants to read
 * coherent thoughts rather than chase scrolling words.
 *
 * Sentences are detected by terminal punctuation (`.`, `!`, `?`) and
 * ellipsis (`…`); long sentences (>=14 words) also break at commas
 * (`,`) so a single dialogue event never has more than ~14 words of
 * tokens — that's the practical cap for a 1080×1920 canvas at 64–72px
 * font when set in two lines.
 *
 * Each word still anchors one Dialogue event so the active highlight
 * tracks word-by-word, but the surrounding text is the full sentence
 * (rendered identically across events, so libass effectively only
 * re-strikes the override color tags between events).
 */
export function buildAssFromSentences(words: WordTiming[], opts: CaptionOpts = {}): string {
  const font = opts.font ?? "Segoe UI";
  const fontSize = opts.fontSize ?? 40;
  // 0.78 sits the caption a little higher than the word-karaoke variant —
  // sentences wrap to multiple lines and we want them centered, not
  // bottom-anchored.
  const yPos = opts.yPosition ?? 0.78;
  // White / cyan is the proven legible combination over busy footage.
  const activeRgb = opts.activeColorRgb ?? "FFFFFF";
  const baseRgb = opts.baseColorRgb ?? "B8D4FF";
  const outlineRgb = opts.outlineColorRgb ?? "000000";
  const outlineWidth = opts.outlineWidth ?? 6;
  const shadowDepth = Math.max(0, opts.shadowDepth ?? 3);
  // Default popScale=100 disables the active-word "pop" scale-up. Earlier
  // default (110-118) caused the whole sentence to shift left/right as each
  // active word scaled up — the centered alignment recomputed total width
  // per frame, making captions appear to "flicker" or "pulse". Color change
  // alone is enough to highlight the active word.
  const popScale = Math.max(100, Math.min(200, opts.popScale ?? 100));
  const popDurMs = Math.max(0, Math.min(500, opts.popDurationMs ?? 90));

  const baseAssColor = rgbToAssBgr(baseRgb);
  const activeAssColor = rgbToAssBgr(activeRgb);
  const outlineAssColor = rgbToAssBgr(outlineRgb);

  const x = Math.round(PLAY_RES_X / 2);
  const y = Math.round(PLAY_RES_Y * yPos);

  // MarginL/MarginR = 80 leaves an 80px gutter on each side for wrapping
  // (so 920px-wide effective text width). WrapStyle 0 = smart balanced wrap.
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${baseAssColor},${baseAssColor},${outlineAssColor},&H80000000&,1,0,0,0,100,100,0,0,1,${outlineWidth},${shadowDepth},5,80,80,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const sentences = groupIntoSentences(words);
  const events: string[] = [];
  for (const sent of sentences) {
    for (let i = 0; i < sent.length; i++) {
      const cur = sent[i];
      const next = sent[i + 1];
      const startSec = cur.start;
      // Last word holds an extra 0.3s so the completed sentence stays on
      // screen briefly before the next one snaps in.
      const endSec = next ? next.start : cur.end + 0.3;
      if (endSec <= startSec) continue;

      const popAnim = popScale > 100 && popDurMs > 0
        ? `\\fscx100\\fscy100\\t(0,${popDurMs},\\fscx${popScale}\\fscy${popScale})`
        : "";
      const segments = sent.map((w, j) => {
        const tok = escapeAssText(w.w);
        if (j === i) {
          return `{${popAnim}\\c${activeAssColor}}${tok}{\\fscx100\\fscy100\\c${baseAssColor}}`;
        }
        return tok;
      });
      // \an5 = center-center alignment; \pos overrides MarginV anchoring.
      const text = `{\\an5\\pos(${x},${y})}${segments.join(" ")}`;
      events.push(
        `Dialogue: 0,${fmtAssTime(startSec)},${fmtAssTime(endSec)},Default,,0,0,0,,${text}`,
      );
    }
  }

  return header + events.join("\n") + "\n";
}

/**
 * Viral-clip captions — short 2-4 word chunks, ALL CAPS, bold white.
 * No per-word color animation; the whole chunk lights up at once for the
 * snappy podcast-clip rhythm. Each chunk tiles from its first word's start
 * time to the next chunk's first-word start (or +0.3s for the last chunk).
 *
 * Position: ASS \pos is set by the caller via yPosition (0..1 of 1920).
 */
export function buildAssFromChunks(words: WordTiming[], opts: CaptionOpts = {}): string {
  const font = opts.font ?? "Segoe UI Black";
  const fontSize = opts.fontSize ?? 56;
  const yPos = opts.yPosition ?? 0.72;
  const activeRgb = opts.activeColorRgb ?? "FFFFFF";
  const outlineRgb = opts.outlineColorRgb ?? "000000";
  const outlineWidth = opts.outlineWidth ?? 8;
  const shadowDepth = Math.max(0, opts.shadowDepth ?? 4);
  // Default popScale=100 disables the active-word "pop" scale-up. Earlier
  // default (110-118) caused the whole sentence to shift left/right as each
  // active word scaled up — the centered alignment recomputed total width
  // per frame, making captions appear to "flicker" or "pulse". Color change
  // alone is enough to highlight the active word.
  const popScale = Math.max(100, Math.min(200, opts.popScale ?? 100));
  const popDurMs = Math.max(0, Math.min(500, opts.popDurationMs ?? 80));
  // Wrap defaults — chunks mode previously used `2` (no wrap) which let long
  // captions extend past the card outline. Switch to smart-wrap (0) so any
  // chunk that exceeds the wrap-width breaks across lines instead of bleeding
  // beyond the card edges.
  const wrapStyle = opts.wrapStyle ?? 0;
  const marginL = opts.marginL ?? 40;
  const marginR = opts.marginR ?? 40;

  const activeAssColor = rgbToAssBgr(activeRgb);
  const outlineAssColor = rgbToAssBgr(outlineRgb);

  const x = Math.round(PLAY_RES_X / 2);
  const y = Math.round(PLAY_RES_Y * yPos);

  // Per-event MarginL/R are also set so the wrap-width clamp on each
  // Dialogue line matches the style margin (libass uses event-overrides when
  // non-zero, falls back to style margin otherwise).
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: ${wrapStyle}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${activeAssColor},${activeAssColor},${outlineAssColor},&H80000000&,1,0,0,0,100,100,0,0,1,${outlineWidth},${shadowDepth},5,${marginL},${marginR},40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const chunks = groupIntoChunks(words);
  const events: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const next = chunks[i + 1];
    const startSec = chunk[0].start;
    const endSec = next ? next[0].start : chunk[chunk.length - 1].end + 0.3;
    if (endSec <= startSec) continue;

    const popAnim = popScale > 100 && popDurMs > 0
      ? `\\fscx100\\fscy100\\t(0,${popDurMs},\\fscx${popScale}\\fscy${popScale})`
      : "";
    // Strip trailing comma / semicolon from displayed words so caps look clean.
    const chunkText = chunk
      .map((w) => escapeAssText(w.w.replace(/[,;]$/, "").toUpperCase()))
      .join(" ");
    const text = `{\\an5\\pos(${x},${y})${popAnim}}${chunkText}`;
    events.push(
      `Dialogue: 0,${fmtAssTime(startSec)},${fmtAssTime(endSec)},Default,,0,0,0,,${text}`,
    );
  }

  return header + events.join("\n") + "\n";
}

/**
 * Group words into short 2-4 word chunks for viral-clip captions.
 *
 * - Hard break at sentence-terminal punctuation (`.`, `!`, `?`, `…`).
 * - Soft break at commas/semicolons when running chunk has ≥2 words.
 * - Target 2-4 words per chunk; cap at 4. When a sentence runs longer
 *   than 4 words with no internal punctuation, split every 3-4 words.
 */
function groupIntoChunks(words: WordTiming[]): WordTiming[][] {
  const out: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  const TARGET = 4;
  for (const w of words) {
    cur.push(w);
    const tail = w.w.replace(/[")\]'’”]+$/u, "");
    const last = tail.slice(-1);
    const isHardBreak = last === "." || last === "!" || last === "?" || last === "…";
    const isSoftBreak = (last === "," || last === ";") && cur.length >= 2;
    if (isHardBreak || isSoftBreak || cur.length >= TARGET) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/**
 * Group a flat word list into "sentences" suitable for one-screen display.
 *
 * Hard break (always splits): word ends with `.`, `!`, `?`, or `…`.
 * Soft break (only when the running chunk has ≥6 words): `,` or `;` —
 * keeps very long sentences from spilling over the canvas. Hard cap of
 * 14 words per chunk as a final safety net.
 */
function groupIntoSentences(words: WordTiming[]): WordTiming[][] {
  const out: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  const HARD_CAP = 14;
  const SOFT_MIN = 6;
  for (const w of words) {
    cur.push(w);
    // Strip trailing close-quotes/brackets before testing the last char.
    const tail = w.w.replace(/[")\]'’”]+$/u, "");
    const last = tail.slice(-1);
    if (last === "." || last === "!" || last === "?" || last === "…") {
      out.push(cur);
      cur = [];
    } else if ((last === "," || last === ";") && cur.length >= SOFT_MIN) {
      out.push(cur);
      cur = [];
    } else if (cur.length >= HARD_CAP) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}
