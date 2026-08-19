import type { ImageQuality } from "../config.js";
import type { Aspect } from "../render/script-schema.js";

export interface GenerateImageArgs {
  prompt: string;
  outPath: string;
  quality: ImageQuality;
  /**
   * Orientation to request from the provider — matches the video's canvas so a
   * landscape video doesn't get portrait fill. Defaults to "9:16".
   */
  aspect?: Aspect;
}

export type GenerateResult =
  | { success: true; path: string; cached: boolean }
  | { success: false; reason: string };

export interface ImageProvider {
  /** Provider name for logs (e.g. "openai") */
  readonly name: string;
  generate(args: GenerateImageArgs): Promise<GenerateResult>;
}
