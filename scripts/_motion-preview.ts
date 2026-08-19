/**
 * Motion preview — render a slice of a composition to mp4 WITHOUT the pipeline.
 *
 * Still frames can't answer "is the motion smooth"; only moving pictures can.
 * This seeks the same GSAP timeline the real renderer seeks, one frame at a
 * time, and pipes the frames to ffmpeg. No TTS, no voice cache, no image API —
 * so a motion change can be reviewed in ~1 min instead of a full render.
 *
 *   npx tsx scripts/_motion-preview.ts <script.json> <out.mp4> [seconds] [fps]
 *
 * NOT a substitute for a real render: no audio, and the scene lengths here are
 * the placeholder 8s the design harness uses, not the real voice durations.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { composeHtml } from "../src/render/html-composer.js";
import { readImageSize } from "../src/render/image-dims.js";

const scriptPath = process.argv[2];
const outPath = resolve(process.argv[3] ?? "motion-preview.mp4");
const seconds = Number(process.argv[4] ?? 24);
const fps = Number(process.argv[5] ?? 30);
if (!scriptPath) {
  console.error("usage: _motion-preview.ts <script.json> <out.mp4> [seconds] [fps]");
  process.exit(1);
}

const srcDir = dirname(resolve(scriptPath));
const script = JSON.parse(readFileSync(scriptPath, "utf8"));

const imagesDir = join(srcDir, "images");
const sceneImages: Record<string, string> = {};
const sceneImageAspect: Record<string, number> = {};
if (existsSync(imagesDir)) {
  for (const file of readdirSync(imagesDir)) {
    const id = basename(file).replace(/\.[^.]+$/, "");
    sceneImages[id] = `images/${file}`;
    const size = readImageSize(join(imagesDir, file));
    if (size) sceneImageAspect[id] = size.w / size.h;
  }
}

const SCENE_SEC = 8;
const avatar = readdirSync(srcDir).find((f) => f.startsWith("tiktok-avatar.")) ?? "tiktok-avatar.jpg";
const html = composeHtml({
  script,
  sceneAudio: script.scenes.map((s: { id: string }) => ({ id: s.id, durationSec: SCENE_SEC })),
  gapSec: 0,
  sceneImages,
  sceneImageAspect,
  audioRelPath: "voice/full.mp3",
  tiktokAvatarRelPath: avatar,
});

const htmlPath = join(srcDir, "_motion-check.html");
writeFileSync(htmlPath, html, "utf8");
for (const asset of ["styles.css", "animations.js", "shader.js"]) {
  const from = join("src/render/templates", asset);
  if (existsSync(from)) copyFileSync(from, join(srcDir, asset));
}

mkdirSync(dirname(outPath), { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--allow-file-access-from-files", "--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
await page.evaluate("document.fonts.ready");

// Freeze CSS animations too. A handful of decorative loops (drifting dust, the
// hook's Ken Burns) are still CSS @keyframes, which run on the wall clock — if
// they keep ticking while we step the GSAP clock frame by frame, the preview
// shows them racing. Pausing them means those specific effects read as static
// here; everything on the GSAP timeline is exact.
await page.evaluate(`document.getAnimations().forEach(function(a){ a.pause(); })`);

// ffmpeg reads a raw JPEG stream on stdin — avoids writing thousands of files.
const ff = spawn("ffmpeg", [
  "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
  "-pix_fmt", "yuv420p", outPath,
], { stdio: ["pipe", "ignore", "pipe"] });
let ffErr = "";
ff.stderr.on("data", (d) => { ffErr += d.toString(); });

const total = Math.round(seconds * fps);
for (let f = 0; f < total; f++) {
  const t = f / fps;
  await page.evaluate(`(function(){
    var tl = window.__timelines && window.__timelines["news-video"];
    if (tl) { tl.pause(); tl.seek(${t}); }
  })()`);
  const buf = (await page.screenshot({ type: "jpeg", quality: 90 })) as Buffer;
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 60 === 0) process.stdout.write(`\r  frame ${f}/${total}`);
}
ff.stdin.end();
process.stdout.write(`\r  frame ${total}/${total}\n`);

const code: number = await new Promise((r) => ff.on("close", r));
await browser.close();
rmSync(htmlPath, { force: true });

if (code !== 0) {
  console.error(ffErr.split("\n").slice(-12).join("\n"));
  process.exit(code);
}
console.log(`motion preview → ${outPath}  (${seconds}s @ ${fps}fps, no audio)`);
