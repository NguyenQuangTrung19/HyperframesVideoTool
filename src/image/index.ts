import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import type { ImageGenConfig } from "../config.js";
import type { Script } from "../render/script-schema.js";
import type { ImageProvider, GenerateResult } from "./provider.js";
import { createOpenAIImageProvider } from "./openai.js";
import { createGeminiImageProvider } from "./gemini.js";
import { createXAIImageProvider } from "./xai.js";
import { log } from "../utils/logger.js";

/** Templates that benefit from a background photo (action / atmospheric). */
const IMAGE_TEMPLATES = new Set(["hook", "callout", "stat-hero"]);

/** Hard cap on parallel API calls to avoid rate limits. */
const IMAGE_CONCURRENCY = 3;

/** Manual override extensions, in priority order. Drop a file at
 *  `output/<slug>/images/<sceneId>.<ext>` to bypass AI generation for that scene. */
const OVERRIDE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export type SceneImageMap = Record<string, string>; // sceneId → relative path from outputDir

export interface GenerateSceneImagesArgs {
  script: Script;
  outputDir: string;
  config: ImageGenConfig;
  /** If hook scene already has an og:image at this rel path, skip AI gen for hook. */
  hookOgImageRelPath: string | null;
}

export async function generateSceneImages(
  args: GenerateSceneImagesArgs,
): Promise<SceneImageMap> {
  const { script, outputDir, config, hookOgImageRelPath } = args;
  const map: SceneImageMap = {};

  // og:image still wins for hook — pre-populate map.
  if (hookOgImageRelPath) {
    const hookScene = script.scenes.find((s) => s.type === "hook");
    if (hookScene) map[hookScene.id] = hookOgImageRelPath;
  }

  // PASS 1 — manual overrides for ALL image-eligible scenes, regardless of
  // whether the scene has an imagePrompt. A staged image at
  // `images/<sceneId>.{png,jpg,jpeg,webp}` short-circuits any further work
  // for that scene. (Previously this only ran on scenes with imagePrompt,
  // which silently dropped staged images for prompt-less scenes — feedback
  // 2026-05-26 "Mất ảnh".)
  const eligibleScenes = script.scenes.filter((s) => {
    if (!IMAGE_TEMPLATES.has(s.templateData.template)) return false;
    if (s.type === "hook" && hookOgImageRelPath) return false; // already mapped
    return true;
  });
  for (const scene of eligibleScenes) {
    if (map[scene.id]) continue; // already set (e.g. hook og:image)
    const overrideRel = findOverride(outputDir, scene.id);
    if (overrideRel) {
      map[scene.id] = overrideRel;
      log.info(`    scene ${scene.id}: MANUAL OVERRIDE → ${overrideRel}`);
    }
  }

  // PASS 2 — AI generation, only for scenes with imagePrompt that didn't
  // get a manual override above.
  const remaining = eligibleScenes.filter(
    (s) => !map[s.id] && s.imagePrompt,
  );

  if (remaining.length === 0) {
    const overrideCount = eligibleScenes.filter((s) => map[s.id]).length;
    const withPrompt = eligibleScenes.filter((s) => s.imagePrompt).length;
    if (overrideCount === 0 && withPrompt === 0) {
      log.info("  AI image gen: no eligible scenes (none have imagePrompt or manual override)");
    } else if (overrideCount > 0 && withPrompt === overrideCount) {
      log.info(`  AI image gen: all ${overrideCount} scene(s) covered by manual overrides`);
    } else {
      log.info(`  AI image gen: ${overrideCount} manual override(s), no remaining AI work`);
    }
    return map;
  }

  if (!config.enabled) {
    const expectedKey =
      config.provider === "openai"
        ? "OPENAI_API_KEY"
        : config.provider === "gemini"
          ? "GEMINI_API_KEY"
          : "XAI_API_KEY";
    log.info(`  AI image gen: disabled (${expectedKey} not set for IMAGE_PROVIDER=${config.provider}) → gradient fallback for ${remaining.length} scene(s)`);
    return map;
  }

  const provider: ImageProvider =
    config.provider === "gemini"
      ? createGeminiImageProvider({ apiKey: config.geminiApiKey!, model: config.geminiModel })
      : config.provider === "xai"
        ? createXAIImageProvider({
            apiKey: config.xaiApiKey!,
            model: config.xaiModel,
            resolution: config.xaiResolution,
          })
        : createOpenAIImageProvider({ apiKey: config.openaiApiKey!, model: config.openaiModel });

  const activeModel =
    config.provider === "gemini"
      ? config.geminiModel
      : config.provider === "xai"
        ? `${config.xaiModel} (${config.xaiResolution})`
        : config.openaiModel;
  log.info(`  AI image gen: ${remaining.length} scene(s) via ${provider.name} ${activeModel}`);

  const limit = pLimit(IMAGE_CONCURRENCY);
  const results = await Promise.all(
    remaining.map((scene) =>
      limit(async () => {
        const hash = shortHash(scene.imagePrompt!);
        const fileName = `${scene.id}-${hash}.png`;
        const relPath = `images/${fileName}`;
        const absPath = join(outputDir, relPath);
        const t0 = Date.now();
        const r = await provider.generate({
          prompt: scene.imagePrompt!,
          outPath: absPath,
          quality: config.quality,
        });
        return { scene, relPath, result: r, ms: Date.now() - t0 };
      }),
    ),
  );

  for (const { scene, relPath, result, ms } of results) {
    if (result.success) {
      map[scene.id] = relPath;
      const tag = result.cached ? "CACHED" : `${(ms / 1000).toFixed(1)}s`;
      log.info(`    scene ${scene.id}: ${tag} → ${relPath}`);
    } else {
      log.warn(`    scene ${scene.id}: image gen failed (${result.reason}) → gradient fallback`);
    }
  }

  return map;
}

function findOverride(outputDir: string, sceneId: string): string | null {
  for (const ext of OVERRIDE_EXTENSIONS) {
    const rel = `images/${sceneId}${ext}`;
    if (existsSync(join(outputDir, rel))) return rel;
  }
  return null;
}

function shortHash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

// Re-exports for callers that need the types.
export type { ImageProvider, GenerateResult } from "./provider.js";
