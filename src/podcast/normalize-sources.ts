/**
 * Auto-normalize sibling videos so the concat demuxer downstream sees
 * identical stream parameters across the whole chain.
 *
 * Why: the podcast pipeline concatenates `<slug>.mp4`, `<slug>2.mp4`, … via
 * ffmpeg's concat demuxer, which does NOT transcode — any mismatch in
 * width/height/fps/codec/pix_fmt across files produces silent garbage
 * (black frames on the off-spec segment). See
 * `memory/feedback_podcast_concat_demuxer_bug` for the failure mode that
 * triggered this module.
 *
 * Strategy:
 *   1. Probe every sibling video (width / height / fps / pix_fmt / codec).
 *   2. Pick the FIRST video as the canonical "reference format" — that's
 *      whatever the user named `<slug>.mp4`, which is also what the rest of
 *      the channel's pacing/look is set up against.
 *   3. For every other video, compare against the reference. If any axis
 *      differs (resolution / fps / pix_fmt / codec), re-encode it to
 *      `<inputDir>/.normalized/<orig-name>` matching the reference format.
 *      The normalized files use COVER-style scaling
 *      (`force_original_aspect_ratio=increase` + center `crop`) so the
 *      frame is FILLED — same behavior as the downstream 880×880 card fit,
 *      so off-aspect siblings look identical in framing to the reference
 *      (no visible black bars / "shrunken" segments). Letterbox would
 *      preserve every pixel of original content but produces visibly
 *      smaller segments in the final clip; cover-crop trims wide/tall
 *      edges to match the channel's primary footage framing.
 *   4. Cache: when a normalized file already exists AND its mtime is newer
 *      than the original, reuse without re-encoding. Cheap re-runs.
 *
 * Returns the path each sibling should be fed to the concat step under —
 * either the original (already matched) or its `.normalized/` clone.
 */
import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { probeVideo, type ProbeResult } from "./video-compose.js";
import { log } from "../utils/logger.js";

const NORMALIZED_DIRNAME = ".normalized";
/** Tolerance for floating-point fps comparison (30 vs 29.97 should count as a match-up target — but we still want to detect 25 vs 30). */
const FPS_EPSILON = 0.5;

export interface NormalizeOpts {
  /** When false, skip normalization entirely (just probe + warn). Default true. */
  enabled?: boolean;
  /** libx264 CRF used when re-encoding off-spec siblings. Default 18 (visually lossless for 720p). */
  crf?: number;
  /** libx264 preset used when re-encoding. Default "medium". */
  preset?: string;
}

export interface NormalizeReport {
  /** The path each sibling video should be loaded from in the concat step. */
  resolvedPaths: string[];
  /** The reference format chosen (first video's params). */
  reference: ProbeResult;
  /** Map of original path → normalized path for the ones that were re-encoded. */
  normalized: Array<{ original: string; normalized: string; reason: string }>;
  /** Map of original path → normalized path that was reused from cache. */
  cached: Array<{ original: string; normalized: string }>;
}

export async function normalizeSiblingVideos(
  sourceVideoPaths: string[],
  inputDir: string,
  opts: NormalizeOpts = {},
): Promise<NormalizeReport> {
  if (sourceVideoPaths.length === 0) {
    throw new Error("normalizeSiblingVideos called with empty source list");
  }
  const enabled = opts.enabled !== false;
  const crf = opts.crf ?? 18;
  const preset = opts.preset ?? "medium";

  // Probe everyone first so we can decide.
  const probes: Array<{ path: string; probe: ProbeResult }> = [];
  for (const p of sourceVideoPaths) {
    probes.push({ path: p, probe: await probeVideo(p) });
  }
  const reference = probes[0].probe;

  if (!enabled) {
    // Just emit a warning if any sibling doesn't match — let the user decide.
    const mismatches = probes
      .slice(1)
      .filter(({ probe }) => describeMismatch(probe, reference) !== null);
    if (mismatches.length > 0) {
      log.warn(
        `  ${mismatches.length} sibling video(s) don't match the reference format — concat may produce black frames. Set PODCAST_AUTO_NORMALIZE=true to fix automatically.`,
      );
    }
    return {
      resolvedPaths: sourceVideoPaths,
      reference,
      normalized: [],
      cached: [],
    };
  }

  const normalizedDir = join(inputDir, NORMALIZED_DIRNAME);
  const resolvedPaths: string[] = [];
  const normalized: NormalizeReport["normalized"] = [];
  const cached: NormalizeReport["cached"] = [];

  for (const { path: origPath, probe } of probes) {
    // First video is the reference itself — always used as-is.
    if (origPath === probes[0].path) {
      resolvedPaths.push(origPath);
      continue;
    }
    const mismatch = describeMismatch(probe, reference);
    if (!mismatch) {
      // Already matches the reference. Use the original.
      resolvedPaths.push(origPath);
      continue;
    }

    // Need to re-encode. Cache: skip work if normalized file is newer than original.
    await mkdir(normalizedDir, { recursive: true });
    const normPath = join(normalizedDir, basename(origPath));
    if (isCacheFresh(normPath, origPath)) {
      log.info(`  REUSE normalized: ${basename(origPath)} (cached)`);
      cached.push({ original: origPath, normalized: normPath });
      resolvedPaths.push(normPath);
      continue;
    }

    log.info(`  NORMALIZE: ${basename(origPath)} — ${mismatch} → ${reference.width}x${reference.height}@${formatFps(reference.fps)}`);
    await reencodeToReference(origPath, normPath, reference, { crf, preset });
    normalized.push({ original: origPath, normalized: normPath, reason: mismatch });
    resolvedPaths.push(normPath);
  }

  return { resolvedPaths, reference, normalized, cached };
}

/**
 * Returns a short human-readable reason string when `probe` doesn't match
 * `ref`, or null when they match (= safe to concat without re-encoding).
 */
function describeMismatch(probe: ProbeResult, ref: ProbeResult): string | null {
  const reasons: string[] = [];
  if (probe.width !== ref.width || probe.height !== ref.height) {
    reasons.push(`${probe.width}x${probe.height} vs ref ${ref.width}x${ref.height}`);
  }
  if (Math.abs(probe.fps - ref.fps) > FPS_EPSILON) {
    reasons.push(`${formatFps(probe.fps)}fps vs ref ${formatFps(ref.fps)}fps`);
  }
  if (probe.pixFmt && ref.pixFmt && probe.pixFmt !== ref.pixFmt) {
    reasons.push(`pix_fmt ${probe.pixFmt} vs ref ${ref.pixFmt}`);
  }
  if (probe.codec && ref.codec && probe.codec !== ref.codec) {
    reasons.push(`codec ${probe.codec} vs ref ${ref.codec}`);
  }
  return reasons.length ? reasons.join(", ") : null;
}

function formatFps(fps: number): string {
  // 30.000 → "30", 29.97 → "29.97"
  return Number.isInteger(fps) ? String(fps) : fps.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isCacheFresh(normPath: string, origPath: string): boolean {
  if (!existsSync(normPath)) return false;
  try {
    const normStat = statSync(normPath);
    const origStat = statSync(origPath);
    return normStat.mtimeMs >= origStat.mtimeMs;
  } catch {
    return false;
  }
}

/**
 * Re-encode `srcPath` to `destPath` using the reference format's
 * width/height/fps. Uses `scale + center-crop` (cover) so the destination
 * frame is FILLED — matching the downstream 880×880 card's `cover` fit.
 * Off-aspect sources lose some edge content (wide footage gets sides
 * cropped, tall footage gets top+bottom cropped), but the resulting clip
 * looks visually consistent with the reference video instead of showing
 * up as a smaller letterboxed segment in the final output. Encodes to
 * libx264 yuv420p + AAC 128k — a universally compatible baseline that
 * concat demuxer is happy with.
 *
 * Override anchor with PODCAST_NORMALIZE_CROP_ANCHOR=top|center|bottom
 * (default `center`). Top/bottom are useful when the visually important
 * content sits in the upper/lower portion (e.g. talking-head footage with
 * a top-anchored speaker).
 */
async function reencodeToReference(
  srcPath: string,
  destPath: string,
  ref: ProbeResult,
  opts: { crf: number; preset: string },
): Promise<void> {
  const targetFps = ref.fps > 0 ? formatFps(ref.fps) : "30";
  const anchor = (process.env.PODCAST_NORMALIZE_CROP_ANCHOR?.trim().toLowerCase() || "center") as
    | "top"
    | "center"
    | "bottom";
  // crop x/y expressions: x always centers horizontally; y depends on anchor.
  const cropY =
    anchor === "top" ? "0" :
    anchor === "bottom" ? "ih-${h}" :
    "(ih-${h})/2";
  // Use ffmpeg variable substitution inside the crop expr — `ow`/`oh` would
  // refer to crop output, we want input-frame height (ih) minus output height.
  const cropExpr = `crop=${ref.width}:${ref.height}:(iw-${ref.width})/2:${cropY.replace(/\$\{h\}/g, String(ref.height))}`;
  const vf = [
    `scale=w=${ref.width}:h=${ref.height}:force_original_aspect_ratio=increase`,
    cropExpr,
    `setsar=1`,
    `fps=${targetFps}`,
  ].join(",");

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", srcPath,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", opts.preset,
      "-crf", String(opts.crf),
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      destPath,
    ];
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed normalizing ${basename(srcPath)} (exit ${code}): ${stderr}`));
    });
  });
}
