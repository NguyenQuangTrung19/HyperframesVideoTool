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
import { mkdir, readdir, rename, rm, utimes } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  /**
   * libx264 CRF used when re-encoding. Default 16 — these clones are an
   * INTERMEDIATE that the compose step re-encodes anyway, so we buy quality
   * headroom cheaply rather than optimising their file size.
   */
  crf?: number;
  /**
   * libx264 preset used when re-encoding. Default "veryfast" — see the crf
   * note: minutes/file on `medium` buy nothing downstream, and normalize is
   * the single biggest wall-clock cost of a many-clip row.
   */
  preset?: string;
  /**
   * Directory holding the content-addressed clones. Defaults to
   * `<inputDir>/.normalized` (per-run). The podcast pipeline passes a SHARED
   * dir (`podcast/_normcache`) so a clip normalized for one story is reused by
   * every later story that picks it.
   */
  cacheDir?: string;
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
  const crf = opts.crf ?? Number(process.env.PODCAST_NORMALIZE_CRF ?? 16);
  const preset = opts.preset ?? (process.env.PODCAST_NORMALIZE_PRESET?.trim() || "veryfast");
  const anchor = process.env.PODCAST_NORMALIZE_CROP_ANCHOR?.trim().toLowerCase() || "center";

  // Probe everyone first so we can decide.
  const probes: Array<{ path: string; probe: ProbeResult; id: string }> = [];
  for (const p of sourceVideoPaths) {
    const probe = await probeVideo(p);
    probes.push({ path: p, probe, id: sourceIdentity(p, probe) });
  }
  const reference = pickReference(probes);

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

  const legacyDir = join(inputDir, NORMALIZED_DIRNAME);
  const normalizedDir = opts.cacheDir?.trim() || legacyDir;
  const resolvedPaths: string[] = [];
  const normalized: NormalizeReport["normalized"] = [];
  const cached: NormalizeReport["cached"] = [];

  // Single source → no concat downstream → nothing to normalize.
  if (probes.length === 1) {
    return { resolvedPaths: sourceVideoPaths, reference, normalized: [], cached: [] };
  }

  // ≥2 sources: re-encode EVERY file (kể cả file reference đầu tiên).
  // Spec (resolution/fps/codec/pix_fmt) khớp nhau là CHƯA đủ cho concat
  // demuxer — nó dùng H.264 extradata (SPS/PPS) của file ĐẦU cho cả chain,
  // nên file đầu raw (encoder lạ) + siblings libx264 vẫn vỡ bitstream
  // ("No start code is found / Error splitting the input into NAL units")
  // → đen từ đoạn nối (story60, 2026-06-10). Cho mọi segment đi qua cùng
  // một libx264 encode là cách duy nhất đảm bảo extradata đồng nhất.
  await mkdir(normalizedDir, { recursive: true });
  let idx = 0;
  for (const { path: origPath, probe, id } of probes) {
    idx++;
    const reason =
      describeMismatch(probe, reference) ?? "đồng nhất encoder/extradata cho concat demuxer";

    // CONTENT-ADDRESSED name: hash(source identity + reference spec + encoder
    // settings). Deliberately NOT the staged basename — podcast-queue stages
    // its random picks into positional names (`<slug>.mp4`, `<slug>2.mp4`, …),
    // so a re-pick puts a DIFFERENT clip behind the same name and a
    // basename-keyed cache misses on every clip on every retry (story156,
    // 2026-08-20: 3 attempts x 16 clips re-encoded, never reached TTS).
    const normPath = join(normalizedDir, `${cacheKey(id, reference, { crf, preset, anchor })}.mp4`);

    // One-time migration: adopt a still-valid clone left by the old
    // basename-keyed scheme instead of re-encoding it.
    const legacyPath = join(legacyDir, basename(origPath));
    if (legacyPath !== normPath && !existsSync(normPath) && existsSync(legacyPath)) {
      if (await isCacheValid(legacyPath, probe, reference)) {
        try {
          await rename(legacyPath, normPath);
          log.info(`  ADOPT cached clone: ${basename(origPath)} → ${basename(normPath)}`);
        } catch { /* fall through to a normal re-encode */ }
      }
    }

    if (await isCacheValid(normPath, probe, reference)) {
      log.info(`  [${idx}/${probes.length}] REUSE normalized: ${basename(origPath)} (cache ${basename(normPath)})`);
      await utimes(normPath, new Date(), new Date()).catch(() => {}); // LRU touch
      cached.push({ original: origPath, normalized: normPath });
      resolvedPaths.push(normPath);
      continue;
    }

    log.info(`  [${idx}/${probes.length}] NORMALIZE: ${basename(origPath)} — ${reason} → ${reference.width}x${reference.height}@${formatFps(reference.fps)} (crf${crf}/${preset})`);
    await reencodeToReference(origPath, normPath, reference, { crf, preset });
    normalized.push({ original: origPath, normalized: normPath, reason });
    resolvedPaths.push(normPath);
  }

  await pruneCache(normalizedDir);
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

/**
 * Cache validity. The filename hash already pins WHICH source and WHICH
 * reference/encoder settings produced this clone, so the mtime comparison is
 * gone — it was the old scheme's weak point: podcast-queue hardlinks its
 * sources, so a staged file carries the library file's old mtime and any stale
 * clone looked "newer than the original" forever.
 *
 * What is still checked is that the file on disk is a COMPLETE, correct clone.
 * `reencodeToReference` writes to a `.part.mp4` and renames on success, so a
 * killed run can no longer leave a truncated file under a valid cache name;
 * this is belt-and-braces for files predating that change.
 */
async function isCacheValid(normPath: string, origProbe: ProbeResult, ref: ProbeResult): Promise<boolean> {
  if (!existsSync(normPath)) return false;
  try {
    if (statSync(normPath).size === 0) return false;
  } catch {
    return false;
  }
  try {
    const norm = await probeVideo(normPath);
    if (describeMismatch(norm, ref) !== null) return false;
    return Math.abs(norm.durationSec - origProbe.durationSec) <= Math.max(1, origProbe.durationSec * 0.05);
  } catch {
    return false;
  }
}

/**
 * Stable identity for a source clip. Hardlink-safe: podcast-queue stages via
 * `link()`, so size/mtime are the LIBRARY file's and stay identical no matter
 * which positional name the clip was staged under. Duration + stream spec are
 * folded in so two different files can't collide on size+mtime alone.
 */
function sourceIdentity(path: string, probe: ProbeResult): string {
  let size = 0;
  let mtime = 0;
  try {
    const st = statSync(path);
    size = st.size;
    mtime = Math.round(st.mtimeMs);
  } catch { /* fall back to the probe facts alone */ }
  return [
    size,
    mtime,
    probe.durationSec.toFixed(3),
    `${probe.width}x${probe.height}`,
    formatFps(probe.fps),
    probe.codec ?? "",
    probe.pixFmt ?? "",
  ].join(":");
}

function cacheKey(srcId: string, ref: ProbeResult, enc: { crf: number; preset: string; anchor: string }): string {
  const refSpec = `${ref.width}x${ref.height}@${formatFps(ref.fps)}:${ref.pixFmt ?? ""}`;
  const encSpec = `x264:crf${enc.crf}:${enc.preset}:${enc.anchor}`;
  return createHash("sha1").update(`v1|${srcId}|${refSpec}|${encSpec}`).digest("hex").slice(0, 16);
}

/**
 * Reference format = the spec the MAJORITY of the sources already have, not
 * "whatever got staged as `<slug>.mp4`". With a random picker "first" is
 * arbitrary: a re-pick that promotes a 23fps clip to position 0 would force
 * every other clip to be re-encoded to 23fps and invalidate the whole cache.
 * Modal is order-independent, so re-picks from the same library keep hitting
 * cache — and it minimises how many clips need touching at all. Tie-break on
 * the lowest source identity so the choice is deterministic.
 * `PODCAST_NORMALIZE_REF=first` restores the old behaviour.
 */
function pickReference(probes: Array<{ probe: ProbeResult; id: string }>): ProbeResult {
  if ((process.env.PODCAST_NORMALIZE_REF?.trim().toLowerCase() || "modal") === "first") {
    return probes[0].probe;
  }
  const groups = new Map<string, { probe: ProbeResult; count: number; minId: string }>();
  for (const { probe, id } of probes) {
    const snapped: ProbeResult = { ...probe, fps: snapFps(probe.fps) };
    const spec = `${snapped.width}x${snapped.height}@${formatFps(snapped.fps)}:${snapped.pixFmt ?? ""}`;
    const g = groups.get(spec);
    if (!g) groups.set(spec, { probe: snapped, count: 1, minId: id });
    else {
      g.count++;
      if (id < g.minId) g.minId = id;
    }
  }
  const ranked = [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.probe.width * b.probe.height - a.probe.width * a.probe.height ||
      (a.minId < b.minId ? -1 : 1),
  );
  return ranked[0].probe;
}

/** Frame rates worth targeting. Anything else is stock footage noise. */
const FPS_LADDER = [24, 25, 30, 50, 60];

/**
 * Snap a probed frame rate onto the standard ladder when it is within 10%.
 * Stock b-roll libraries are full of 28.83 / 29.97 / 23.4 fps files, and
 * without this the reference fps — and therefore the whole clone cache — moves
 * every time the picker happens to draw a different mix (test pass 3, 2026-08-21:
 * a 2-clip subset flipped the reference 30 → 29.97 and missed cache on both).
 * Retiming is free here: the compose step throws the source audio away and
 * muxes the TTS voice, so there is no A/V sync to preserve.
 */
function snapFps(fps: number): number {
  if (!(fps > 0)) return 30;
  let best = fps;
  let bestDelta = Infinity;
  for (const cand of FPS_LADDER) {
    const delta = Math.abs(cand - fps);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = cand;
    }
  }
  return bestDelta <= fps * 0.1 ? best : Math.round(fps * 100) / 100;
}

/**
 * Keep the shared clone cache from growing without bound. Evicts the
 * least-recently-USED entries (every cache hit touches its file) until the dir
 * is back under the cap. Entries are pure derived data — regenerating one costs
 * a single ffmpeg run. `PODCAST_NORMCACHE_MAX_GB=0` disables eviction.
 */
async function pruneCache(dir: string): Promise<void> {
  const capGb = Number(process.env.PODCAST_NORMCACHE_MAX_GB ?? 20);
  if (!Number.isFinite(capGb) || capGb <= 0) return;
  const capBytes = capGb * 1024 ** 3;
  let entries: Array<{ path: string; size: number; mtimeMs: number }>;
  try {
    const names = await readdir(dir);
    entries = names
      .filter((n) => n.endsWith(".mp4"))
      .map((n) => {
        const path = join(dir, n);
        const st = statSync(path);
        return { path, size: st.size, mtimeMs: st.mtimeMs };
      });
  } catch {
    return;
  }
  let total = entries.reduce((sum, e) => sum + e.size, 0);
  if (total <= capBytes) return;
  entries.sort((a, b) => a.mtimeMs - b.mtimeMs); // least-recently-touched first
  let evicted = 0;
  for (const e of entries) {
    if (total <= capBytes) break;
    try {
      await rm(e.path);
      total -= e.size;
      evicted++;
    } catch { /* in use by a concurrent run — skip */ }
  }
  if (evicted > 0) {
    log.info(`  normalize cache: evicted ${evicted} clone(s) LRU → ${(total / 1024 ** 3).toFixed(2)} GB / ${capGb} GB cap`);
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
  // Encode to a sidecar and rename only on success, so a killed run can never
  // leave a truncated file sitting under a valid-looking cache name.
  const partPath = `${destPath}.part.mp4`;
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
      partPath,
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

  await rename(partPath, destPath);
}
