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

/** Internal event representation before .ass serialization. */
interface EventItem {
  startSec: number;
  endSec: number;
  text: string;
}

/**
 * Sort events by startSec and clamp each event's endSec so it never
 * extends past the next event's startSec. Drops events whose duration
 * collapses to ≤0 after clamping.
 *
 * This is the SAFETY NET against non-monotonic word timings — when the
 * upstream realigner produces words whose temporal order disagrees with
 * the script order (e.g. inserted source words whose interpolated end
 * runs past the next Whisper anchor), naive event emission causes two
 * captions to render simultaneously on screen ("overlap"). Sorting +
 * clamping guarantees at most one event is visible at any time.
 */
function clampEventOverlaps(items: EventItem[]): EventItem[] {
  const sorted = items.slice().sort((a, b) =>
    a.startSec - b.startSec || a.endSec - b.endSec,
  );
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endSec > sorted[i + 1].startSec) {
      sorted[i].endSec = sorted[i + 1].startSec;
    }
  }
  return sorted.filter((e) => e.endSec > e.startSec + 0.001);
}

function serializeEvents(items: EventItem[]): string {
  return clampEventOverlaps(items)
    .map(
      (e) =>
        `Dialogue: 0,${fmtAssTime(e.startSec)},${fmtAssTime(e.endSec)},Default,,0,0,0,,${e.text}`,
    )
    .join("\n");
}

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

  const events: EventItem[] = [];
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
    events.push({ startSec, endSec, text });
  }

  return header + serializeEvents(events) + "\n";
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

  // MarginL/MarginR = 80 leaves an 80px gutter on each side. WrapStyle 2 =
  // NO automatic wrap — `groupIntoSentences` already caps each chunk to fit
  // on one line, so we disable wrap entirely to prevent libass from creating
  // stacked lines that overlap each other with the default leading.
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${baseAssColor},${baseAssColor},${outlineAssColor},&H80000000&,1,0,0,0,100,100,0,0,1,${outlineWidth},${shadowDepth},5,80,80,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const sentences = groupIntoSentences(words);
  const events: EventItem[] = [];
  for (let s = 0; s < sentences.length; s++) {
    const sent = sentences[s];
    const nextSent = sentences[s + 1];
    const nextSentStart = nextSent ? nextSent[0].start : undefined;
    for (let i = 0; i < sent.length; i++) {
      const cur = sent[i];
      const next = sent[i + 1];
      const startSec = cur.start;
      // Within a sentence: event ends at next word's start. Last word of
      // sentence: end at next sentence's start. Very last sentence: hold +0.3s.
      // The final `clampEventOverlaps` pass guarantees no two events stay on
      // screen at the same time even if upstream word timings are non-monotonic.
      const endSec = next
        ? next.start
        : nextSentStart !== undefined
          ? nextSentStart
          : cur.end + 0.3;
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
      events.push({ startSec, endSec, text });
    }
  }

  return header + serializeEvents(events) + "\n";
}

/**
 * Reveal-style captions — progressive word-by-word build-up.
 *
 * For each sentence, generate N events (N = words in sentence). Event i
 * shows words 0..i. As each new word is spoken, it appears on screen and
 * joins the previously-revealed words. The sentence builds up word-by-word
 * (typewriter feel) and remains fully visible until the next sentence
 * starts (then the screen clears and the next sentence builds up).
 *
 * Each newly-added word fades in over 150ms via `\alpha` + `\t()` so the
 * appearance feels written, not snapped on. Older revealed words remain
 * fully opaque.
 *
 * Default font is Cambria Bold — an elegant serif designed for screen
 * reading. Pairs with the Palatino Italic fullbleed corner text (both
 * classical serifs). Override via `opts.font`.
 */
export function buildAssFromReveal(words: WordTiming[], opts: CaptionOpts = {}): string {
  const font = opts.font ?? "Cambria";
  const fontSize = opts.fontSize ?? 56;
  // 0.78 anchors caption a bit above the bottom (lower-third). Caller can
  // override (pipeline.ts auto-derives 1500/1920 ≈ 0.781 for fullbleed).
  const yPos = opts.yPosition ?? 0.78;
  // Single white color for revealed text — no active-word distinction.
  // The "draw" is the reveal itself, not a color change.
  const baseRgb = opts.baseColorRgb ?? "FFFFFF";
  const outlineRgb = opts.outlineColorRgb ?? "000000";
  const outlineWidth = opts.outlineWidth ?? 5;
  const shadowDepth = Math.max(0, opts.shadowDepth ?? 3);
  const marginL = opts.marginL ?? 80;
  const marginR = opts.marginR ?? 80;
  // Default WrapStyle 2 = no automatic wrap. `groupIntoSentences` caps each
  // chunk to fit on one line; disabling wrap prevents libass from stacking
  // overflow into a second line (which visually overlaps with default
  // leading). Caller can override back to smart-wrap (0) if needed.
  const wrapStyle = opts.wrapStyle ?? 2;

  const baseAssColor = rgbToAssBgr(baseRgb);
  const outlineAssColor = rgbToAssBgr(outlineRgb);

  const x = Math.round(PLAY_RES_X / 2);
  const y = Math.round(PLAY_RES_Y * yPos);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${PLAY_RES_X}
PlayResY: ${PLAY_RES_Y}
ScaledBorderAndShadow: yes
WrapStyle: ${wrapStyle}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${baseAssColor},${baseAssColor},${outlineAssColor},&H80000000&,1,0,0,0,100,100,0,0,1,${outlineWidth},${shadowDepth},5,${marginL},${marginR},40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const sentences = groupIntoSentences(words);
  const events: EventItem[] = [];
  const fadeMs = 150;
  for (let s = 0; s < sentences.length; s++) {
    const sent = sentences[s];
    const nextSent = sentences[s + 1];
    const nextSentStart = nextSent ? nextSent[0].start : undefined;
    for (let i = 0; i < sent.length; i++) {
      const cur = sent[i];
      const next = sent[i + 1];
      const startSec = cur.start;
      // Within a sentence: event ends at next word's start. Last word: end
      // at next sentence's first word. Very last sentence: hold +0.3s. The
      // final `clampEventOverlaps` pass guards against non-monotonic input.
      const endSec = next
        ? next.start
        : nextSentStart !== undefined
          ? nextSentStart
          : cur.end + 0.3;
      if (endSec <= startSec) continue;

      // Words already revealed before this event (0..i-1) — render at full
      // opacity, no animation. The current word (i) is the new arrival —
      // fades in from alpha FF (transparent) to 00 (opaque) over fadeMs.
      const oldWords = sent.slice(0, i).map((w) => escapeAssText(w.w)).join(" ");
      const newWord = escapeAssText(sent[i].w);
      const separator = i > 0 ? " " : "";
      // `\an5\pos(x,y)` = center the caption on (x,y). The fade override is
      // applied only to the new word.
      const text =
        `{\\an5\\pos(${x},${y})}${oldWords}${separator}` +
        `{\\alpha&HFF&\\t(0,${fadeMs},\\alpha&H00&)}${newWord}`;
      events.push({ startSec, endSec, text });
    }
  }

  return header + serializeEvents(events) + "\n";
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
  // Wrap default `2` (no wrap) — chunks are already capped to ≤4 words and
  // ~22 chars by `groupIntoChunks`, which fits one line at default font size.
  // Disabling wrap prevents libass from creating a second line that visually
  // overlaps the first (default leading is too tight for the active outline).
  const wrapStyle = opts.wrapStyle ?? 2;
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
  const events: EventItem[] = [];
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
    events.push({ startSec, endSec, text });
  }

  return header + serializeEvents(events) + "\n";
}

/**
 * Group words into short 2-4 word chunks for viral-clip captions.
 *
 * - Hard break at sentence-terminal punctuation (`.`, `!`, `?`, `…`).
 * - Soft break at commas/semicolons when running chunk has ≥2 words.
 * - Target 2-4 words per chunk; cap at 4 words OR ~22 chars (whichever
 *   first). Char cap protects against 4-word chunks of long compound
 *   names ("Vinícius Júnior penalty Real-Madrid") wrapping to 2 lines.
 *
 * Overridable via env: PODCAST_CAPTION_MAX_CHARS (default 22 for chunks).
 */
function groupIntoChunks(words: WordTiming[]): WordTiming[][] {
  const out: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  const TARGET = 4;
  const CHAR_CAP = parseEnvInt("PODCAST_CAPTION_MAX_CHARS_CHUNKS", 22);
  for (const w of words) {
    // Pre-flush so the upcoming hard/soft punctuation doesn't trump the cap.
    const projChars = cur.length === 0
      ? w.w.length
      : cur.reduce((s, x) => s + x.w.length, 0) + cur.length + w.w.length;
    if (cur.length > 0 && (cur.length + 1 > TARGET || projChars > CHAR_CAP)) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
    const tail = w.w.replace(/[")\]'’”]+$/u, "");
    const last = tail.slice(-1);
    const isHardBreak = last === "." || last === "!" || last === "?" || last === "…";
    const isSoftBreak = (last === "," || last === ";") && cur.length >= 2;
    if (isHardBreak || isSoftBreak) {
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
 * Constraints (tightened 2026-05-24 to keep every caption on a SINGLE line —
 * multi-line wrap with libass's default leading made wrapped lines visually
 * stack/overlap on the 1080×1920 canvas):
 *   - Hard break (always splits): word ends with `.`, `!`, `?`, or `…`.
 *   - Soft break: `,` or `;` once the running chunk has ≥3 words.
 *   - Hard cap: 8 words OR ~30 chars total — whichever hits first. At
 *     Segoe UI / Cambria Bold ≥52px with 80px side margins (920px usable),
 *     ~30 chars is the safe single-line budget across both fonts.
 *
 * Caps overridable via env so the user can opt into denser captions:
 *   PODCAST_CAPTION_MAX_WORDS  (default 8)
 *   PODCAST_CAPTION_MAX_CHARS  (default 30)
 */
function groupIntoSentences(words: WordTiming[]): WordTiming[][] {
  const out: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  const HARD_CAP_WORDS = parseEnvInt("PODCAST_CAPTION_MAX_WORDS", 8);
  const HARD_CAP_CHARS = parseEnvInt("PODCAST_CAPTION_MAX_CHARS", 30);
  const SOFT_MIN = 3;
  for (const w of words) {
    // Pre-flush: if adding this word would push the chunk past either cap,
    // close the current chunk first and start a new one with `w`. This
    // ensures hard-break punctuation (".") doesn't trump the cap — e.g.
    // "Đêm nay, tôi ngồi một mình ở Riyadh." (36 chars) splits into
    // "Đêm nay, tôi ngồi một mình ở" + "Riyadh." instead of staying as one
    // wrapped chunk.
    const projChars = cur.length === 0
      ? w.w.length
      : cur.reduce((s, x) => s + x.w.length, 0) + cur.length /* spaces */ + w.w.length;
    if (cur.length > 0 && (cur.length + 1 > HARD_CAP_WORDS || projChars > HARD_CAP_CHARS)) {
      out.push(cur);
      cur = [];
    }
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
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function parseEnvInt(name: string, def: number): number {
  const v = process.env[name]?.trim();
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
