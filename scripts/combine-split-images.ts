#!/usr/bin/env tsx
/**
 * Combine split-frame source images for VS / sibling-pair scenes.
 *
 * Two-person "together" photos are hard to source/generate, so a scene can be
 * fed TWO single-subject images instead:
 *
 *   <stem>-1.<ext>  (left half)
 *   <stem>-2.<ext>  (right half)
 *
 * This helper composites each such pair into a single `<stem>.png`, which the
 * normal pipeline then stages + renders exactly like any other scene image. If
 * the user already has a real two-person photo, they just save it as
 * `<stem>.png` and this helper leaves it alone (no `-1`/`-2` → nothing to do).
 *
 * TWO layouts, picked from the SOURCES rather than by flag (see `pickLayout`):
 *   • either source LANDSCAPE → stacked 1080×1408, `-1` on top, `-2` below
 *   • both sources PORTRAIT   → side-by-side 1080×1920, `-1` left, `-2` right
 * The user dislikes the side-by-side look and it also mangles landscape photos
 * (540×1920 halves, aspect 0.28), so stacking is the common case in practice.
 *
 * Runs automatically at the start of `npm run images:stage`, and standalone via
 * `npm run images:combine -- <folder>`. Puppeteer (already a dep) is only
 * launched when at least one `-1`/`-2` pair is present, so it's a no-op cost
 * for videos that don't use split frames.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, basename, join, resolve } from "node:path";
import { readImageAspect } from "../src/render/image-dims.js";
import puppeteer from "puppeteer";

const KNOWN_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export interface SplitPair {
  stem: string; // combined output stem, e.g. "pair-doue"
  left: string; // actual filename, e.g. "pair-doue-1.jpg"
  right: string; // actual filename, e.g. "pair-doue-2.png"
}

function findByStem(dir: string, stem: string): string | null {
  for (const ext of KNOWN_EXTENSIONS) {
    if (existsSync(join(dir, stem + ext))) return stem + ext;
  }
  return null;
}

/** Find every `<stem>-1` + `<stem>-2` image pair in `dir`. */
export function findSplitPairs(dir: string): SplitPair[] {
  if (!existsSync(dir)) return [];
  const pairs: SplitPair[] = [];
  const seen = new Set<string>();
  for (const f of readdirSync(dir)) {
    const ext = extname(f).toLowerCase();
    if (!KNOWN_EXTENSIONS.includes(ext)) continue;
    const m = basename(f, ext).match(/^(.+)-1$/);
    if (!m) continue;
    const stem = m[1];
    if (seen.has(stem)) continue;
    const left = findByStem(dir, `${stem}-1`);
    const right = findByStem(dir, `${stem}-2`);
    if (left && right) {
      pairs.push({ stem, left, right });
      seen.add(stem);
    }
  }
  return pairs;
}

function dataUri(absPath: string): string {
  const ext = extname(absPath).toLowerCase();
  const mime = MIME[ext] ?? "image/png";
  const b64 = readFileSync(absPath).toString("base64");
  return `data:${mime};base64,${b64}`;
}

function splitHtml(leftUri: string, rightUri: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1080px;height:1920px;overflow:hidden;background:#0a1024}
    .frame{position:relative;width:1080px;height:1920px;display:flex}
    .half{width:540px;height:1920px;overflow:hidden;position:relative}
    .half img{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block}
    /* inner edge shadow toward the seam for depth */
    .half::after{content:"";position:absolute;inset:0;pointer-events:none}
    .left::after{box-shadow:inset -34px 0 60px -22px rgba(0,0,0,0.55)}
    .right::after{box-shadow:inset 34px 0 60px -22px rgba(0,0,0,0.55)}
    .divider{position:absolute;top:0;bottom:0;left:50%;width:6px;transform:translateX(-3px);z-index:3;
      background:linear-gradient(180deg,transparent 0%,rgba(196,163,90,0.95) 18%,rgba(196,163,90,0.95) 82%,transparent 100%);
      box-shadow:0 0 26px rgba(196,163,90,0.6)}
  </style></head><body>
    <div class="frame">
      <div class="half left"><img src="${leftUri}"></div>
      <div class="half right"><img src="${rightUri}"></div>
      <div class="divider"></div>
    </div>
  </body></html>`;
}

/**
 * Stacked variant — image 1 on top, image 2 underneath, gold seam across.
 *
 * Side-by-side gives each source a 540×1920 slot (aspect 0.28). A LANDSCAPE
 * photo forced through that keeps only a narrow vertical sliver of itself: the
 * subject ends up tiny and the surroundings do the cropping. Stacked gives each
 * source 1080×960 (aspect 1.13), which is close to a landscape original and
 * keeps the subject readable at the size it will actually be seen.
 */
export const STACK_W = 1080;
/**
 * 1080×1408 is the PORTRAIT CARD's aspect (560×730 = 0.767), not 9:16.
 *
 * Getting this wrong crops the picture twice. A 1080×1920 stack goes into the
 * 560×730 slot as `cover` at `background-position: 50% 38%`, which shaves ~195
 * source px off the top — exactly where the upper subject's head sits. Matching
 * the slot aspect here means the card crops nothing, and each half lands at
 * 1080×704 (aspect 1.53), which is what a landscape football photo already is.
 */
export const STACK_H = 1408;

function stackHtml(topUri: string, bottomUri: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${STACK_W}px;height:${STACK_H}px;overflow:hidden;background:#0a1024}
    .frame{position:relative;width:${STACK_W}px;height:${STACK_H}px;display:flex;flex-direction:column}
    .half{width:${STACK_W}px;height:${STACK_H / 2}px;overflow:hidden;position:relative}
    .half img{width:100%;height:100%;object-fit:cover;object-position:50% 35%;display:block}
    .half::after{content:"";position:absolute;inset:0;pointer-events:none}
    .top::after{box-shadow:inset 0 -34px 60px -22px rgba(0,0,0,0.55)}
    .bottom::after{box-shadow:inset 0 34px 60px -22px rgba(0,0,0,0.55)}
    .divider{position:absolute;left:0;right:0;top:50%;height:6px;transform:translateY(-3px);z-index:3;
      background:linear-gradient(90deg,transparent 0%,rgba(196,163,90,0.95) 18%,rgba(196,163,90,0.95) 82%,transparent 100%);
      box-shadow:0 0 26px rgba(196,163,90,0.6)}
  </style></head><body>
    <div class="frame">
      <div class="half top"><img src="${topUri}"></div>
      <div class="half bottom"><img src="${bottomUri}"></div>
      <div class="divider"></div>
    </div>
  </body></html>`;
}

/**
 * Which way to join a pair. Driven by the SOURCES, not by taste: two landscape
 * photos only survive stacked, two portrait ones only survive side-by-side.
 * Mixed pairs stack too — a landscape source is the one that loses most from
 * being squeezed into a half-width column, so it decides.
 */
function pickLayout(leftPath: string, rightPath: string): "split" | "stack" {
  const a = readImageAspect(leftPath);
  const b = readImageAspect(rightPath);
  if (a === null || b === null) return "split"; // unknown → keep old behaviour
  const LANDSCAPE = 1.15;
  return a > LANDSCAPE || b > LANDSCAPE ? "stack" : "split";
}

/**
 * Composite every `-1`/`-2` pair in `dir` into `<stem>.png`. Returns the list of
 * output filenames written. No-op (returns []) when no pairs are present.
 */
export async function combineSplitImages(dir: string): Promise<string[]> {
  const pairs = findSplitPairs(dir);
  if (pairs.length === 0) return [];

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    const written: string[] = [];
    for (const p of pairs) {
      const leftPath = join(dir, p.left);
      const rightPath = join(dir, p.right);
      const layout = pickLayout(leftPath, rightPath);
      // Viewport must follow the layout — the screenshot is the canvas.
      await page.setViewport(
        layout === "stack"
          ? { width: STACK_W, height: STACK_H, deviceScaleFactor: 1 }
          : { width: 1080, height: 1920, deviceScaleFactor: 1 },
      );
      const html = layout === "stack"
        ? stackHtml(dataUri(leftPath), dataUri(rightPath))
        : splitHtml(dataUri(leftPath), dataUri(rightPath));
      await page.setContent(html, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 120));
      const out = `${p.stem}.png`;
      await page.screenshot({ path: join(dir, out) });
      written.push(out);
      console.log(`  ${layout === "stack" ? "stack (tren/duoi)" : "split (trai/phai)"}: ${p.left} + ${p.right} → ${out}`);
    }
    return written;
  } finally {
    await browser.close();
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const invokedDirectly = !!process.argv[1] && /combine-split-images/.test(process.argv[1]);
if (invokedDirectly) {
  const dir = resolve(process.argv[2] ?? ".");
  combineSplitImages(dir)
    .then((out) => {
      console.log(out.length ? `✓ combined ${out.length} split image(s) in ${dir}` : `no -1/-2 image pairs in ${dir} — nothing to combine`);
    })
    .catch((e) => {
      console.error("✗ combine failed:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    });
}
