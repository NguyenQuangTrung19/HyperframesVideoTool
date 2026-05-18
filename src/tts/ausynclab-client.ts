import axios, { AxiosError } from "axios";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { TtsClient } from "./tts-client.js";

export interface AusynclabOpts {
  apiKey: string;
  voiceId: number;
  modelName: string;
  speed: number;
  baseUrl: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}

interface SubmitResp { status: number; result: { audio_id: number }; }
interface DetailResp {
  status: number;
  result: {
    id: number;
    state: string; // IN_PROGRESS | SUCCEED | FAILED
    audio_url?: string;
    subtitle_url?: string;
    duration?: number;
  };
  message?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AusynclabClient implements TtsClient {
  constructor(private cfg: AusynclabOpts) {}

  async generate(text: string, audioOutPath: string, srtOutPath?: string): Promise<void> {
    const audioId = await this.submitWithRetry(text);
    const { audioUrl, subtitleUrl } = await this.pollUntilDone(audioId);

    // AusyncLab returns WAV; pipeline expects .mp3.
    const absMp3 = resolvePath(audioOutPath);
    const wavPath = absMp3.replace(/\.mp3$/i, ".wav");
    await this.download(audioUrl, wavPath);
    await convertWavToMp3(wavPath, absMp3);
    try { await unlink(wavPath); } catch { /* best-effort cleanup */ }

    if (srtOutPath && subtitleUrl) {
      await this.download(subtitleUrl, srtOutPath);
    }
  }

  private async submitWithRetry(text: string): Promise<number> {
    const headers = { "X-API-Key": this.cfg.apiKey, "Content-Type": "application/json" };
    const body = {
      audio_name: `pipeline-${Date.now()}`,
      text,
      voice_id: this.cfg.voiceId,
      callback_url: null,
      speed: this.cfg.speed,
      model_name: this.cfg.modelName,
      language: "vi",
    };

    const delays = [1000, 2000, 4000];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const resp = await axios.post<SubmitResp>(
          `${this.cfg.baseUrl}/speech/text-to-speech`,
          body,
          { headers, timeout: 30_000 },
        );
        return resp.data.result.audio_id;
      } catch (e) {
        lastErr = e;
        const ax = e as AxiosError;
        const status = ax.response?.status;
        const detail = (ax.response?.data as { detail?: string } | undefined)?.detail;
        if (status === 403 && detail === "paid_plan_only") {
          throw new Error(
            "AusyncLab TTS requires a paid plan. Upgrade at https://ausynclab.io " +
            "or switch TTS_PROVIDER in .env.local."
          );
        }
        const retryable = status === undefined || status >= 500;
        if (!retryable || attempt === delays.length) throw e;
        await sleep(delays[attempt]);
      }
    }
    throw lastErr;
  }

  private async pollUntilDone(audioId: number): Promise<{ audioUrl: string; subtitleUrl?: string }> {
    const headers = { "X-API-Key": this.cfg.apiKey };
    const started = Date.now();
    while (Date.now() - started < this.cfg.pollTimeoutMs) {
      const resp = await axios.get<DetailResp>(
        `${this.cfg.baseUrl}/speech/${audioId}`,
        { headers, timeout: 30_000 },
      );
      const r = resp.data.result;
      if (r.state === "SUCCEED" && r.audio_url) {
        return { audioUrl: r.audio_url, subtitleUrl: r.subtitle_url };
      }
      if (r.state === "FAILED") {
        throw new Error(`AusyncLab job ${audioId} failed: ${resp.data.message ?? "unknown"}`);
      }
      await sleep(this.cfg.pollIntervalMs);
    }
    throw new Error(`AusyncLab job ${audioId} polling timeout after ${this.cfg.pollTimeoutMs}ms`);
  }

  private async download(url: string, outPath: string): Promise<void> {
    const resp = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 60_000 });
    await writeFile(outPath, Buffer.from(resp.data));
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
