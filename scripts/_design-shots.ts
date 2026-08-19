/**
 * Design check — compose a real script.json into HTML, then screenshot every
 * scene at its own midpoint and print the measured geometry of the pieces that
 * are supposed to hold still (photo card, text block, brand lockup).
 *
 * Exists because "does this look right" cannot be answered by re-rendering the
 * video: a full render is ~90s of GPU plus a TTS-cache dance, and it produces
 * an mp4 you still have to seek through by hand. This puts the same DOM the
 * renderer uses in front of a headless Chrome and reports numbers.
 *
 *   npx tsx scripts/_design-shots.ts video/output/<slug>/script.json [outDir]
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import puppeteer from "puppeteer";
import { CANVAS, composeHtml } from "../src/render/html-composer.js";
import { readImageSize } from "../src/render/image-dims.js";

const scriptPath = process.argv[2];
const outDir = resolve(process.argv[3] ?? "design-shots");
if (!scriptPath) {
  console.error("usage: _design-shots.ts <script.json> [outDir]");
  process.exit(1);
}

const srcDir = dirname(resolve(scriptPath));
const script = JSON.parse(readFileSync(scriptPath, "utf8"));

// Bind whatever images are already staged next to the script, exactly the way
// the pipeline's PASS-1 override does (by scene id, any extension).
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

// Uniform 8s scenes: timing only drives the GSAP clock, and every scene is
// screenshotted at its own midpoint, so real audio durations add nothing here.
const SCENE_SEC = 8;
const sceneAudio = script.scenes.map((s: { id: string }) => ({ id: s.id, durationSec: SCENE_SEC }));

// The avatar's extension varies per output dir (.png / .jpg), and composeHtml's
// default guess of "tiktok-avatar.jpg" silently yields a broken <img> — which
// shows up as a mangled brand logo in every shot and looks like a CSS bug.
const avatar = readdirSync(srcDir).find((f) => f.startsWith("tiktok-avatar.")) ?? "tiktok-avatar.jpg";

const html = composeHtml({
  script,
  sceneAudio,
  gapSec: 0,
  sceneImages,
  sceneImageAspect,
  audioRelPath: "voice/full.mp3",
  tiktokAvatarRelPath: avatar,
});

mkdirSync(outDir, { recursive: true });
// The composed HTML references styles.css / animations.js / images by relative
// path, so it has to be served from the script's own directory.
const htmlPath = join(srcDir, "_design-check.html");
writeFileSync(htmlPath, html, "utf8");
const assets = ["styles.css", "animations.js", "shader.js"];
if (script.metadata?.aspect === "16:9") assets.push("styles-landscape.css");
for (const asset of assets) {
  const from = join("src/render/templates", asset);
  if (existsSync(from)) copyFileSync(from, join(srcDir, asset));
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--allow-file-access-from-files", "--hide-scrollbars"],
});
const page = await browser.newPage();
const canvas = CANVAS[(script.metadata?.aspect ?? "9:16") as keyof typeof CANVAS];
await page.setViewport({ width: canvas.w, height: canvas.h, deviceScaleFactor: 1 });
await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
// NOTE: every in-page snippet below is passed as a STRING, not a function.
// tsx compiles arrow functions through esbuild, which injects a `__name`
// helper call into them; that helper does not exist inside the page, so a
// function-form `page.evaluate` dies with "__name is not defined".
await page.evaluate("document.fonts.ready");

type Row = {
  scene: string; layout: string; fit: string; shape: string;
  card: string; text: string; brand: string;
};
const rows: Row[] = [];
/** Shots kept in memory so they can be inlined into a single self-contained page. */
const gallery: { row: Row; b64: string }[] = [];

for (let i = 0; i < script.scenes.length; i++) {
  const id = script.scenes[i].id;
  const midpoint = i * SCENE_SEC + SCENE_SEC / 2;

  // Park the master GSAP timeline on this scene's midpoint. `.seek()` is what
  // hyperframes itself does per frame, so what is measured is what renders.
  await page.evaluate(`(function(){
    var tl = window.__timelines && window.__timelines["news-video"];
    if (tl) { tl.pause(); tl.seek(${midpoint}); }
  })()`);
  await new Promise((r) => setTimeout(r, 120));

  const info = (await page.evaluate(`(function(){
    function box(sel, root) {
      var el = (root || document).querySelector(sel);
      if (!el) return "—";
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return "—";
      return Math.round(r.width) + "×" + Math.round(r.height)
        + " @y " + Math.round(r.top) + "–" + Math.round(r.bottom);
    }
    var scene = document.getElementById("scene-${id}");
    if (!scene) return null;
    return {
      layout: scene.getAttribute("data-layout") || "?",
      fit: scene.getAttribute("data-fit") || "?",
      shape: scene.getAttribute("data-shape") || "?",
      card: box(".bg-card, .feat-hero, .bq-portrait", scene),
      text: box(".stat-hero-content, .callout-content, .feat-cards, .eq-card, .hook-content", scene),
      brand: box(".brand-shell-header")
    };
  })()`)) as Row | null;
  if (!info) continue;

  rows.push({ ...info, scene: id });
  const shot = join(outDir, `${String(i).padStart(2, "0")}-${id}.jpg`);
  await page.screenshot({ path: shot, quality: 88, type: "jpeg" });
  gallery.push({ row: { ...info, scene: id }, b64: readFileSync(shot).toString("base64") });
}

await browser.close();
// The scratch HTML lives in the output dir only because the page's relative
// asset paths need it to; it is not part of the render.
rmSync(htmlPath, { force: true });

// ── Self-contained review page ─────────────────────────────────────────────
// One HTML file with every shot inlined as a data URI, so it opens by
// double-click with no server, no network and no sibling files. Each tile
// carries the measured geometry underneath, because the numbers are what show
// whether the cards line up across scenes — the eye can't hold that comparison.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tiles = gallery
  .map(
    ({ row, b64 }, i) => `
  <figure class="tile">
    <div class="frame"><img src="data:image/jpeg;base64,${b64}" alt="${esc(row.scene)}" loading="lazy"></div>
    <figcaption>
      <b>${String(i + 1).padStart(2, "0")} · ${esc(row.scene)}</b>
      <span class="tag">${esc(row.layout)}</span>
      <span class="tag ${row.fit === "card" ? "on" : ""}">${esc(row.fit)}</span>
      ${row.fit === "card" ? `<span class="tag">${esc(row.shape)}</span>` : ""}
      <dl>
        <dt>thẻ ảnh</dt><dd>${esc(row.card)}</dd>
        <dt>khối chữ</dt><dd>${esc(row.text)}</dd>
      </dl>
    </figcaption>
  </figure>`,
  )
  .join("\n");

const galleryHtml = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design check — ${esc(script.metadata?.title ?? basename(srcDir))}</title>
<style>
  :root{--ink:#141A26;--muted:#5B6779;--faint:#8792A6;--line:#D8DFE9;--bg:#F7F9FC;--card:#fff}
  @media (prefers-color-scheme:dark){:root{--ink:#EAEEF4;--muted:#A6B0C0;--faint:#79849A;--line:#2A3342;--bg:#11151C;--card:#161B24}}
  *{box-sizing:border-box}
  body{margin:0;padding:40px 32px 80px;background:var(--bg);color:var(--ink);
       font:15px/1.5 ui-sans-serif,system-ui,"Segoe UI",sans-serif}
  h1{margin:0 0 4px;font-size:26px;letter-spacing:-.02em}
  .sub{margin:0 0 32px;color:var(--muted)}
  .grid{display:grid;gap:28px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));max-width:1600px}
  .tile{margin:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .frame{background:#000;line-height:0}
  .frame img{width:100%;height:auto;display:block;cursor:zoom-in}
  figcaption{padding:12px 14px 14px}
  figcaption b{display:block;margin-bottom:8px;font-size:14px}
  .tag{display:inline-block;margin:0 4px 8px 0;padding:2px 9px;border:1px solid var(--line);
       border-radius:20px;font-size:11px;color:var(--muted)}
  .tag.on{border-color:#10A567;color:#10A567}
  dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0 0;
     font-size:11.5px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  dt{color:var(--faint)} dd{margin:0;color:var(--muted)}
  /* Click any shot to inspect it full size. */
  dialog{border:0;padding:0;background:transparent;max-width:96vw;max-height:96vh}
  dialog::backdrop{background:rgba(0,0,0,.86)}
  dialog img{max-width:96vw;max-height:96vh;display:block;cursor:zoom-out}
</style></head><body>
<h1>${esc(script.metadata?.title ?? basename(srcDir))}</h1>
<p class="sub">${gallery.length} cảnh · chụp ${canvas.w}×${canvas.h} từ DOM thật (cùng CSS + GSAP mà bản render dùng) · bấm vào ảnh để xem full</p>
<div class="grid">${tiles}</div>
<dialog id="zoom"><img id="zoomImg" alt=""></dialog>
<script>
  var dlg = document.getElementById('zoom'), zi = document.getElementById('zoomImg');
  document.querySelectorAll('.frame img').forEach(function (img) {
    img.addEventListener('click', function () { zi.src = img.src; dlg.showModal(); });
  });
  dlg.addEventListener('click', function () { dlg.close(); });
</script>
</body></html>`;

const galleryPath = join(outDir, "index.html");
writeFileSync(galleryPath, galleryHtml, "utf8");

const pad = (s: string, n: number) => s.padEnd(n);
console.log(
  pad("SCENE", 22) + pad("LAYOUT", 20) + pad("FIT", 7) + pad("SHAPE", 11) +
  pad("CARD", 30) + pad("TEXT", 30) + "BRAND"
);
for (const r of rows) {
  console.log(
    pad(r.scene, 22) + pad(r.layout, 20) + pad(r.fit, 7) + pad(r.shape, 11) +
    pad(r.card, 30) + pad(r.text, 30) + r.brand
  );
}
console.log(`\n${rows.length} shots → ${outDir}`);
