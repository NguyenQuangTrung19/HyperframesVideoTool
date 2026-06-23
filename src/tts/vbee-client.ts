import axios, { AxiosError } from "axios";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { TtsClient } from "./tts-client.js";

export interface VbeeOpts {
  /** Access token (Bearer) from the VBee AIVoice dashboard. */
  accessToken: string;
  /** Application id from the VBee dashboard. */
  appId: string;
  /** Voice code, e.g. "hn_male_manhdung_news_48k-fhg". Pick from the dashboard. */
  voiceCode: string;
  /** "1.0" = normal; VBee accepts a string rate (e.g. "0.9", "1.1"). */
  speedRate: string;
  bitrate: number;
  /**
   * VBee REQUIRES a non-empty valid callback_url even when polling — passing ""
   * fails validation. We don't run a webhook, so this is a harmless placeholder
   * URL; the result is fetched by polling GET /tts/{request_id} instead.
   */
  callbackUrl: string;
  baseUrl: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}

/** POST /tts → returns a request_id we then poll. */
interface SubmitResp {
  status?: number;
  result?: { request_id?: string } | string;
  request_id?: string;
  message?: string;
  error_code?: string;
  error_message?: string;
}

/** GET /tts/{request_id} → audio_link appears once status is SUCCESS. */
interface StatusResp {
  status?: number;
  result?: {
    request_id?: string;
    status?: string; // IN_PROGRESS | SUCCESS | FAILURE (varies by account)
    audio_link?: string;
  };
  message?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * VBee AIVoice TTS (https://vbee.vn) — natural Vietnamese voices, pay-per-use.
 * Two-step async flow: POST text → request_id, poll GET /tts/{request_id} until
 * SUCCESS + audio_link, then download the mp3.
 *
 * Built against the public AIVoice Studio API shape. Base URL / voice / speed
 * are env-configurable so the contract can be tuned if a given account differs.
 */
export class VbeeClient implements TtsClient {
  constructor(private cfg: VbeeOpts) {}

  async generate(text: string, audioOutPath: string, _srtOutPath?: string): Promise<void> {
    const requestId = await this.submitWithRetry(text);
    const audioUrl = await this.pollUntilDone(requestId);
    const resp = await axios.get<ArrayBuffer>(audioUrl, { responseType: "arraybuffer", timeout: 60_000 });
    const buf = Buffer.from(resp.data);
    const absMp3 = resolvePath(audioOutPath);

    // VBee may return WAV (even when mp3 is requested). The pipeline expects mp3,
    // so convert when the delivered file is WAV; otherwise write the mp3 directly.
    if (/\.wav(\?|$)/i.test(audioUrl)) {
      const wavPath = absMp3.replace(/\.mp3$/i, ".wav");
      await writeFile(wavPath, buf);
      await convertWavToMp3(wavPath, absMp3);
      try { await unlink(wavPath); } catch { /* best-effort cleanup */ }
    } else {
      await writeFile(absMp3, buf);
    }
    // VBee returns no word-level subtitles here; pipeline aligns with Whisper after.
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.cfg.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private async submitWithRetry(text: string): Promise<string> {
    const body = {
      app_id: this.cfg.appId,
      callback_url: this.cfg.callbackUrl,
      input_text: text,
      voice_code: this.cfg.voiceCode,
      audio_type: "mp3",
      bitrate: this.cfg.bitrate,
      speed_rate: this.cfg.speedRate,
    };

    const delays = [1000, 2000, 4000];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const resp = await axios.post<SubmitResp>(
          `${this.cfg.baseUrl}/tts`,
          body,
          { headers: this.authHeaders, timeout: 30_000 },
        );
        const id = this.extractRequestId(resp.data);
        if (!id) {
          throw new Error(
            `VBee TTS submit returned no request_id ` +
            `(error_code: ${resp.data.error_code ?? "none"}, ` +
            `error_message: ${resp.data.error_message ?? resp.data.message ?? "none"}). ` +
            `Response keys: ${Object.keys(resp.data).join(", ")}`,
          );
        }
        return id;
      } catch (e) {
        lastErr = e;
        const ax = e as AxiosError;
        const status = ax.response?.status;
        if (status === 401 || status === 403) {
          throw new Error(
            "VBee TTS rejected the credentials (401/403). Check VBEE_ACCESS_TOKEN and VBEE_APP_ID " +
            "in .env.local (from the VBee AIVoice dashboard).",
          );
        }
        const retryable = status === undefined || status === 429 || status >= 500;
        if (!retryable || attempt === 3) break;
        await sleep(delays[attempt]);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`VBee TTS submit failed: ${String(lastErr)}`);
  }

  private extractRequestId(data: SubmitResp): string | undefined {
    if (typeof data.result === "string") return data.result;
    if (data.result && typeof data.result === "object" && data.result.request_id) {
      return data.result.request_id;
    }
    return data.request_id;
  }

  private async pollUntilDone(requestId: string): Promise<string> {
    const deadline = Date.now() + this.cfg.pollTimeoutMs;
    let last = "";
    while (Date.now() < deadline) {
      await sleep(this.cfg.pollIntervalMs);
      try {
        const resp = await axios.get<StatusResp>(
          `${this.cfg.baseUrl}/tts/${encodeURIComponent(requestId)}`,
          { headers: this.authHeaders, timeout: 30_000, validateStatus: () => true },
        );
        const r = resp.data.result;
        const state = (r?.status ?? "").toUpperCase();
        last = state || `http ${resp.status}`;
        if (state === "SUCCESS" && r?.audio_link) return r.audio_link;
        if (state === "FAILURE" || state === "FAILED" || state === "ERROR") {
          throw new Error(`VBee TTS failed for request ${requestId} (status ${state}).`);
        }
        // else IN_PROGRESS / empty → keep polling
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("VBee TTS failed")) throw e;
        // transient → keep polling
      }
    }
    throw new Error(
      `VBee TTS not ready within ${Math.round(this.cfg.pollTimeoutMs / 1000)}s ` +
      `(last state: ${last}, request ${requestId}).`,
    );
  }
}

function convertWavToMp3(wavPath: string, mp3Path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y", "-i", wavPath,
      "-ar", "44100", "-ac", "1",
      "-c:a", "libmp3lame", "-b:a", "192k",
      mp3Path,
    ]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg WAV→MP3 failed (exit ${code}): ${err.split("\n").slice(-5).join("\n")}`));
    });
    proc.on("error", reject);
  });
}
