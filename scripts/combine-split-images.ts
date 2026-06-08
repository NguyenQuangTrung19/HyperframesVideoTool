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
 * This helper composites each such pair into a single 9:16 split-frame image
 * `<stem>.png` (left | gold divider | right), which the normal pipeline then
 * stages + renders full-bleed exactly like any other scene image. If the user
 * already has a real two-person photo, they just save it as `<stem>.png` and
 * this helper leaves it alone (no `-1`/`-2` → nothing to do).
 *
 * Runs automatically at the start of `npm run images:stage`, and standalone via
 * `npm run images:combine -- <folder>`. Puppeteer (already a dep) is only
 * launched when at least one `-1`/`-2` pair is present, so it's a no-op cost
 * for videos that don't use split frames.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, basename, join, resolve } from "node:path";
import puppeteer from "puppeteer";

const KNOWN_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
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
 * Composite every `-1`/`-2` pair in `dir` into `<stem>.png`. Returns the list of
 * output filenames written. No-op (returns []) when no pairs are present.
 */
export async function combineSplitImages(dir: string): Promise<string[]> {
  const pairs = findSplitPairs(dir);
  if (pairs.length === 0) return [];

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    const written: string[] = [];
    for (const p of pairs) {
      const html = splitHtml(dataUri(join(dir, p.left)), dataUri(join(dir, p.right)));
      await page.setContent(html, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 120));
      const out = `${p.stem}.png`;
      await page.screenshot({ path: join(dir, out) });
      written.push(out);
      console.log(`  split: ${p.left} + ${p.right} → ${out}`);
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
