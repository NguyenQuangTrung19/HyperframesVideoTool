/**
 * Roundup thumbnail — a DESIGNED 1280×720 cover, not a frame grab.
 *
 * `npm run thumbnail` pulls a still of the hook out of a finished render, which
 * is right for a 9:16 short: the hook already is the cover. A landscape
 * bulletin needs something the hook can't be — several stories represented at
 * once, a date, and a title set large enough to read at 210px wide in a
 * YouTube grid. So this composes one: a collage of the images YOU pick, a solid
 * band across the bottom carrying the title, and a date strap above it.
 *
 * Rendered through the same headless Chrome the video goes through, so the
 * type and the palette are the ones the video already uses.
 *
 *   npx tsx scripts/make-roundup-thumbnail.ts video/output/<slug> \
 *     --title "Arsenal chốt Yildiz, Real đổi tướng" \
 *     --date "Sáng 10/08/2026" \
 *     --images tin1-open.png,tin3-open.png,tin5-open.png
 *
 * `--images` are filenames inside <outputDir>/images/ (or paths). 2–4 read
 * best; 1 works, 5+ is refused — at thumbnail size nobody can parse five
 * photos. Omit `--images` and it takes the first 3 staged images in plan order.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { readImageSize } from "../src/render/image-dims.js";

const WIDTH = 1280;
const HEIGHT = 720;
/** YouTube's own guidance; well under its 2 MB cap at this size. */
const JPEG_QUALITY = 92;

interface Args {
  outDir: string;
  /** The full platform title, verbatim — this is what lands in tieu-de.txt. */
  title: string;
  /** What the cover shows: the same title minus its "| Bản tin …" suffix. */
  coverTitle: string;
  date?: string;
  images: string[];
  out: string;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) {
        throw new Error(`--${key} needs a value`);
      }
      flags[key] = val;
      i++;
    } else {
      positional.push(a);
    }
  }

  const target = positional[0];
  if (!target) throw new Error("missing <outputDir>");
  const outDir = resolve(target);
  if (!existsSync(outDir) || !statSync(outDir).isDirectory()) {
    throw new Error(`not a directory: ${outDir}`);
  }
  if (!flags.title) throw new Error("--title is required");

  const imagesDir = join(outDir, "images");
  const resolveImage = (name: string): string => {
    const direct = resolve(outDir, name);
    if (existsSync(direct) && statSync(direct).isFile()) return direct;
    const staged = join(imagesDir, name);
    if (existsSync(staged)) return staged;
    // Allow a bare scene id — the staged file may carry any extension.
    if (existsSync(imagesDir)) {
      const hit = readdirSync(imagesDir).find(
        (f) => f.slice(0, f.length - extname(f).length) === name,
      );
      if (hit) return join(imagesDir, hit);
    }
    throw new Error(`image not found: ${name} (looked in ${imagesDir})`);
  };

  let images: string[];
  if (flags.images) {
    images = flags.images
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(resolveImage);
  } else {
    if (!existsSync(imagesDir)) throw new Error(`no images/ in ${outDir} and no --images given`);
    images = readdirSync(imagesDir)
      .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f))
      .sort()
      .slice(0, 3)
      .map((f) => join(imagesDir, f));
    if (images.length === 0) throw new Error(`images/ is empty in ${outDir}`);
  }

  if (images.length > 4) {
    throw new Error(
      `${images.length} images given — cap is 4. At 210px wide in a YouTube grid ` +
        `nobody can parse more than that; pick the strongest few.`,
    );
  }

  return {
    outDir,
    title: flags.title,
    coverTitle: coverTitleOf(flags.title),
    date: flags.date,
    images,
    out: resolve(flags.out ?? join(outDir, "thumbnail.jpg")),
  };
}

/** Inline every photo so the page needs no file:// permissions or base href. */
function dataUri(path: string): string {
  const ext = extname(path).slice(1).toLowerCase();
  const mime =
    ext === "png" ? "image/png"
    : ext === "webp" ? "image/webp"
    : ext === "avif" ? "image/avif"
    : "image/jpeg";
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

function findAvatar(outDir: string): string | null {
  const local = readdirSync(outDir).find((f) => f.startsWith("tiktok-avatar."));
  if (local) return join(outDir, local);
  const assets = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "assets");
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = join(assets, `logoTV.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * A platform title ends "… | Bản tin sáng 10/08" so it stands alone in a
 * YouTube search result. On the cover that suffix is dead weight: the date is
 * already set across the strap right above it, so printing it again spends two
 * of the four lines the band has on saying the same thing twice. Everything
 * after the pipe is dropped from the cover and kept in the file.
 */
function coverTitleOf(title: string): string {
  const cut = title.indexOf("|");
  const head = cut === -1 ? title : title.slice(0, cut);
  return head.trim().replace(/[,;·]\s*$/, "");
}

/**
 * Title size steps down as the line gets longer. A thumbnail title that wraps
 * to three lines has already lost — the band only has room for two.
 */
function titleSize(title: string): number {
  const n = title.length;
  if (n <= 28) return 78;
  if (n <= 40) return 68;
  if (n <= 52) return 60;
  if (n <= 66) return 52;
  return 46;
}

/**
 * Width/height of each panel per layout, in the order the photos are placed.
 * The collage is 1280 wide × 458 tall (720 minus the band) with 5px gaps.
 */
const PANEL_ASPECTS: Record<number, number[]> = {
  1: [1280 / 458],
  2: [637 / 458, 637 / 458],
  3: [717 / 458, 553 / 226, 553 / 226],
  4: [637 / 226, 637 / 226, 637 / 226, 637 / 226],
};

/**
 * Where to crop a photo vertically, as a `background-position` percentage.
 *
 * A fixed 32% works for photos roughly as wide as their panel. It fails on the
 * combination this collage hits constantly: a portrait source (the slot the
 * video renders it in is 640×834) dropped into a wide panel. `cover` then
 * scales to the panel's WIDTH and throws away most of the height — at 32% that
 * takes the top off the subject's head, which is the one thing a thumbnail
 * cannot afford. The taller the photo is relative to its panel, the higher the
 * crop window has to sit.
 */
function cropFocus(imagePath: string, panelAspect: number): number {
  const size = readImageSize(imagePath);
  if (!size || size.h === 0) return 32;
  const ratio = size.w / size.h / panelAspect;
  if (ratio >= 0.85) return 32;   // similar shape — a normal crop
  if (ratio >= 0.6) return 24;
  return 15;                       // markedly taller than its panel — hug the top
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildHtml(args: Args, avatar: string | null): string {
  const photos = args.images.map(dataUri);
  // Layout per count. The three-photo case is the one this is tuned for: one
  // tall hero carrying the lead story, two supporting stills stacked beside it.
  const gridCss =
    photos.length === 1
      ? `grid-template-columns: 1fr; grid-template-areas: "a";`
      : photos.length === 2
        ? `grid-template-columns: 1fr 1fr; grid-template-areas: "a b";`
        : photos.length === 3
          ? `grid-template-columns: 1.28fr 1fr; grid-template-rows: 1fr 1fr; grid-template-areas: "a b" "a c";`
          : `grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; grid-template-areas: "a b" "c d";`;
  const areas = ["a", "b", "c", "d"];
  const panelAspects = PANEL_ASPECTS[photos.length] ?? PANEL_ASPECTS[3];
  const panels = photos
    .map((src, i) => {
      const focus = cropFocus(args.images[i], panelAspects[i]);
      return `<div class="panel" style="grid-area:${areas[i]};background-image:url('${src}');background-position:50% ${focus}%"></div>`;
    })
    .join("\n    ");

  const dateStrap = args.date
    ? `<div class="strap"><span class="strap-bar"></span><span class="strap-text">${escapeHtml(args.date)}</span></div>`
    : "";
  // The lockup sits INSIDE the band. Floating over the collage it landed on a
  // different backdrop every time — a face, a white kit, a crowd — so it needed
  // its own white plate and a drop shadow to survive, and it read as a sticker
  // pressed onto the picture. On the band it always has the same ground behind
  // it, so it can be plain white type and belong to the design.
  const brand = avatar
    ? `<div class="brand"><img src="${dataUri(avatar)}" alt="" /><span>SportsForAllTV</span></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&family=Playfair+Display:wght@700;800;900&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${WIDTH}px; height:${HEIGHT}px; overflow:hidden; background:#0A5C90; }
  .frame { position:relative; width:${WIDTH}px; height:${HEIGHT}px; }

  /* ── Collage ── */
  /* The collage stops where the band starts. Letting it run under the band and
     covering the bottom third with a panel wastes a photo: whatever was in the
     lower half of that panel is simply never seen. */
  .collage { position:absolute; top:0; left:0; right:0; bottom:262px; display:grid; gap:5px; background:#FFFFFF; ${gridCss} }
  .panel {
    background-size:cover;
    /* Vertical crop is set per panel — see cropFocus(). */
    filter:saturate(1.08) contrast(1.05);
  }

  /* ── Bottom band ──
     Solid, not a gradient over the photo. At 210px wide a gradient leaves the
     title sitting on whatever the photo happens to be, and half the time that
     is a white kit.

     BLUE AND WHITE — the channel's own pair (the v3 palette is "trắng + xanh
     dương mây trời"), picked over both the navy this started as and the red it
     passed through. Deep enough in the sky family that white type clears
     contrast with room to spare, bright enough not to read as the near-black
     every other sports channel uses. The white rule on top is the same white as
     the 5px seams between the photos, so the band and the collage lock
     together instead of looking stacked. Two colours only — no third accent.

     262px, not 236: two lines of a 60px serif plus the strap plus descenders
     measured 231 against a 236px band, so the tail of a "y" on line two was
     being shaved off. */
  .band {
    position:absolute; left:0; right:0; bottom:0; height:262px;
    background:linear-gradient(175deg, #1183CE 0%, #0A5C90 100%);
    border-top:6px solid #FFFFFF;
    padding:24px 40px 34px;
    display:flex; align-items:center; gap:32px;
  }
  .band-text {
    flex:1; min-width:0;
    display:flex; flex-direction:column; justify-content:center; gap:14px;
  }
  .strap { display:flex; align-items:center; gap:14px; }
  .strap-bar { width:8px; height:30px; background:#FFFFFF; border-radius:3px; }
  .strap-text {
    font-family:'Oswald', sans-serif; font-weight:600; font-size:31px;
    letter-spacing:0.16em; text-transform:uppercase; color:#FFFFFF;
  }
  .title {
    font-family:'Playfair Display', serif; font-weight:900;
    font-size:${titleSize(args.coverTitle)}px; line-height:1.04;
    letter-spacing:-0.015em; color:#FFFFFF; text-wrap:balance;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  }

  /* Lockup: right end of the band, on its own ground. Separated by a hairline
     rather than a box, so it reads as a sign-off and not a second button. */
  .brand {
    flex:none;
    display:flex; flex-direction:column; align-items:center; gap:10px;
    padding-left:32px;
    border-left:2px solid rgba(255,255,255,0.22);
  }
  /* The logo tile is dark navy; on a blue ground it needs an edge or it sinks
     into the band. A white ring reads as part of the blue-and-white pair rather
     than as a plate stuck behind it. */
  .brand img {
    width:76px; height:76px; border-radius:18px; object-fit:cover; display:block;
    border:3px solid rgba(255,255,255,0.92);
    box-shadow:0 6px 18px rgba(0,0,0,0.22);
  }
  .brand span {
    font-family:'Inter', sans-serif; font-weight:800; font-size:22px;
    color:#FFFFFF; letter-spacing:0.01em; white-space:nowrap;
  }
</style></head>
<body>
  <div class="frame">
    <div class="collage">
    ${panels}
    </div>
    <div class="band">
      <div class="band-text">
        ${dateStrap}
        <div class="title">${escapeHtml(args.coverTitle)}</div>
      </div>
      ${brand}
    </div>
  </div>
</body></html>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const avatar = findAvatar(args.outDir);
  const html = buildHtml(args, avatar);

  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--hide-scrollbars"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    // Fonts come from the CDN the video already uses; without this the shot can
    // catch the fallback face mid-swap.
    await page.evaluate("document.fonts.ready");
    await page.screenshot({ path: args.out, type: "jpeg", quality: JPEG_QUALITY });
  } finally {
    await browser.close();
  }

  const kb = statSync(args.out).size / 1024;
  console.log(`✓ thumbnail ${WIDTH}×${HEIGHT} → ${args.out.replace(/\\/g, "/")}  (${kb.toFixed(0)} KB)`);
  console.log(`  ảnh ghép: ${args.images.map((p) => basename(p)).join(" · ")}`);

  // The title is what gets pasted into YouTube, so it is written next to the
  // video rather than only printed — a line in a terminal scrollback is not a
  // deliverable.
  const titlePath = join(args.outDir, "tieu-de.txt");
  writeFileSync(titlePath, args.title.trim() + "\n", "utf8");
  console.log(`✓ tiêu đề → ${titlePath.replace(/\\/g, "/")}`);
  console.log(`  ${args.title}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
