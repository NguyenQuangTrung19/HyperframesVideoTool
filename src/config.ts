import "dotenv/config";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type TtsProvider = "vieneu" | "ausynclab";

export interface TiktokConfig {
  displayName: string;
  handle: string;
  followers: string;
  /** URL to download avatar image. If undefined, the bundled `assets/logoTV.png` is used. */
  avatarUrl?: string;
}

export type ImageQuality = "low" | "medium" | "high" | "auto";
export type ImageProviderName = "openai" | "gemini" | "xai";
export type XAIResolution = "1k" | "2k";

export interface ImageGenConfig {
  /** Active provider, default "openai" */
  provider: ImageProviderName;
  /** OpenAI API key — required when provider="openai" */
  openaiApiKey?: string;
  /** OpenAI model id, default "gpt-image-1" */
  openaiModel: string;
  /** Gemini API key — required when provider="gemini" (free tier on AI Studio) */
  geminiApiKey?: string;
  /** Gemini model id, default "gemini-2.5-flash-image" */
  geminiModel: string;
  /** xAI API key — required when provider="xai" (console.x.ai, pay-per-use credits) */
  xaiApiKey?: string;
  /** xAI model id, default "grok-imagine-image-quality" */
  xaiModel: string;
  /** xAI resolution (xAI only), default "1k" */
  xaiResolution: XAIResolution;
  /** Quality preset (OpenAI only — Gemini/xAI ignore), default "medium" */
  quality: ImageQuality;
  /** Whether AI image generation is enabled (true iff active provider's key is set). */
  enabled: boolean;
}

export interface Config {
  ttsProvider: TtsProvider;

  // VieNeu (local Python TTS — default, free)
  vieneuProjectDir: string;
  vieneuWorkerScript: string;
  vieneuVoiceId: string;
  vieneuEmotion: string;
  vieneuUvBin: string;

  // AusyncLab (paid, Vietnamese voice library + cloning)
  ausynclabApiKey?: string;
  ausynclabVoiceId?: number;
  ausynclabModelName: string;
  ausynclabSpeed: number;
  ausynclabBaseUrl: string;
  ausynclabPollIntervalMs: number;
  ausynclabPollTimeoutMs: number;

  // TikTok follow card (outro)
  tiktok: TiktokConfig;

  // AI scene image generation (optional)
  image: ImageGenConfig;

  ttsConcurrency: number;
}

function intDefault(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`Env var ${name} must be integer, got "${v}"`);
  return n;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

/** Best-effort uv binary lookup — env override → user-local bin → fall back to PATH. */
function findUvBin(): string {
  if (process.env.UV_BIN) return process.env.UV_BIN;
  const userBin = join(homedir(), ".local", "bin", process.platform === "win32" ? "uv.exe" : "uv");
  if (existsSync(userBin)) return userBin;
  return "uv";
}

export function loadConfig(): Config {
  const provider = (process.env.TTS_PROVIDER ?? "vieneu") as TtsProvider;
  if (provider !== "vieneu" && provider !== "ausynclab") {
    throw new Error(`TTS_PROVIDER must be "vieneu" or "ausynclab", got "${provider}"`);
  }

  // Validate provider-specific required vars
  const vieneuProjectDir =
    process.env.VIENEU_PROJECT_DIR?.trim() || join(PROJECT_ROOT, "..", "VieNeu-TTS");
  const vieneuWorkerScript = join(PROJECT_ROOT, "scripts", "vieneu_worker.py");

  if (provider === "vieneu") {
    if (!existsSync(vieneuProjectDir)) {
      throw new Error(
        `VieNeu project dir not found at ${vieneuProjectDir}. ` +
        `Clone https://github.com/pnnbao97/VieNeu-TTS and either place it next to this repo ` +
        `or set VIENEU_PROJECT_DIR in .env.local to its absolute path.`
      );
    }
    if (!existsSync(vieneuWorkerScript)) {
      throw new Error(`VieNeu worker script missing at ${vieneuWorkerScript}`);
    }
  } else {
    // ausynclab
    if (!process.env.AUSYNCLAB_API_KEY || process.env.AUSYNCLAB_API_KEY.trim() === "") {
      throw new Error(
        `Missing AUSYNCLAB_API_KEY (required when TTS_PROVIDER=ausynclab). ` +
        `Get one at https://ausynclab.io dashboard.`
      );
    }
    if (!process.env.AUSYNCLAB_VOICE_ID || process.env.AUSYNCLAB_VOICE_ID.trim() === "") {
      throw new Error(
        `Missing AUSYNCLAB_VOICE_ID (required when TTS_PROVIDER=ausynclab). ` +
        `Pick a voice at https://ausynclab.io/voices, click "Use", then copy the numeric ID.`
      );
    }
  }

  return {
    ttsProvider: provider,

    vieneuProjectDir,
    vieneuWorkerScript,
    vieneuVoiceId: process.env.VIENEU_VOICE_ID?.trim() || "Binh",
    vieneuEmotion: process.env.VIENEU_EMOTION?.trim() || "natural",
    vieneuUvBin: findUvBin(),

    ausynclabApiKey: process.env.AUSYNCLAB_API_KEY,
    ausynclabVoiceId: process.env.AUSYNCLAB_VOICE_ID
      ? parseInt(process.env.AUSYNCLAB_VOICE_ID, 10)
      : undefined,
    ausynclabModelName: process.env.AUSYNCLAB_MODEL_NAME?.trim() || "myna-1-turbo",
    ausynclabSpeed: parseFloat(process.env.AUSYNCLAB_SPEED ?? "1.0"),
    ausynclabBaseUrl: process.env.AUSYNCLAB_BASE_URL ?? "https://api.ausynclab.io/api/v1",
    ausynclabPollIntervalMs: intDefault("AUSYNCLAB_POLL_INTERVAL_MS", 2000),
    ausynclabPollTimeoutMs: intDefault("AUSYNCLAB_POLL_TIMEOUT_MS", 180000),

    tiktok: {
      displayName: process.env.TIKTOK_DISPLAY_NAME ?? "SportsForAllTV",
      handle: process.env.TIKTOK_HANDLE ?? "@bonglan0702",
      followers: process.env.TIKTOK_FOLLOWERS ?? "1.2M followers",
      avatarUrl: process.env.TIKTOK_AVATAR_URL || undefined,
    },
    image: parseImageConfig(),
    ttsConcurrency: intDefault("TTS_CONCURRENCY", 1),
  };
}

function parseImageConfig(): ImageGenConfig {
  const rawProvider = (process.env.IMAGE_PROVIDER ?? "openai").toLowerCase();
  if (rawProvider !== "openai" && rawProvider !== "gemini" && rawProvider !== "xai") {
    throw new Error(`IMAGE_PROVIDER must be "openai", "gemini", or "xai", got "${rawProvider}"`);
  }
  const provider = rawProvider as ImageProviderName;
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const xaiApiKey = process.env.XAI_API_KEY?.trim() || undefined;
  const rawQuality = (process.env.IMAGE_QUALITY ?? "medium").toLowerCase();
  if (!["low", "medium", "high", "auto"].includes(rawQuality)) {
    throw new Error(`IMAGE_QUALITY must be one of low|medium|high|auto, got "${rawQuality}"`);
  }
  const rawResolution = (process.env.XAI_IMAGE_RESOLUTION ?? "1k").toLowerCase();
  if (rawResolution !== "1k" && rawResolution !== "2k") {
    throw new Error(`XAI_IMAGE_RESOLUTION must be "1k" or "2k", got "${rawResolution}"`);
  }
  const activeKey =
    provider === "openai" ? openaiApiKey : provider === "gemini" ? geminiApiKey : xaiApiKey;
  return {
    provider,
    openaiApiKey,
    openaiModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    geminiApiKey,
    geminiModel: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
    xaiApiKey,
    xaiModel: process.env.XAI_IMAGE_MODEL ?? "grok-imagine-image-quality",
    xaiResolution: rawResolution as XAIResolution,
    quality: rawQuality as ImageQuality,
    enabled: !!activeKey,
  };
}
