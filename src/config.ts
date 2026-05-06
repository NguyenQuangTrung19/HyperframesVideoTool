import "dotenv/config";

export type TtsProvider = "lucylab" | "elevenlabs";

export interface TiktokConfig {
  displayName: string;
  handle: string;
  followers: string;
  /** URL to download avatar JPG. If undefined, the bundled `assets/avatar.jpg` is used. */
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

  // LucyLab
  lucylabApiKey?: string;
  lucylabVoiceId?: string;
  lucylabEndpoint: string;
  lucylabPollIntervalMs: number;
  lucylabPollTimeoutMs: number;

  // ElevenLabs
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  elevenlabsModelId: string;
  elevenlabsEndpoint: string;

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

export function loadConfig(): Config {
  const provider = (process.env.TTS_PROVIDER ?? "lucylab") as TtsProvider;
  if (provider !== "lucylab" && provider !== "elevenlabs") {
    throw new Error(`TTS_PROVIDER must be "lucylab" or "elevenlabs", got "${provider}"`);
  }

  // Validate provider-specific required vars
  if (provider === "lucylab") {
    if (!process.env.VIETNAMESE_API_KEY || process.env.VIETNAMESE_API_KEY.trim() === "") {
      throw new Error(
        `Missing VIETNAMESE_API_KEY (required when TTS_PROVIDER=lucylab). ` +
        `Copy .env.example to .env.local and fill in your LucyLab API key.`
      );
    }
    if (!process.env.VIETNAMESE_VOICEID || process.env.VIETNAMESE_VOICEID.trim() === "") {
      throw new Error(
        `Missing VIETNAMESE_VOICEID (required when TTS_PROVIDER=lucylab). ` +
        `Copy .env.example to .env.local and fill in your LucyLab voice ID.`
      );
    }
  } else {
    if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.trim() === "") {
      throw new Error(
        `Missing ELEVENLABS_API_KEY (required when TTS_PROVIDER=elevenlabs). ` +
        `Copy .env.example to .env.local and fill in your ElevenLabs API key.`
      );
    }
    if (!process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID.trim() === "") {
      throw new Error(
        `Missing ELEVENLABS_VOICE_ID (required when TTS_PROVIDER=elevenlabs). ` +
        `Copy .env.example to .env.local and fill in your ElevenLabs voice ID.`
      );
    }
  }

  return {
    ttsProvider: provider,
    lucylabApiKey: process.env.VIETNAMESE_API_KEY,
    lucylabVoiceId: process.env.VIETNAMESE_VOICEID,
    lucylabEndpoint: process.env.LUCYLAB_ENDPOINT ?? "https://api.lucylab.io/json-rpc",
    lucylabPollIntervalMs: intDefault("LUCYLAB_POLL_INTERVAL_MS", 2000),
    lucylabPollTimeoutMs: intDefault("LUCYLAB_POLL_TIMEOUT_MS", 120000),
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
    elevenlabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    elevenlabsEndpoint: process.env.ELEVENLABS_ENDPOINT ?? "https://api.elevenlabs.io/v1",
    tiktok: {
      displayName: process.env.TIKTOK_DISPLAY_NAME ?? "Bóng lăn",
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
