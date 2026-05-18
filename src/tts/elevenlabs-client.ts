import axios, { AxiosError } from "axios";
import { writeFile } from "node:fs/promises";
import type { TtsClient } from "./tts-client.js";

export interface ElevenLabsOpts {
  apiKey: string;
  voiceId: string;
  modelId: string;
  endpoint: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ElevenLabsClient implements TtsClient {
  constructor(private cfg: ElevenLabsOpts) {}

  async generate(text: string, audioOutPath: string, _srtOutPath?: string): Promise<void> {
    await this.synthesizeWithRetry(text, audioOutPath);
  }

  private async synthesizeWithRetry(text: string, outPath: string): Promise<void> {
    const delays = [1000, 2000, 4000];
    let lastErr: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const url = `${this.cfg.endpoint}/text-to-speech/${this.cfg.voiceId}`;
        const resp = await axios.post<ArrayBuffer>(
          url,
          {
            text,
            model_id: this.cfg.modelId,
            voice_settings: {
              stability: this.cfg.stability ?? 0.5,
              similarity_boost: this.cfg.similarityBoost ?? 0.75,
              style: this.cfg.style ?? 0.0,
              use_speaker_boost: this.cfg.useSpeakerBoost ?? true,
            },
          },
          {
            headers: {
              "xi-api-key": this.cfg.apiKey,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg",
            },
            responseType: "arraybuffer",
            timeout: 120000,
          },
        );
        await writeFile(outPath, Buffer.from(resp.data));
        return;
      } catch (e) {
        lastErr = e;
        const err = e as AxiosError;
        const status = err.response?.status;
        const retryable = status === undefined || status === 429 || status >= 500;
        if (!retryable || attempt === delays.length) {
          let detail = err.message;
          if (err.response?.data) {
            try {
              const body = err.response.data instanceof ArrayBuffer
                ? Buffer.from(err.response.data).toString("utf8")
                : String(err.response.data);
              const parsed = JSON.parse(body);
              detail = parsed?.detail?.message ?? parsed?.detail ?? detail;
            } catch { /* ignore parse errors */ }
          }
          throw new Error(`ElevenLabs TTS failed (status ${status ?? "?"}): ${detail}`);
        }
        await sleep(delays[attempt]);
      }
    }
    throw lastErr;
  }
}
