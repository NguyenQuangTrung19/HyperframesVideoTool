import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { unlink } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { TtsClient } from "./tts-client.js";

export interface VieNeuOpts {
  /** Absolute path to the VieNeu-TTS uv project root (the dir containing pyproject.toml). */
  projectDir: string;
  /** Absolute path to scripts/vieneu_worker.py inside this repo. */
  workerScript: string;
  /** Preset voice id, e.g. "Binh" (Thanh Bình, nam miền Bắc) — default. */
  voiceId: string;
  /** "natural" (default) or "storytelling". */
  emotion: string;
  /** Override the `uv` binary path. Default: "uv" (must be on PATH). */
  uvBin?: string;
  /** Max ms to wait for the worker to load the model + emit "ready". Default 90000. */
  loadTimeoutMs?: number;
  /** Max ms to wait for a single synth response. Default 120000. */
  synthTimeoutMs?: number;
}

type LoadingMsg = { status: "loading"; voiceId: string; emotion: string };
type ReadyMsg = { status: "ready" };
type OkMsg = { status: "ok"; outPath: string };
type ErrMsg = { status: "err"; message: string };
type ByeMsg = { status: "bye" };
type WorkerMsg = LoadingMsg | ReadyMsg | OkMsg | ErrMsg | ByeMsg;

/**
 * VieNeu-TTS client.
 *
 * Spawns a long-running Python worker (scripts/vieneu_worker.py) on first
 * generate() call. The worker loads the GGUF model + the preset voice ONCE
 * and answers JSON-line requests on stdin/stdout, so the ~5–10 s model load
 * is amortized across every scene in a pipeline run instead of paid per scene.
 *
 * The worker writes 24 kHz WAV; this client converts each WAV → MP3 with
 * ffmpeg so downstream code can keep treating per-scene voice files as .mp3.
 *
 * VieNeu does not produce subtitles; `srtOutPath` is silently ignored.
 *
 * Call dispose() when finished — the pipeline does this in a finally{}.
 */
export class VieNeuClient implements TtsClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuf = "";
  private readyPromise: Promise<void> | null = null;
  /** Resolver for the next non-handshake stdout line (i.e. response to an in-flight synth). */
  private pendingResolver: ((m: OkMsg | ErrMsg | ByeMsg) => void) | null = null;
  /** Serializes generate() calls — only one synth in flight at a time. */
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(private readonly cfg: VieNeuOpts) {}

  async generate(text: string, audioOutPath: string, _srtOutPath?: string): Promise<void> {
    if (this.disposed) throw new Error("VieNeuClient.generate called after dispose()");
    await this.ensureReady();

    // The Python worker is spawned with cwd=VIENEU_PROJECT_DIR, so any relative
    // path the caller hands us would resolve there instead of the pipeline's
    // output dir. Force absolute paths before crossing the process boundary.
    const absMp3 = resolvePath(audioOutPath);
    const wavPath = absMp3.replace(/\.mp3$/i, ".wav");

    // Serialize: wait for previous synth, then push our resolver and write the request.
    const previous = this.chain;
    const ours = (async () => {
      await previous.catch(() => {}); // don't propagate previous failure to next call

      const reply = await this.requestOne({ op: "synth", text, outPath: wavPath });
      if (reply.status !== "ok") {
        const message = reply.status === "err" ? reply.message : `unexpected status ${reply.status}`;
        throw new Error(`VieNeu synth failed: ${message}`);
      }

      await convertWavToMp3(wavPath, absMp3);
      await unlink(wavPath).catch(() => { /* best effort */ });
    })();
    this.chain = ours;
    return ours;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.proc) return;
    // Drain any in-flight work first.
    await this.chain.catch(() => {});
    try {
      this.proc.stdin.write(JSON.stringify({ op: "exit" }) + "\n");
      this.proc.stdin.end();
    } catch { /* worker may already be dead */ }
    // Give it a moment to exit cleanly; then kill.
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        this.proc?.kill();
        resolve();
      }, 5000);
      this.proc?.once("exit", () => { clearTimeout(t); resolve(); });
    });
    this.proc = null;
  }

  // ── private ────────────────────────────────────────────────────────────────

  private ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.spawnAndAwaitReady();
    return this.readyPromise;
  }

  private spawnAndAwaitReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["run", "python", this.cfg.workerScript, this.cfg.voiceId, this.cfg.emotion];
      this.proc = spawn(this.cfg.uvBin ?? "uv", args, {
        cwd: this.cfg.projectDir,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Safety net: if the parent crashes, take the subprocess down with us.
      const onExit = () => { try { this.proc?.kill(); } catch { /* ignore */ } };
      process.once("exit", onExit);
      this.proc.once("exit", () => { process.removeListener("exit", onExit); });

      const loadTimeout = setTimeout(() => {
        reject(new Error(
          `VieNeu worker did not become ready within ${this.cfg.loadTimeoutMs ?? 90000} ms. ` +
          `Check VIENEU_PROJECT_DIR (${this.cfg.projectDir}) and that "uv" is on PATH.`
        ));
        this.proc?.kill();
      }, this.cfg.loadTimeoutMs ?? 90000);

      this.proc.stdout.setEncoding("utf-8");
      this.proc.stdout.on("data", (chunk: string) => {
        this.stdoutBuf += chunk;
        let nl: number;
        while ((nl = this.stdoutBuf.indexOf("\n")) >= 0) {
          const line = this.stdoutBuf.slice(0, nl).trim();
          this.stdoutBuf = this.stdoutBuf.slice(nl + 1);
          if (!line) continue;
          let msg: WorkerMsg;
          try {
            msg = JSON.parse(line) as WorkerMsg;
          } catch {
            // Worker shouldn't emit non-JSON, but stay defensive — ignore.
            continue;
          }
          if (msg.status === "loading") continue;
          if (msg.status === "ready") {
            clearTimeout(loadTimeout);
            resolve();
            continue;
          }
          // ok / err / bye → response to in-flight request
          const r = this.pendingResolver;
          this.pendingResolver = null;
          r?.(msg);
        }
      });

      // Surface stderr only on failure to keep logs clean during normal runs.
      let stderrBuf = "";
      this.proc.stderr.setEncoding("utf-8");
      this.proc.stderr.on("data", (chunk: string) => { stderrBuf += chunk; });

      this.proc.on("error", (e) => {
        clearTimeout(loadTimeout);
        reject(new Error(`Failed to spawn VieNeu worker: ${e.message}`));
      });
      this.proc.on("exit", (code, signal) => {
        clearTimeout(loadTimeout);
        if (code !== 0 && code !== null) {
          // If we have a pending resolver, fail it loudly.
          const r = this.pendingResolver;
          this.pendingResolver = null;
          const detail = stderrBuf.split("\n").slice(-10).join("\n");
          r?.({ status: "err", message: `worker exited with code ${code}\n${detail}` });
        }
        if (signal) {
          // Killed externally — that's OK during dispose.
        }
      });
    });
  }

  private requestOne(req: object): Promise<OkMsg | ErrMsg | ByeMsg> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pendingResolver = null;
        reject(new Error(`VieNeu synth timeout after ${this.cfg.synthTimeoutMs ?? 120000} ms`));
      }, this.cfg.synthTimeoutMs ?? 120000);
      this.pendingResolver = (m) => {
        clearTimeout(t);
        resolve(m);
      };
      try {
        this.proc!.stdin.write(JSON.stringify(req) + "\n");
      } catch (e) {
        clearTimeout(t);
        this.pendingResolver = null;
        reject(e);
      }
    });
  }
}

/** Transcode a WAV file to MP3 (mono, 44.1 kHz, 192 kbps) using ffmpeg. */
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
