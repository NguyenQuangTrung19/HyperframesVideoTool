import type { ImageQuality } from "../config.js";

export interface GenerateImageArgs {
  prompt: string;
  outPath: string;
  quality: ImageQuality;
}

export type GenerateResult =
  | { success: true; path: string; cached: boolean }
  | { success: false; reason: string };

export interface ImageProvider {
  /** Provider name for logs (e.g. "openai") */
  readonly name: string;
  generate(args: GenerateImageArgs): Promise<GenerateResult>;
}
