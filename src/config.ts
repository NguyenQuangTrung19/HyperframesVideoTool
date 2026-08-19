import "dotenv/config";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type TtsProvider = "vieneu" | "ausynclab" | "fptai" | "vbee" | "manual";

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

  // FPT.AI (cheap Vietnamese TTS, pay-per-character)
  fptaiApiKey?: string;
  fptaiVoice: string;
  fptaiSpeed: number;
  fptaiBaseUrl: string;
  fptaiPollIntervalMs: number;
  fptaiPollTimeoutMs: number;

  // VBee AIVoice (natural Vietnamese voices, pay-per-use)
  vbeeAccessToken?: string;
  vbeeAppId?: string;
  vbeeVoiceCode: string;
  vbeeSpeedRate: string;
  vbeeBitrate: number;
  vbeeCallbackUrl: string;
  vbeeBaseUrl: string;
  vbeePollIntervalMs: number;
  vbeePollTimeoutMs: number;

  // TikTok follow card (outro)
  tiktok: TiktokConfig;

  // AI scene image generation (optional)
  image: ImageGenConfig;

  ttsConcurrency: number;

  // Hyperframes render workers — "auto" lets calibration decide (conservative,
  // often drops to 1 worker on heavy compositions); a number forces a fixed
  // count (6 = trần của hyperframes). Trên máy 12 luồng + HF_ANGLE_BACKEND=d3d11,
  // 6 workers nhanh hơn 4 khoảng 9%. Default: "auto".
  hyperframesWorkers: number | "auto";

  // Hyperframes GPU encoding (NVENC). Requires NVIDIA driver >= 570.0. Falls
  // back to libx264 if disabled. Default: false.
  hyperframesGpu: boolean;

  // Hyperframes capture frame rate. Frame count (and thus render time + CPU
  // load) scales linearly with this — 24 cuts ~20% off the default 30, and
  // captions/animations still read smooth on TikTok. Default: 30.
  hyperframesFps: number;

  // Hyperframes encoder quality preset → output bitrate / compression effort.
  // "high" = higher bitrate, fewer compression artifacts (crisper hero images,
  // cleaner gradients/motion) at the cost of larger files + slightly slower
  // encode. Default: "high". Set RENDER_QUALITY=standard to render lighter/faster.
  hyperframesQuality: "draft" | "standard" | "high";
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
  if (provider !== "vieneu" && provider !== "ausynclab" && provider !== "fptai" && provider !== "vbee" && provider !== "manual") {
    throw new Error(`TTS_PROVIDER must be "vieneu", "ausynclab", "fptai", "vbee", or "manual", got "${provider}"`);
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
  } else if (provider === "ausynclab") {
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
  } else if (provider === "fptai") {
    if (!process.env.FPTAI_API_KEY || process.env.FPTAI_API_KEY.trim() === "") {
      throw new Error(
        `Missing FPTAI_API_KEY (required when TTS_PROVIDER=fptai). ` +
        `Get one at https://console.fpt.ai (Text to Speech app).`
      );
    }
  } else if (provider === "vbee") {
    if (!process.env.VBEE_ACCESS_TOKEN || process.env.VBEE_ACCESS_TOKEN.trim() === "") {
      throw new Error(
        `Missing VBEE_ACCESS_TOKEN (required when TTS_PROVIDER=vbee). ` +
        `Get it from the VBee AIVoice dashboard (https://aivoice.vbee.vn).`
      );
    }
    if (!process.env.VBEE_APP_ID || process.env.VBEE_APP_ID.trim() === "") {
      throw new Error(
        `Missing VBEE_APP_ID (required when TTS_PROVIDER=vbee). ` +
        `Get it from the VBee AIVoice dashboard.`
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
    ausynclabPollTimeoutMs: intDefault("AUSYNCLAB_POLL_TIMEOUT_MS", 600000),

    fptaiApiKey: process.env.FPTAI_API_KEY,
    fptaiVoice: process.env.FPTAI_VOICE?.trim() || "leminh",
    fptaiSpeed: parseFloat(process.env.FPTAI_SPEED ?? "0"),
    fptaiBaseUrl: process.env.FPTAI_BASE_URL ?? "https://api.fpt.ai",
    fptaiPollIntervalMs: intDefault("FPTAI_POLL_INTERVAL_MS", 3000),
    fptaiPollTimeoutMs: intDefault("FPTAI_POLL_TIMEOUT_MS", 180000),

    vbeeAccessToken: process.env.VBEE_ACCESS_TOKEN,
    vbeeAppId: process.env.VBEE_APP_ID,
    vbeeVoiceCode: process.env.VBEE_VOICE_CODE?.trim() || "hn_male_manhdung_news_48k-fhg",
    vbeeSpeedRate: process.env.VBEE_SPEED_RATE?.trim() || "1.0",
    vbeeBitrate: intDefault("VBEE_BITRATE", 128),
    vbeeCallbackUrl: process.env.VBEE_CALLBACK_URL?.trim() || "https://example.com/vbee-callback",
    vbeeBaseUrl: process.env.VBEE_BASE_URL ?? "https://vbee.vn/api/v1",
    vbeePollIntervalMs: intDefault("VBEE_POLL_INTERVAL_MS", 3000),
    vbeePollTimeoutMs: intDefault("VBEE_POLL_TIMEOUT_MS", 180000),

    tiktok: {
      displayName: process.env.TIKTOK_DISPLAY_NAME ?? "SportsForAllTV",
      handle: process.env.TIKTOK_HANDLE ?? "@bonglan0702",
      followers: process.env.TIKTOK_FOLLOWERS ?? "1.2M followers",
      avatarUrl: process.env.TIKTOK_AVATAR_URL || undefined,
    },
    image: parseImageConfig(),
    ttsConcurrency: intDefault("TTS_CONCURRENCY", 1),
    hyperframesWorkers: parseHyperframesWorkers(),
    hyperframesGpu: (process.env.HYPERFRAMES_GPU ?? "").toLowerCase() === "true",
    hyperframesFps: parseRenderFps(),
    hyperframesQuality: parseRenderQuality(),
  };
}

function parseRenderQuality(): "draft" | "standard" | "high" {
  const raw = (process.env.RENDER_QUALITY ?? "high").toLowerCase();
  if (raw !== "draft" && raw !== "standard" && raw !== "high") {
    throw new Error(`RENDER_QUALITY must be one of draft|standard|high, got "${raw}"`);
  }
  return raw;
}

function parseRenderFps(): number {
  const raw = process.env.RENDER_FPS;
  if (!raw) return 30;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 12 || n > 60) {
    throw new Error(`RENDER_FPS must be an integer between 12 and 60, got "${raw}"`);
  }
  return n;
}

function parseHyperframesWorkers(): number | "auto" {
  const raw = process.env.HYPERFRAMES_WORKERS;
  if (!raw || raw.toLowerCase() === "auto") return "auto";
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) {
    throw new Error(`HYPERFRAMES_WORKERS must be "auto" or a positive integer, got "${raw}"`);
  }
  return n;
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
