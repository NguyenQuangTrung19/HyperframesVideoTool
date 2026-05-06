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
 * Compares the plan against the input folder contents and reports
 * missing planned images + orphaned image files.
 */
export function validatePlan(plan: ImagesPlan, inputDir: string): ValidationResult {
  const plannedFilenames = new Set(plan.scenes.map((s) => s.filename));

  const missing = plan.scenes
    .filter((s) => !existsSync(join(inputDir, s.filename)))
    .map((s) => ({ id: s.id, filename: s.filename }));

  const orphans: string[] = [];
  if (existsSync(inputDir)) {
    for (const f of readdirSync(inputDir)) {
      if (!KNOWN_EXTENSIONS.includes(extname(f).toLowerCase())) continue;
      if (!plannedFilenames.has(f)) orphans.push(f);
    }
  }

  return { missing, orphans };
}

/**
 * Copies each planned image from inputDir into outputDir/images/<sceneId>.<ext>.
 * Caller MUST run validatePlan() first and abort on missing.
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
    const src = join(inputDir, scene.filename);
    const ext = extname(scene.filename).toLowerCase();
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
