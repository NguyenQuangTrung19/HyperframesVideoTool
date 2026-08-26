import type { WordTiming } from "./align.js";

export interface RealignReport {
  /** Source word matched to a Whisper word; text identical after normalization. */
  unchanged: number;
  /** Source word matched to a Whisper word but spelling differed — source text wins. */
  replaced: number;
  /** Source word had no Whisper match — timing interpolated from neighbors. */
  inserted: number;
  /** Whisper word had no source match — dropped (likely hallucination or filler). */
  dropped: number;
  /** First N examples of replaced (Whisper → source) for user inspection. */
  replacedSamples: Array<{ whisper: string; source: string }>;
  /** First N examples of inserted source words for user inspection. */
  insertedSamples: string[];
  /** First N examples of dropped Whisper words for user inspection. */
  droppedSamples: string[];
}

/**
 * Re-label Whisper word timings with words from the source `.txt`, so the
 * burned captions always spell things exactly as the user wrote them
 * (correct Vietnamese diacritics, proper nouns, English brand names, etc.).
 *
 * Whisper transcribes the TTS audio and is allowed to mangle spelling — that's
 * acceptable because we throw away its text and keep only its timings. The
 * alignment is done via Needleman-Wunsch on a normalized form (diacritic-free,
 * lowercase, punctuation-free) so cross-form matches still pair correctly.
 *
 * Edge cases handled:
 *   - Source has digits (`"159"`) that TTS speaks as words (`"một trăm năm
 *     mươi chín"`): Whisper produces 4+ tokens, source has 1. Alignment
 *     treats this as 1-source-to-multi-whisper; the source token grabs the
 *     timing of the first matched Whisper word and the rest of Whisper's
 *     tokens for that segment are "dropped" (no caption pollution).
 *   - Whisper insertion (filler "ừ", "à"): no source match → dropped.
 *   - Source word Whisper missed: timing interpolated linearly between
 *     neighbors so caption still appears, just not perfectly synced.
 */
export function realignCaptionsToSource(
  whisperWords: WordTiming[],
  sourceText: string,
  sampleLimit = 8,
): { words: WordTiming[]; report: RealignReport } {
  const sourceTokens = tokenize(sourceText);
  const pairs = alignSequences(sourceTokens, whisperWords, (src, wh) => {
    const a = normalizeForCompare(src);
    const b = normalizeForCompare(wh.w);
    if (a === b) return 0;
    if (a === "" || b === "") return 1;
    return levenshteinRatio(a, b);
  });

  const output: WordTiming[] = [];
  const report: RealignReport = {
    unchanged: 0,
    replaced: 0,
    inserted: 0,
    dropped: 0,
    replacedSamples: [],
    insertedSamples: [],
    droppedSamples: [],
  };

  // Pending batch of inserted source words (no Whisper match). Their start/end
  // times are assigned later, once we hit the next paired anchor (or the end
  // of the array), by distributing them evenly across the gap [lastEnd,
  // nextAnchorStart]. The old behavior — giving each inserted word a minimum
  // 60ms slot greedily — caused a long unpaired run (e.g. 6 source words that
  // Whisper skipped) to overflow PAST the next anchor, producing
  // non-monotonic word timings that visually overlap in burned captions.
  let lastEnd = 0;
  const pendingInsertIndices: number[] = [];

  const flushPendingInserts = (nextAnchorStart: number): void => {
    if (pendingInsertIndices.length === 0) return;
    const gap = Math.max(0, nextAnchorStart - lastEnd);
    // Per-word slot: 80ms is the comfortable target. Compress if the available
    // gap can't fit `count * 80ms`. Floor of 1ms keeps every inserted word
    // captionable even when the gap is effectively zero (the caption-side
    // overlap dedupe will then collapse them to non-overlapping tiles).
    const idealSlot = 0.08;
    const slot = gap >= pendingInsertIndices.length * idealSlot
      ? idealSlot
      : Math.max(0.001, gap / pendingInsertIndices.length);
    let t = lastEnd;
    for (const idx of pendingInsertIndices) {
      const start = t;
      const end = Math.min(t + slot, nextAnchorStart);
      output[idx] = { w: output[idx].w, start, end };
      t = end;
    }
    // Advance lastEnd to the last inserted word's end so the NEXT anchor's
    // monotonicity is preserved going forward.
    lastEnd = Math.max(lastEnd, output[pendingInsertIndices[pendingInsertIndices.length - 1]].end);
    pendingInsertIndices.length = 0;
  };

  for (let p = 0; p < pairs.length; p++) {
    const { source, whisper } = pairs[p];
    if (source !== null && whisper !== null) {
      // Hit a paired anchor — flush any pending insert batch first so its
      // timings tile cleanly into [lastEnd, whisper.start].
      flushPendingInserts(whisper.start);
      const same = normalizeForCompare(source) === normalizeForCompare(whisper.w);
      output.push({ w: source, start: whisper.start, end: whisper.end });
      lastEnd = whisper.end;
      if (same) {
        report.unchanged++;
      } else {
        report.replaced++;
        if (report.replacedSamples.length < sampleLimit) {
          report.replacedSamples.push({ whisper: whisper.w, source });
        }
      }
    } else if (source !== null) {
      // Inserted source word — push placeholder, defer timing to flush.
      output.push({ w: source, start: lastEnd, end: lastEnd });
      pendingInsertIndices.push(output.length - 1);
      report.inserted++;
      if (report.insertedSamples.length < sampleLimit) {
        report.insertedSamples.push(source);
      }
    } else if (whisper !== null) {
      // Whisper hallucination / filler — drop it. Don't advance lastEnd
      // (would skip valid timing for any pending or future inserted words).
      lastEnd = Math.max(lastEnd, whisper.end);
      report.dropped++;
      if (report.droppedSamples.length < sampleLimit) {
        report.droppedSamples.push(whisper.w);
      }
    }
  }
  // End-of-array: any trailing inserted batch (no next anchor) gets a
  // fixed 100ms tail per word so the final captions still appear.
  if (pendingInsertIndices.length > 0) {
    const TAIL_SLOT = 0.1;
    let t = lastEnd;
    for (const idx of pendingInsertIndices) {
      output[idx] = { w: output[idx].w, start: t, end: t + TAIL_SLOT };
      t += TAIL_SLOT;
    }
    pendingInsertIndices.length = 0;
  }

  return { words: output, report };
}

/**
 * Tokenize a paragraph of Vietnamese / mixed-language prose into word tokens
 * suitable for caption rendering. We split on whitespace and keep the token
 * as the user wrote it (preserving punctuation that should appear on screen
 * like "," and "." trailing the word, e.g. `"Casemiro,"`).
 *
 * Standalone punctuation runs (em dash, ellipsis, quotation marks not glued
 * to a word) are skipped so they don't get their own caption event.
 */
function tokenize(text: string): string[] {
  const cleaned = text.replace(/[“”‘’]/g, '"'); // smart quotes → ASCII
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  return tokens.filter((t) => /[\p{L}\p{N}]/u.test(t)); // must contain at least one letter/number
}

/**
 * Normalize a token for cross-form comparison: lowercase, strip Vietnamese
 * diacritics + `đ`, strip all punctuation. Result is a bare letter/number
 * string suitable for Levenshtein.
 */
function normalizeForCompare(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Edit-distance ratio in [0, 1]. 0 = identical, 1 = completely different.
 * Used as the substitution cost in Needleman-Wunsch so near-matches are
 * preferred over outright gaps.
 */
function levenshteinRatio(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return 0;
  if (n === 0 || m === 0) return 1;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[n][m] / Math.max(n, m);
}

/**
 * Needleman-Wunsch sequence alignment with a configurable substitution cost.
 * Gap penalty fixed at 1.0; substitution cost from caller in [0, 1].
 *
 * Returns the full alignment as a list of pairs — each entry has either both
 * source/whisper (a match), or one side null (insertion or deletion).
 */
function alignSequences<S, W>(
  source: S[],
  whisper: W[],
  cost: (s: S, w: W) => number,
): Array<{ source: S | null; whisper: W | null }> {
  const n = source.length;
  const m = whisper.length;
  const GAP = 1.0;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i * GAP;
  for (let j = 0; j <= m; j++) dp[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + cost(source[i - 1], whisper[j - 1]);
      const del = dp[i - 1][j] + GAP;
      const ins = dp[i][j - 1] + GAP;
      dp[i][j] = Math.min(sub, del, ins);
    }
  }

  const pairs: Array<{ source: S | null; whisper: W | null }> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sub = dp[i - 1][j - 1] + cost(source[i - 1], whisper[j - 1]);
      if (Math.abs(dp[i][j] - sub) < 1e-9) {
        pairs.push({ source: source[i - 1], whisper: whisper[j - 1] });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + GAP)) < 1e-9) {
      pairs.push({ source: source[i - 1], whisper: null });
      i--;
    } else {
      pairs.push({ source: null, whisper: whisper[j - 1] });
      j--;
    }
  }
  return pairs.reverse();
}
