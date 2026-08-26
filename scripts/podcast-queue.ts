#!/usr/bin/env tsx
/**
 * Podcast queue processor.
 *
 * Reads `podcast/input/queue.xlsx`, processes every row where `story` is set
 * and `status` is empty:
 *   1. Resolve the story .txt path.
 *   2. Pick a concept (column `concept`: any folder name directly under
 *      `podcast/input/` containing videos, OR `random`/empty → uniform pick
 *      across non-empty concept folders).
 *   3. Randomly pick 1–3 videos from the concept folder so cumulative
 *      duration ≥ estimated TTS duration. Probe each via ffprobe.
 *   4. Materialize a workdir at `podcast/_runs/<slug>/` with the .txt
 *      copied as `<slug>.txt` and each picked video copied/hardlinked as
 *      `<slug>.mp4`, `<slug>2.mp4`, `<slug>3.mp4`.
 *   5. Run the podcast pipeline against the workdir.
 *   6. Verify output at `podcast/output/<slug>/<slug>.mp4`.
 *   7. Update the row: `videos` (paths joined by `;`), `status` (Done | Error),
 *      `result` (output path or error message).
 *
 * The Excel file is saved after each row so a crash mid-run preserves progress.
 *
 * Folder structure:
 *   podcast/
 *     input/        ← user-supplied data
 *       <concept>/  ← any folder name = concept (vd `naruto/`, `world/`, `neymar/`)
 *       story/      ← podcast script .txt files (reserved name)
 *       queue.xlsx
 *     _runs/        ← per-row workdirs (pipeline-managed)
 *     output/       ← finished podcast clips
 *
 * Concept model (flattened 2026-05-25): the previous nested concepts
 * (`football/<player>`, `anime/<series>`) were removed in favor of flat
 * top-level folders. Users now create whatever concept folders they want.
 */
import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { copyFile, link } from "node:fs/promises";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";
import { spawn } from "node:child_process";
import { probeVideo } from "../src/podcast/video-compose.js";

const REPO_ROOT = resolvePath(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
// Layout refactored 2026-05-24: previously everything lived under
// `input/podcasts/`, which awkwardly put `input/podcasts/output/` inside an
// input folder. Now podcast/ is its own type-major tree.
const PODCAST_BASE = join(REPO_ROOT, "podcast");
const PODCAST_ROOT = join(PODCAST_BASE, "input"); // libraries + queue.xlsx + story/
const QUEUE_XLSX = join(PODCAST_ROOT, "queue.xlsx");
const RUNS_DIR = join(PODCAST_BASE, "_runs"); // workdirs sit OUTSIDE input/
const OUTPUT_DIR = join(PODCAST_BASE, "output");

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

/**
 * Concept model (flattened 2026-05-25):
 *   - Concept = any folder directly under `podcast/input/` containing playable videos.
 *   - No more nested concepts (the previous `football/<player>` / `anime/<series>`
 *     syntax was scrapped — users now create flat top-level folders like
 *     `podcast/input/neymar/` or `podcast/input/naruto/` and pass `concept=neymar`).
 *   - Folder name IS the concept name. Anything goes (whatever folder the user
 *     creates), with the reserved names below excluded.
 */
const RESERVED_FOLDER_NAMES = new Set([
  "story", // .txt scripts live here, not videos
]);

interface ParsedConcept {
  name: string;
}

// Rough Vietnamese TTS reading rate: ~13 chars/sec at speed 1.0 (incl. spaces).
// Bias slightly conservative (lower chars/sec → higher estimated duration → pick more video).
const CHARS_PER_SEC = 12;
const DURATION_SAFETY = 1.1;
// Safety upper bound on clips per row to prevent runaway when TTS estimate is
// wildly off or library has thousands of tiny clips. Way above any realistic
// podcast needs (~5-10 clips for a typical 60-120s script). When the picker hits
// this cap it warns; the row still proceeds and the pipeline loops the chain.
const MAX_VIDEOS_PER_ROW = 50;
// Default tail buffer (seconds) added to the target video duration so the picker
// covers voice + a breathing tail. Reads PODCAST_TAIL_SEC so it stays in sync
// with what the pipeline actually renders. .env.local typically sets 10.
const DEFAULT_TAIL_SEC = 10;

interface Row {
  story?: string;
  concept?: string;
  /** Orientation: "landscape" | "portrait" | "" (=auto). Empty/auto = let pipeline ffprobe-detect. */
  orientation?: string;
  videos?: string;
  status?: string;
  result?: string;
  rowNumber: number;
}

type OrientationFilter = "landscape" | "portrait" | null;

function parseOrientation(raw: string | undefined): OrientationFilter {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "landscape" || v === "horizontal" || v === "16:9") return "landscape";
  if (v === "portrait" || v === "vertical" || v === "9:16") return "portrait";
  return null;
}

/**
 * Parse the `videos` column as a list of manual video paths. Accepts `;`,
 * `,`, or newline as separators (the script's own output uses `;` so a
 * round-tripped value parses back identically). Empty result = no manual
 * override, fall back to the random picker.
 */
function parseManualVideos(raw: string | undefined): string[] {
  const v = (raw ?? "").trim();
  if (!v) return [];
  return v.split(/[;,\n]+/).map((s) => s.trim()).filter(Boolean);
}

interface ProcessResult {
  status: "Done" | "Error";
  videos: string;
  result: string;
}

/** List concept folder names: every directory directly under `podcast/input/`
 *  that isn't a reserved name (`story/`) or hidden (starts with `.` / `_`).
 *  Folder name = concept name. */
function listConcepts(): string[] {
  if (!existsSync(PODCAST_ROOT)) return [];
  return readdirSync(PODCAST_ROOT).filter((name) => {
    if (RESERVED_FOLDER_NAMES.has(name.toLowerCase())) return false;
    if (name.startsWith(".") || name.startsWith("_")) return false;
    try {
      return statSync(join(PODCAST_ROOT, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * Parse the `concept` column. Returns either a {name} or an {error} with a
 * user-facing Vietnamese message. The flat-concept model (2026-05-25):
 *   - `<folder-name>` → looks up `podcast/input/<folder-name>/`. Folder name
 *     IS the concept; anything goes (the user creates whatever folders they
 *     want and references them by name).
 *   - empty / `random` → uniform pick across concept folders that have ≥1
 *     playable video.
 *   - `<a>/<b>` (legacy nested syntax) → Error with migration hint: flatten
 *     to a single folder name.
 *   - `views` / `nature` (legacy) → Error with migration hint.
 */
function parseConcept(raw: string | undefined): ParsedConcept | { error: string } {
  const v = (raw ?? "").trim().toLowerCase().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

  if (!v || v === "random") {
    const nonEmpty = listConcepts().filter((c) => listVideos(join(PODCAST_ROOT, c)).length > 0);
    if (nonEmpty.length === 0) {
      return { error: "không có concept folder nào trong podcast/input/ có video" };
    }
    return { name: nonEmpty[Math.floor(Math.random() * nonEmpty.length)] };
  }

  if (v === "views" || v === "nature") {
    return { error: `concept '${v}' đã bị bỏ — chuyển video sang folder concept mới (vd 'world') và dùng tên folder đó` };
  }

  if (v.includes("/")) {
    return {
      error: `concept '${raw}' không hỗ trợ nested subfolder nữa — flatten thành tên folder duy nhất (vd 'naruto' thay vì 'anime/naruto', đặt video vào podcast/input/naruto/)`,
    };
  }

  if (RESERVED_FOLDER_NAMES.has(v) || v.startsWith(".") || v.startsWith("_")) {
    return { error: `concept '${v}' là reserved folder name — chọn tên khác` };
  }

  const folder = join(PODCAST_ROOT, v);
  if (!existsSync(folder)) {
    const available = listConcepts();
    return {
      error: `concept '${v}' không tồn tại — tạo folder podcast/input/${v}/ và bỏ video vào. Folder hiện có: ${available.join(", ") || "(rỗng)"}`,
    };
  }
  try {
    if (!statSync(folder).isDirectory()) {
      return { error: `'podcast/input/${v}' tồn tại nhưng không phải folder` };
    }
  } catch {
    return { error: `không đọc được podcast/input/${v}` };
  }
  return { name: v };
}

function listVideos(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((f) => VIDEO_EXTS.has(extname(f).toLowerCase()))
    .filter((f) => {
      try {
        return statSync(join(folder, f)).isFile();
      } catch {
        return false;
      }
    })
    .map((f) => join(folder, f));
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function pickVideosForDuration(
  folder: string,
  targetSec: number,
  orientationFilter: OrientationFilter,
  usedSet: Set<string>,
): Promise<string[]> {
  const all = listVideos(folder);
  if (all.length === 0) throw new Error(`Không có video .mp4/.mov/.webm/.mkv/.m4v trong ${folder}`);

  // Pass 1: try strict no-repeat (skip anything in usedSet). Pass 2 only fires
  // when pass 1 exhausts the candidate pool without filling targetSec — at
  // that point we allow reuse with a warning, since refusing to pick any
  // video would fail the row outright. This lets a small library still cover
  // a large batch (videos start repeating once the unique pool runs out).
  const attempt = async (allowReuse: boolean): Promise<string[]> => {
    const shuffled = shuffle(all);
    const picked: string[] = [];
    let cumDur = 0;
    let skippedOrient = 0;
    let skippedUsed = 0;
    for (const path of shuffled) {
      if (picked.length >= MAX_VIDEOS_PER_ROW) {
        console.warn(`  ⚠ hit safety cap ${MAX_VIDEOS_PER_ROW} clips — picker dừng dù chưa đủ targetSec (pipeline sẽ loop chain)`);
        break;
      }
      if (!allowReuse && usedSet.has(path)) { skippedUsed++; continue; }
      let dur = 0;
      let isLandscape = false;
      try {
        const probe = await probeVideo(path);
        dur = probe.durationSec;
        isLandscape = probe.width > probe.height;
      } catch (e) {
        console.warn(`  ⚠ ffprobe lỗi trên ${basename(path)}: ${(e as Error).message}`);
        continue;
      }
      if (orientationFilter === "landscape" && !isLandscape) { skippedOrient++; continue; }
      if (orientationFilter === "portrait" && isLandscape) { skippedOrient++; continue; }
      picked.push(path);
      cumDur += dur;
      if (cumDur >= targetSec) break;
    }
    if (picked.length === 0 && !allowReuse) {
      // Caller may retry with reuse. Surface stats for the log.
      console.warn(`  ⚠ no-repeat pool cạn (đã probe ${shuffled.length}, skip ${skippedUsed} đã dùng, ${skippedOrient} sai orientation) — cho phép re-use`);
    } else if (picked.length === 0) {
      const reason = orientationFilter
        ? `không tìm thấy video orientation=${orientationFilter} trong ${folder} (đã probe ${shuffled.length}, skip ${skippedOrient} sai orientation)`
        : `Không probe được video nào trong ${folder}`;
      throw new Error(reason);
    }
    return picked;
  };

  let result = await attempt(false);
  if (result.length === 0) result = await attempt(true);
  return result;
}

async function linkOrCopy(src: string, dst: string): Promise<void> {
  try {
    await link(src, dst);
  } catch {
    await copyFile(src, dst);
  }
}

function slugFromStoryPath(storyPath: string): string {
  return basename(storyPath, extname(storyPath));
}

async function materializeWorkdir(
  storyPath: string,
  slug: string,
  videoPaths: string[],
): Promise<{ workdir: string; txtInWorkdir: string }> {
  const workdir = join(RUNS_DIR, slug);
  mkdirSync(workdir, { recursive: true });

  const txtInWorkdir = join(workdir, `${slug}.txt`);
  if (existsSync(txtInWorkdir)) {
    // Stale workdir from previous attempt — overwrite by removing + recopying.
    // Use copy (not link) so edits to the staged copy don't echo back to /story.
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(txtInWorkdir);
    } catch {
      /* ignore */
    }
  }
  await copyFile(storyPath, txtInWorkdir);

  for (let i = 0; i < videoPaths.length; i++) {
    const src = videoPaths[i];
    const ext = extname(src);
    const dstName = i === 0 ? `${slug}${ext}` : `${slug}${i + 1}${ext}`;
    const dst = join(workdir, dstName);
    if (existsSync(dst)) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(dst);
      } catch {
        /* ignore */
      }
    }
    await linkOrCopy(src, dst);
  }

  return { workdir, txtInWorkdir };
}

function runPodcastPipeline(txtPath: string, orientation: OrientationFilter, locket: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    // Pass orientation through to the pipeline via PODCAST_LAYOUT_MODE so the
    // composeVideo picks the right layout (landscape vs portrait) regardless
    // of what ffprobe would auto-detect.
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (locket) {
      // Locket mode: square video with padded margins, caption inside card.
      env.PODCAST_LAYOUT_MODE = "locket";
    } else if (orientation === "landscape") {
      env.PODCAST_LAYOUT_MODE = "landscape";
    } else if (orientation === "portrait") {
      env.PODCAST_LAYOUT_MODE = "portrait";
    }
    // null (auto) → leave env unset; pipeline default `auto` ffprobe-detects.
    const proc = spawn("npm", ["run", "podcast", "--", txtPath], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      // Podcast pipeline historically returns non-zero even on success (exit 69 etc).
      // So the exit code can NOT gate success — the file probe downstream does.
      // But it must not be thrown away either: without it a crashed/killed run
      // is indistinguishable from a clean run that produced nothing, and the
      // row's `result` ends up claiming "pipeline xong" about a process that
      // died (story156, 2026-08-20). Hand it to the caller for the message.
      // See memory/feedback_podcast_ffmpeg_exit69_benign.md
      if (code !== 0) console.warn(`  ⚠ pipeline exit code ${code} — checking output file exists`);
      resolve(code ?? -1);
    });
  });
}

async function processRow(
  row: Row,
  usedSet: Set<string>,
  locket: boolean,
  slugSeen: Map<string, number>,
): Promise<ProcessResult> {
  const storyRaw = (row.story ?? "").trim();
  if (!storyRaw) return { status: "Error", videos: "", result: "story trống" };

  const storyPath = resolvePath(REPO_ROOT, storyRaw);
  if (!existsSync(storyPath)) {
    return { status: "Error", videos: "", result: `story không tồn tại: ${storyRaw}` };
  }
  if (extname(storyPath).toLowerCase() !== ".txt") {
    return { status: "Error", videos: "", result: `story phải là .txt: ${storyRaw}` };
  }

  const slug = slugFromStoryPath(storyPath);
  // Two pending rows pointing at the SAME .txt would otherwise share
  // `_runs/<slug>/` and `output/<slug>/`: the second row's staging overwrites
  // the first's clips mid-flight and both rows fight over one output file.
  // Give every repeat its own slug so each row renders its own deliverable.
  const nth = (slugSeen.get(slug) ?? 0) + 1;
  slugSeen.set(slug, nth);
  const runSlug = nth === 1 ? slug : `${slug}-${nth}`;
  if (nth > 1) {
    console.warn(`  ⚠ row trùng story "${slug}" (lần ${nth} trong batch này) → chạy dưới slug riêng "${runSlug}"`);
  }
  const orientation = parseOrientation(row.orientation);
  const manualVideos = parseManualVideos(row.videos);

  // Manual override: when `videos` column is non-empty, treat its contents as
  // an explicit playlist (split by ; / , / newline). The random picker is
  // skipped entirely — orientation filtering and the concept folder become
  // irrelevant. Useful when the user wants to (a) re-run a row with the same
  // videos, or (b) hand-curate a specific clip combo for a story. To force a
  // fresh random pick on retry, clear BOTH the `status` AND `videos` cells.
  let videoPaths: string[];
  let concept: string;

  if (manualVideos.length > 0) {
    concept = "manual";
    const resolved: string[] = [];
    for (const p of manualVideos) {
      const abs = resolvePath(REPO_ROOT, p);
      if (!existsSync(abs)) {
        return { status: "Error", videos: row.videos ?? "", result: `manual video không tồn tại: ${p}` };
      }
      if (!VIDEO_EXTS.has(extname(abs).toLowerCase())) {
        return { status: "Error", videos: row.videos ?? "", result: `manual video sai định dạng: ${p}` };
      }
      resolved.push(abs);
    }
    videoPaths = resolved.slice(0, MAX_VIDEOS_PER_ROW);
    if (resolved.length > MAX_VIDEOS_PER_ROW) {
      console.log(`  ⚠ row có ${resolved.length} manual video, chỉ dùng ${MAX_VIDEOS_PER_ROW} đầu (safety cap)`);
    }

    // Probe each manual video for a duration check + warn (don't error) if
    // total < TTS estimate + tail. The compose step loops automatically so short
    // playlists are OK; the warning just helps the user notice mis-sized picks.
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(storyPath, "utf-8");
    const txt = raw.replace(/\s+/g, " ").trim();
    const estDurSec = Math.max(20, txt.length / CHARS_PER_SEC);
    const tailSec = parseInt(process.env.PODCAST_TAIL_SEC ?? String(DEFAULT_TAIL_SEC), 10);
    const targetSec = estDurSec * DURATION_SAFETY + tailSec;
    let totalManualDur = 0;
    for (const vp of videoPaths) {
      try {
        const probe = await probeVideo(vp);
        totalManualDur += probe.durationSec;
      } catch (e) {
        return { status: "Error", videos: row.videos ?? "", result: `probe manual video lỗi (${basename(vp)}): ${(e as Error).message}` };
      }
    }

    console.log(
      `  story=${basename(storyPath)}  slug=${slug}  MANUAL videos=${videoPaths.length}  orientation=${orientation ?? "auto"}  chars=${txt.length}  est-tts=${estDurSec.toFixed(1)}s  tail=${tailSec}s  target=${targetSec.toFixed(1)}s  total-video=${totalManualDur.toFixed(1)}s`,
    );
    if (totalManualDur < targetSec) {
      console.log(`  ℹ video sẽ loop (total ${totalManualDur.toFixed(1)}s < target ${targetSec.toFixed(1)}s)`);
    }
    console.log(`  manual videos: ${videoPaths.map((p) => basename(p)).join(", ")}`);
  } else {
    const parsed = parseConcept(row.concept);
    if ("error" in parsed) {
      return { status: "Error", videos: "", result: `concept lỗi: ${parsed.error}` };
    }
    concept = parsed.name;
    const conceptFolder = join(PODCAST_ROOT, concept);

    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(storyPath, "utf-8");
    const txt = raw.replace(/\s+/g, " ").trim();
    const estDurSec = Math.max(20, txt.length / CHARS_PER_SEC);
    // Target = TTS estimate × 1.1 (cover TTS variance) + tail buffer (breathing
    // room after voice ends). The picker keeps adding UNIQUE clips until it hits
    // this target; if the library runs out it falls back to allowing reuse, and
    // if even that's short the pipeline loops the chain at compose time.
    const tailSec = parseInt(process.env.PODCAST_TAIL_SEC ?? String(DEFAULT_TAIL_SEC), 10);
    const targetSec = estDurSec * DURATION_SAFETY + tailSec;

    console.log(
      `  story=${basename(storyPath)}  slug=${slug}  concept=${concept}  orientation=${orientation ?? "auto"}  chars=${txt.length}  est-tts=${estDurSec.toFixed(1)}s  tail=${tailSec}s  target-video=${targetSec.toFixed(1)}s`,
    );

    try {
      videoPaths = await pickVideosForDuration(conceptFolder, targetSec, orientation, usedSet);
    } catch (e) {
      return { status: "Error", videos: "", result: `pick video lỗi: ${(e as Error).message}` };
    }

    console.log(`  picked ${videoPaths.length} video(s): ${videoPaths.map((p) => basename(p)).join(", ")}`);
  }

  // Register every video used by this row (manual or auto-picked) so the next
  // row in the same batch run skips them when shuffling. Manual videos count
  // too — if the user hand-picked `clip-a.mp4`, the random picker shouldn't
  // hand it to the next row.
  for (const vp of videoPaths) usedSet.add(vp);

  let txtInWorkdir: string;
  try {
    const staged = await materializeWorkdir(storyPath, runSlug, videoPaths);
    txtInWorkdir = staged.txtInWorkdir;
  } catch (e) {
    return { status: "Error", videos: relList(videoPaths), result: `staging lỗi: ${(e as Error).message}` };
  }

  let exitCode: number;
  try {
    exitCode = await runPodcastPipeline(txtInWorkdir, orientation, locket);
  } catch (e) {
    return { status: "Error", videos: relList(videoPaths), result: `pipeline lỗi: ${(e as Error).message}` };
  }

  // Pipeline output dir resolved by resolvePodcastOutputDir() in pipeline.ts:
  // finds the `podcast/` ancestor of inputDir and outputs to `<podcast>/output/<slug>/`.
  // With workdir at podcast/_runs/<slug>/, output lands at podcast/output/<slug>/<slug>.mp4.
  const outDir = join(OUTPUT_DIR, runSlug);
  const outFile = join(outDir, `${runSlug}.mp4`);
  if (!existsSync(outFile)) {
    // Name the stage it died at from what the output dir does/doesn't hold —
    // the pipeline creates the dir before step 1's normalize, writes voice.mp3
    // in step 2, then words.json in step 3. Without this the row just said
    // "pipeline xong nhưng không thấy <file>", which reads like a clean run
    // that produced nothing when in fact the process had died (story156).
    const stage = !existsSync(outDir)
      ? "chưa tạo được thư mục output — chết ở step 1 (validate / normalize source)"
      : !existsSync(join(outDir, "voice.mp3"))
        ? "có thư mục output nhưng chưa có voice.mp3 — chết ở step 1 (normalize) hoặc step 2 (TTS)"
        : !existsSync(join(outDir, "words.json"))
          ? "có voice.mp3 nhưng chưa có words.json — chết ở step 3 (align)"
          : "có voice.mp3 + words.json nhưng không ra mp4 — chết ở step 5 (compose)";
    return {
      status: "Error",
      videos: relList(videoPaths),
      result: `pipeline exit ${exitCode} — ${stage}; không thấy ${relPath(outFile)}`,
    };
  }
  // Existence alone is NOT proof of a render: ffmpeg creates the output file up
  // front and can then die during filter-graph config, leaving a 0-byte mp4
  // behind. Since the exit code is deliberately ignored above (benign exit 69),
  // the probe is the only real signal — demand a decodable, non-empty file.
  if (statSync(outFile).size === 0) {
    return {
      status: "Error",
      videos: relList(videoPaths),
      result: `pipeline exit ${exitCode} — ${runSlug}.mp4 rỗng (0 byte), ffmpeg chết giữa chừng`,
    };
  }
  try {
    const outProbe = await probeVideo(outFile);
    if (!(outProbe.durationSec > 0)) throw new Error("duration = 0");
  } catch (e) {
    return {
      status: "Error",
      videos: relList(videoPaths),
      result: `pipeline exit ${exitCode} — ${runSlug}.mp4 không decode được: ${(e as Error).message}`,
    };
  }

  return {
    status: "Done",
    videos: relList(videoPaths),
    result: relPath(outFile),
  };
}

function relPath(abs: string): string {
  return abs.startsWith(REPO_ROOT) ? abs.slice(REPO_ROOT.length + 1).replaceAll("\\", "/") : abs;
}

function relList(paths: string[]): string {
  return paths.map(relPath).join("; ");
}

async function loadOrCreateWorkbook(): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet; created: boolean }> {
  const wb = new ExcelJS.Workbook();
  if (existsSync(QUEUE_XLSX)) {
    await wb.xlsx.readFile(QUEUE_XLSX);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error(`queue.xlsx tồn tại nhưng không có worksheet nào: ${QUEUE_XLSX}`);
    return { wb, ws, created: false };
  }
  // Create a fresh template.
  const ws = wb.addWorksheet("queue");
  ws.columns = [
    { header: "story", key: "story", width: 50 },
    { header: "concept", key: "concept", width: 12 },
    { header: "orientation", key: "orientation", width: 12 },
    { header: "videos", key: "videos", width: 60 },
    { header: "status", key: "status", width: 8 },
    { header: "result", key: "result", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  await wb.xlsx.writeFile(QUEUE_XLSX);
  console.log(`✓ tạo template ${relPath(QUEUE_XLSX)} (rỗng) — thêm row rồi chạy lại`);
  return { wb, ws, created: true };
}

function rowToObject(ws: ExcelJS.Worksheet, rowNumber: number): Row {
  const r = ws.getRow(rowNumber);
  // Build header → column-letter map from row 1 so we can read columns by their
  // header name even when the workbook was created with a different column order
  // (e.g. legacy queue.xlsx without the orientation column).
  const headerToCol: Record<string, number> = {};
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const v = cell.value;
    const text = typeof v === "string" ? v : (v != null ? String(v) : "");
    if (text) headerToCol[text.trim().toLowerCase()] = colNumber;
  });
  const cellValue = (header: string): string => {
    const colNumber = headerToCol[header.toLowerCase()];
    if (!colNumber) return "";
    const v = r.getCell(colNumber).value;
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
    return String(v);
  };
  return {
    story: cellValue("story"),
    concept: cellValue("concept"),
    orientation: cellValue("orientation"),
    videos: cellValue("videos"),
    status: cellValue("status"),
    result: cellValue("result"),
    rowNumber,
  };
}

function writeRow(ws: ExcelJS.Worksheet, row: Row, res: ProcessResult): void {
  const r = ws.getRow(row.rowNumber);
  // Look up target columns by header so we tolerate legacy queue.xlsx files
  // that pre-date the orientation column (or any future column reordering).
  const headerToCol: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, colNumber) => {
    const v = cell.value;
    const text = typeof v === "string" ? v : (v != null ? String(v) : "");
    if (text) headerToCol[text.trim().toLowerCase()] = colNumber;
  });
  const setByHeader = (header: string, value: string): void => {
    const col = headerToCol[header.toLowerCase()];
    if (!col) return;
    r.getCell(col).value = value;
  };
  setByHeader("videos", res.videos);
  setByHeader("status", res.status);
  setByHeader("result", res.result);
  r.commit();
}

async function main(): Promise<void> {
  // Ensure required folders exist. Legacy `views/` is intentionally NOT created
  // here — it was renamed/absorbed into `world/` on 2026-05-24; existing
  // views/ stays on disk for users to migrate manually.
  // Detect --locket flag: when present, ALL rows in this batch use locket
  // layout (square video with padded margins). Default (no flag) = card layout.
  const locketMode = process.argv.includes("--locket");
  if (locketMode) {
    console.log("🔲 Locket mode enabled — video sẽ crop vuông, caption bên trong card\n");
  }

  for (const d of [
    PODCAST_ROOT,
    RUNS_DIR,
    OUTPUT_DIR,
    join(PODCAST_ROOT, "story"), // reserved — script .txt files live here
    // No hardcoded concept folders: in the flat model (2026-05-25) the user
    // creates whatever concept folders they need (`podcast/input/<name>/`).
  ]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }

  const { wb, ws, created } = await loadOrCreateWorkbook();
  if (created) return;

  const lastRow = ws.actualRowCount;
  const pending: Row[] = [];
  for (let i = 2; i <= lastRow; i++) {
    const r = rowToObject(ws, i);
    if (!r.story || r.story.trim() === "") continue;
    if ((r.status ?? "").trim() !== "") continue; // skip Done/Error
    pending.push(r);
  }

  if (pending.length === 0) {
    console.log("✓ Không có row pending (story rỗng hoặc status đã set).");
    return;
  }

  console.log(`▶ Xử lý ${pending.length} row pending từ ${relPath(QUEUE_XLSX)}\n`);

  // Batch-scoped no-repeat tracker: any video used by an earlier row (either
  // hand-picked via the `videos` column or chosen by the random picker) is
  // excluded from later rows' picks during THIS invocation. Reset on every
  // fresh `npm run podcast-queue` — persistence across invocations would
  // require a cache file and isn't requested.
  const usedSet = new Set<string>();
  // story slug → how many pending rows in THIS batch already claimed it.
  const slugSeen = new Map<string, number>();

  let okCount = 0;
  let errCount = 0;
  for (const row of pending) {
    console.log(`── Row ${row.rowNumber} ─────────────`);
    let res: ProcessResult;
    try {
      res = await processRow(row, usedSet, locketMode, slugSeen);
    } catch (e) {
      res = { status: "Error", videos: row.videos ?? "", result: `unexpected: ${(e as Error).message}` };
    }
    writeRow(ws, row, res);
    await wb.xlsx.writeFile(QUEUE_XLSX); // persist after each row
    if (res.status === "Done") {
      okCount++;
      console.log(`✓ Row ${row.rowNumber}: ${res.result}\n`);
    } else {
      errCount++;
      console.log(`✗ Row ${row.rowNumber}: ${res.result}\n`);
    }
  }

  console.log(`=== Done: ${okCount} thành công, ${errCount} lỗi ===`);
}

main().catch((e) => {
  console.error("✗ podcast-queue crash:", e);
  process.exit(1);
});
