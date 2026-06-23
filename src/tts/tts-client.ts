/**
 * Common TTS client interface.
 *
 * Providers: VieNeu (local, free, default) and AusyncLab (paid, premium
 * Vietnamese voice library). The pipeline picks the active provider via
 * TTS_PROVIDER env.
 */
export interface TtsClient {
  /**
   * Generate speech audio for `text` and write to `audioOutPath` (mp3).
   * If `srtOutPath` is provided AND the provider supports subtitles,
   * write the SRT to that path. Otherwise silently skip.
   */
  generate(text: string, audioOutPath: string, srtOutPath?: string): Promise<void>;
  /**
   * Optional teardown (e.g. close subprocess workers). Pipeline calls this
   * in a finally{} block. Implementors must be idempotent.
   */
  dispose?(): Promise<void>;
}

import type { Config } from "../config.js";
import { AusynclabClient } from "./ausynclab-client.js";
import { FptaiClient } from "./fptai-client.js";
import { VbeeClient } from "./vbee-client.js";
import { VieNeuClient } from "./vieneu-client.js";

export function createTtsClient(cfg: Config): TtsClient {
  switch (cfg.ttsProvider) {
    case "vieneu":
      return new VieNeuClient({
        projectDir: cfg.vieneuProjectDir,
        workerScript: cfg.vieneuWorkerScript,
        voiceId: cfg.vieneuVoiceId,
        emotion: cfg.vieneuEmotion,
        uvBin: cfg.vieneuUvBin,
      });
    case "ausynclab":
      return new AusynclabClient({
        apiKey: cfg.ausynclabApiKey!,
        voiceId: cfg.ausynclabVoiceId!,
        modelName: cfg.ausynclabModelName,
        speed: cfg.ausynclabSpeed,
        baseUrl: cfg.ausynclabBaseUrl,
        pollIntervalMs: cfg.ausynclabPollIntervalMs,
        pollTimeoutMs: cfg.ausynclabPollTimeoutMs,
      });
    case "fptai":
      return new FptaiClient({
        apiKey: cfg.fptaiApiKey!,
        voice: cfg.fptaiVoice,
        speed: cfg.fptaiSpeed,
        baseUrl: cfg.fptaiBaseUrl,
        pollIntervalMs: cfg.fptaiPollIntervalMs,
        pollTimeoutMs: cfg.fptaiPollTimeoutMs,
      });
    case "vbee":
      return new VbeeClient({
        accessToken: cfg.vbeeAccessToken!,
        appId: cfg.vbeeAppId!,
        voiceCode: cfg.vbeeVoiceCode,
        speedRate: cfg.vbeeSpeedRate,
        bitrate: cfg.vbeeBitrate,
        callbackUrl: cfg.vbeeCallbackUrl,
        baseUrl: cfg.vbeeBaseUrl,
        pollIntervalMs: cfg.vbeePollIntervalMs,
        pollTimeoutMs: cfg.vbeePollTimeoutMs,
      });
    case "manual":
      // Manual mode supplies a pre-recorded audio file instead of calling any
      // TTS API — the pipeline routes it through the full-text align path and
      // never constructs a client. Reaching here means a code path tried to.
      throw new Error(
        'TTS_PROVIDER=manual does not use a TTS client. Drop a voice file next to script.json instead.',
      );
    default: {
      const _never: never = cfg.ttsProvider;
      throw new Error(`Unknown TTS provider: ${_never}`);
    }
  }
}
