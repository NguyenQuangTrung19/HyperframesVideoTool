import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { loadConfig } from "./config.js";

const ENV_KEYS = [
  "TTS_PROVIDER",
  "VIENEU_PROJECT_DIR",
  "VIENEU_VOICE_ID",
  "VIENEU_EMOTION",
  "AUSYNCLAB_API_KEY",
  "AUSYNCLAB_VOICE_ID",
  "AUSYNCLAB_MODEL_NAME",
  "AUSYNCLAB_SPEED",
  "TTS_CONCURRENCY",
];

describe("loadConfig", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
    // Point VieNeu at any existing dir so the existence check passes —
    // the actual project structure isn't validated by loadConfig.
    process.env.VIENEU_PROJECT_DIR = tmpdir();
  });

  afterEach(() => {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  describe("VieNeu provider (default)", () => {
    it("uses VieNeu when no provider specified", () => {
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("vieneu");
      expect(cfg.vieneuVoiceId).toBe("Binh");
      expect(cfg.vieneuEmotion).toBe("natural");
    });

    it("respects VIENEU_VOICE_ID and VIENEU_EMOTION overrides", () => {
      process.env.VIENEU_VOICE_ID = "Tuyen";
      process.env.VIENEU_EMOTION = "storytelling";
      const cfg = loadConfig();
      expect(cfg.vieneuVoiceId).toBe("Tuyen");
      expect(cfg.vieneuEmotion).toBe("storytelling");
    });

    it("throws when VIENEU_PROJECT_DIR points at a missing dir", () => {
      process.env.VIENEU_PROJECT_DIR = "C:/this/path/does/not/exist/vieneu-xxx";
      expect(() => loadConfig()).toThrow(/VieNeu project dir not found/);
    });
  });

  describe("AusyncLab provider", () => {
    it("reads AusyncLab env vars when TTS_PROVIDER=ausynclab", () => {
      process.env.TTS_PROVIDER = "ausynclab";
      process.env.AUSYNCLAB_API_KEY = "ak_test_abc";
      process.env.AUSYNCLAB_VOICE_ID = "1234567";
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("ausynclab");
      expect(cfg.ausynclabApiKey).toBe("ak_test_abc");
      expect(cfg.ausynclabVoiceId).toBe(1234567);
    });

    it("throws when AUSYNCLAB_API_KEY missing", () => {
      process.env.TTS_PROVIDER = "ausynclab";
      process.env.AUSYNCLAB_VOICE_ID = "1234567";
      expect(() => loadConfig()).toThrow(/AUSYNCLAB_API_KEY/);
    });

    it("uses sensible defaults for optional vars", () => {
      process.env.TTS_PROVIDER = "ausynclab";
      process.env.AUSYNCLAB_API_KEY = "k";
      process.env.AUSYNCLAB_VOICE_ID = "1";
      const cfg = loadConfig();
      expect(cfg.ausynclabModelName).toBe("myna-1-turbo");
      expect(cfg.ausynclabSpeed).toBe(1.0);
      expect(cfg.ausynclabBaseUrl).toBe("https://api.ausynclab.io/api/v1");
      expect(cfg.ttsConcurrency).toBe(1);
    });
  });

  it("rejects invalid TTS_PROVIDER", () => {
    process.env.TTS_PROVIDER = "lucylab";
    expect(() => loadConfig()).toThrow(/TTS_PROVIDER/);
  });
});
