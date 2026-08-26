import axios, { AxiosError } from "axios";
import { writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { TtsClient } from "./tts-client.js";

export interface FptaiOpts {
  apiKey: string;
  /** FPT voice id, e.g. "leminh", "banmai", "lannhi", "giahuy", "thuminh", "myan", "linhsan". */
  voice: string;
  /** -3..3, 0 = normal rate. */
  speed: number;
  baseUrl: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}

/** POST /hmi/tts/v5 response — the synthesized file lands at `async` (ready in 5s–2min). */
interface SubmitResp {
  async: string;
  error: number;
  message?: string;
  request_id?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * FPT.AI Text-to-Speech (https://fpt.ai/tts) — cheap Vietnamese TTS, pay per
 * character. Two-step async flow: POST the raw text → get an `async` audio URL,
 * then poll that URL with GET until the mp3 is ready (5s–2min per the docs).
 * Returns mp3 directly (format=mp3), so no WAV conversion needed.
 */
export class FptaiClient implements TtsClient {
  constructor(private cfg: FptaiOpts) {}

  async generate(text: string, audioOutPath: string, _srtOutPath?: string): Promise<void> {
    const asyncUrl = await this.submitWithRetry(text);
    const audio = await this.pollUntilReady(asyncUrl);
    await writeFile(resolvePath(audioOutPath), audio);
    // FPT.AI v5 does not return word-level subtitles in this flow; the pipeline
    // aligns with Whisper afterwards, so we intentionally skip srtOutPath.
  }

  private async submitWithRetry(text: string): Promise<string> {
    const headers = {
      "api_key": this.cfg.apiKey,
      "voice": this.cfg.voice,
      "speed": String(this.cfg.speed),
      "format": "mp3",
      "Content-Type": "text/plain; charset=utf-8",
    };

    const delays = [1000, 2000, 4000];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const resp = await axios.post<SubmitResp>(
          `${this.cfg.baseUrl}/hmi/tts/v5`,
          text,
          { headers, timeout: 30_000 },
        );
        if (resp.data.error && resp.data.error !== 0) {
          throw new Error(
            `FPT.AI TTS submit error ${resp.data.error}: ${resp.data.message ?? "unknown"}`,
          );
        }
        if (!resp.data.async) {
          throw new Error(`FPT.AI TTS submit returned no async URL (message: ${resp.data.message ?? "none"})`);
        }
        return resp.data.async;
      } catch (e) {
        lastErr = e;
        const ax = e as AxiosError;
        const status = ax.response?.status;
        if (status === 401 || status === 403) {
          throw new Error(
            "FPT.AI TTS rejected the API key (401/403). Check FPTAI_API_KEY in .env.local " +
            "(get one at https://console.fpt.ai).",
          );
        }
        // 429 (rate/quota) and 5xx and network errors are retryable.
        const retryable = status === undefined || status === 429 || status >= 500;
        if (!retryable || attempt === 3) break;
        await sleep(delays[attempt]);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`FPT.AI TTS submit failed: ${String(lastErr)}`);
  }

  /** GET the async URL until the mp3 is ready (non-200 / tiny body = not ready yet). */
  private async pollUntilReady(url: string): Promise<Buffer> {
    const deadline = Date.now() + this.cfg.pollTimeoutMs;
    let lastStatus = 0;
    // Small initial wait — the file is never ready instantly.
    await sleep(this.cfg.pollIntervalMs);
    while (Date.now() < deadline) {
      try {
        const resp = await axios.get<ArrayBuffer>(url, {
          responseType: "arraybuffer",
          timeout: 30_000,
          validateStatus: () => true, // handle 404 (not-ready) ourselves
        });
        lastStatus = resp.status;
        const ct = String(resp.headers["content-type"] ?? "");
        const buf = Buffer.from(resp.data);
        const looksAudio = ct.includes("audio") || ct.includes("octet-stream") || ct.includes("mpeg");
        // Ready when 200 + audio-ish content-type + non-trivial size.
        if (resp.status === 200 && looksAudio && buf.byteLength > 2000) {
          return buf;
        }
      } catch {
        // transient network blip — keep polling
      }
      await sleep(this.cfg.pollIntervalMs);
    }
    throw new Error(
      `FPT.AI TTS audio not ready within ${Math.round(this.cfg.pollTimeoutMs / 1000)}s ` +
      `(last status ${lastStatus}). URL: ${url}`,
    );
  }
}
