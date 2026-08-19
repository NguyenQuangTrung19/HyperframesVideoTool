/**
 * Thumbnail — pull one still of the HOOK scene out of a finished render.
 *
 * The hook is the only frame that has to sell the video in a feed, so the
 * thumbnail is never a random frame: it is scene 1, sampled at its own
 * midpoint. Midpoint (not t=0) because the hook's entrance animation is still
 * moving for the first ~1s — a frame taken too early catches text mid-flight.
 *
 * The hook's real length is read from `voice/scene-<id>.mp3`, the same cut the
 * renderer timed the scene to, so this stays correct when the voice changes.
 *
 *   npx tsx scripts/make-thumbnail.ts video/output/<slug>
 *   npx tsx scripts/make-thumbnail.ts video/output/<slug>/video.mp4
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((ok, fail) => {
    const proc = spawn(cmd, args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? ok(out) : fail(new Error(`${cmd} failed (exit ${code}): ${err}`)));
    proc.on("error", fail);
  });
}

async function durationSec(path: string): Promise<number> {
  const out = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const d = parseFloat(out.trim());
  if (isNaN(d)) throw new Error(`ffprobe returned non-numeric duration for ${path}`);
  return d;
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: make-thumbnail.ts <video/output/<slug> | .../video.mp4> [outPath]");
  process.exit(1);
}

const target = resolve(arg);
const outDir = statSync(target).isDirectory() ? target : dirname(target);

const videoPath = statSync(target).isDirectory() ? join(outDir, "video.mp4") : target;
if (!existsSync(videoPath)) {
  console.error(`no rendered video at ${videoPath} — render first, then make the thumbnail`);
  process.exit(1);
}

const scriptPath = join(outDir, "script.json");
if (!existsSync(scriptPath)) {
  console.error(`no script.json next to the video (${outDir}) — cannot identify the hook scene`);
  process.exit(1);
}

const script = JSON.parse(readFileSync(scriptPath, "utf8"));
const hook = script.scenes?.[0];
if (!hook?.id) {
  console.error("script.json has no scenes[0] — nothing to sample");
  process.exit(1);
}

// The scene cut carries the hook's true length. If it is missing (older render,
// or voice/ was cleared) fall back to a fixed 2.5s: past the entrance animation
// and inside even the shortest hook we produce.
const voiceDir = join(outDir, "voice");
const cut = existsSync(voiceDir)
  ? readdirSync(voiceDir).find((f) => f.replace(/\.[^.]+$/, "") === `scene-${hook.id}`)
  : undefined;

let seekSec = 2.5;
if (cut) {
  const dur = await durationSec(join(voiceDir, cut));
  seekSec = Math.max(1.2, dur / 2);
} else {
  console.warn(`⚠ voice/scene-${hook.id}.mp3 not found — sampling at the default ${seekSec}s`);
}

const outPath = resolve(process.argv[3] ?? join(outDir, "thumbnail.jpg"));
await run("ffmpeg", [
  "-y",
  "-accurate_seek", "-ss", seekSec.toFixed(3),
  "-i", videoPath,
  "-frames:v", "1",
  "-q:v", "2",
  outPath,
]);

console.log(
  `✓ thumbnail (hook "${hook.id}" @ ${seekSec.toFixed(2)}s) → ${outPath.replace(/\\/g, "/")}`
);
console.log(`  ${(statSync(outPath).size / 1024).toFixed(0)} KB · từ ${basename(videoPath)}`);
