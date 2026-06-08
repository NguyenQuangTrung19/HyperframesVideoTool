import { existsSync, readdirSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, extname, join, basename } from "node:path";
import { ImagesPlanSchema, type ImagesPlan } from "./plan-schema.js";

const PLAN_FILENAME = "images-plan.json";
const KNOWN_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export interface ValidationResult {
  /** Scenes whose declared `filename` is not present on disk. */
  missing: Array<{ id: string; filename: string }>;
  /** Image-like files in the input folder NOT referenced by the plan (likely leftover from a prior plan). */
  orphans: string[];
}

/**
 * Returns the path to images-plan.json that lives alongside the given .txt,
 * or null if no plan exists. Does not validate the contents.
 */
export function findPlanPath(txtPath: string): string | null {
  const dir = dirname(txtPath);
  const candidate = join(dir, PLAN_FILENAME);
  return existsSync(candidate) ? candidate : null;
}

/**
 * Loads + validates images-plan.json from the same directory as txtPath.
 * Returns null if no plan exists. Throws if the file is malformed.
 */
export function loadImagesPlan(txtPath: string): ImagesPlan | null {
  const planPath = findPlanPath(txtPath);
  if (!planPath) return null;
  const raw = JSON.parse(readFileSync(planPath, "utf8"));
  return ImagesPlanSchema.parse(raw);
}

/**
 * Looks for an image file in `dir` whose stem matches `stem`, trying each known
 * extension in priority order. Returns the actual filename (with extension) or null.
 *
 * This is what makes the plan tolerant of `.jpg`/`.jpeg`/`.webp` even when the
 * plan's `filename` field says `.png` — the user can save under any supported
 * format and we'll find it.
 */
function findExistingImageByStem(dir: string, stem: string): string | null {
  for (const ext of KNOWN_EXTENSIONS) {
    const candidate = stem + ext;
    if (existsSync(join(dir, candidate))) return candidate;
  }
  return null;
}

function stemOf(filename: string): string {
  return basename(filename, extname(filename));
}

/**
 * Compares the plan against the input folder contents and reports
 * missing planned images + orphaned image files. Matching is stem-based:
 * a planned `cb-1.png` is satisfied by any of `cb-1.{png,jpg,jpeg,webp}`.
 */
export function validatePlan(plan: ImagesPlan, inputDir: string): ValidationResult {
  const plannedStems = new Set(plan.scenes.map((s) => stemOf(s.filename)));

  const missing = plan.scenes
    .filter((s) => !findExistingImageByStem(inputDir, stemOf(s.filename)))
    .map((s) => ({ id: s.id, filename: s.filename }));

  const orphans: string[] = [];
  if (existsSync(inputDir)) {
    for (const f of readdirSync(inputDir)) {
      const ext = extname(f).toLowerCase();
      if (!KNOWN_EXTENSIONS.includes(ext)) continue;
      const stem = stemOf(f);
      if (plannedStems.has(stem)) continue;
      // Split-frame source halves (<plannedStem>-1 / -2) get composited into the
      // planned <plannedStem>.png by combine-split-images — not orphans.
      const half = stem.match(/^(.+)-[12]$/);
      if (half && plannedStems.has(half[1])) continue;
      orphans.push(f);
    }
  }

  return { missing, orphans };
}

/**
 * Copies each planned image from inputDir into outputDir/images/<sceneId>.<actualExt>.
 * Caller MUST run validatePlan() first and abort on missing. Uses the file
 * extension actually present on disk, not the one declared in the plan.
 * Returns the relative paths written (relative to outputDir).
 */
export async function stageImagesToOutput(
  plan: ImagesPlan,
  inputDir: string,
  outputDir: string,
): Promise<string[]> {
  const imagesDir = join(outputDir, "images");
  await mkdir(imagesDir, { recursive: true });

  const written: string[] = [];
  for (const scene of plan.scenes) {
    const actualName = findExistingImageByStem(inputDir, stemOf(scene.filename));
    if (!actualName) {
      throw new Error(
        `staging: no image file for scene "${scene.id}" (looked for ${stemOf(scene.filename)}.{png,jpg,jpeg,webp}) — run validatePlan() first`,
      );
    }
    const ext = extname(actualName).toLowerCase();
    const src = join(inputDir, actualName);
    const destRel = `images/${scene.id}${ext}`;
    const dest = join(outputDir, destRel);
    await copyFile(src, dest);
    written.push(destRel);
  }
  return written;
}

/** Slug derivation: prefer parent folder name when txt is in a subfolder named the same as the txt stem. */
export function deriveSlugFromTxtPath(txtPath: string): string {
  const stem = basename(txtPath, extname(txtPath));
  const parent = basename(dirname(txtPath));
  // input/topCBsITW/topCBsITW.txt → "topCBsITW"
  // input/topCBsITW.txt           → "topCBsITW"
  return parent && parent !== "input" && parent !== "." ? parent : stem;
}
