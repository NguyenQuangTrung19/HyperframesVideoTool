import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";

export interface WordTiming {
  /** The word as transcribed (UTF-8, may include Vietnamese diacritics) */
  w: string;
  /** Start time in seconds within the audio file */
  start: number;
  /** End time in seconds within the audio file */
  end: number;
}

export interface AlignOpts {
  /** Absolute path to TTS-generated audio (mp3 or wav) */
  audioPath: string;
  /** Absolute path to the VieNeu uv project root (provides Python env) */
  vieneuProjectDir: string;
  /** Absolute path to scripts/align_worker.py inside this repo */
  workerScript: string;
  /** uv binary path; defaults to "uv" on PATH */
  uvBin?: string;
  /** Whisper language code; default "vi" */
  language?: string;
  /** Whisper model size; default "small" (good accuracy/speed for VN TTS audio) */
  modelSize?: "tiny" | "base" | "small" | "medium" | "large-v3";
  /** Max ms to wait for alignment to finish; default 600000 (10 min, large model can be slow) */
  timeoutMs?: number;
  /**
   * Optional reference text passed to Whisper as `initial_prompt` to bias the
   * decoder toward expected vocabulary. Useful for music alignment where the
   * lyrics are known up-front; Whisper truncates internally to ~224 tokens.
   */
  initialPrompt?: string;
}

/**
 * Run faster-whisper on a TTS audio file and return per-word timestamps.
 *
 * Throws with a clear message if the Python worker reports a missing
 * faster-whisper install — the user is expected to add it to the VieNeu uv
 * env once (see align_worker.py header for the exact command).
 */
export async function alignAudio(opts: AlignOpts): Promise<WordTiming[]> {
  const language = opts.language ?? "vi";
  const modelSize = opts.modelSize ?? "small";
  const timeoutMs = opts.timeoutMs ?? 600000;
  const uvBin = opts.uvBin ?? "uv";
  const absAudio = resolvePath(opts.audioPath);

  // Whisper's initial_prompt is passed via a temp file to avoid escaping a
  // potentially long, multi-line prompt through argv. "-" tells the worker
  // to skip the prompt.
  let promptPath = "-";
  let cleanupPromptDir: string | null = null;
  if (opts.initialPrompt && opts.initialPrompt.trim()) {
    cleanupPromptDir = await mkdtemp(join(tmpdir(), "whisper-prompt-"));
    promptPath = join(cleanupPromptDir, "prompt.txt");
    await writeFile(promptPath, opts.initialPrompt, "utf-8");
  }

  // Run the worker as a PEP 723 inline-deps script so uv auto-provisions an
  // ephemeral (cached) env with faster-whisper — no external uv project
  // required. cwd just needs to exist; prefer the VieNeu project dir when it's
  // still around (keeps the model cache co-located), else fall back to the
  // worker script's own dir. This decouples alignment from VieNeu-TTS, which
  // the channel no longer keeps installed.
  const cwd = opts.vieneuProjectDir && existsSync(opts.vieneuProjectDir)
    ? opts.vieneuProjectDir
    : dirname(resolvePath(opts.workerScript));

  return new Promise<WordTiming[]>((resolve, reject) => {
    const args = ["run", "--script", opts.workerScript, absAudio, language, modelSize, promptPath];
    const proc = spawn(uvBin, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`align_worker timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    proc.stdout.setEncoding("utf-8");
    proc.stdout.on("data", (chunk: string) => { stdoutBuf += chunk; });
    proc.stderr.setEncoding("utf-8");
    proc.stderr.on("data", (chunk: string) => { stderrBuf += chunk; });

    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn align_worker: ${e.message}`));
    });

    proc.on("close", async (code) => {
      clearTimeout(timer);
      if (cleanupPromptDir) {
        await rm(cleanupPromptDir, { recursive: true, force: true }).catch(() => { /* best effort */ });
      }
      // Parser is resilient — worker may emit a single JSON line OR multiple,
      // and stderr noise (model load logs) shouldn't bleed into stdout.
      const line = stdoutBuf.trim().split("\n").filter((l) => l.trim()).pop() ?? "";
      let parsed: { words?: WordTiming[]; error?: string } | null = null;
      try {
        parsed = line ? JSON.parse(line) : null;
      } catch {
        parsed = null;
      }

      if (parsed?.error) {
        reject(new Error(`align_worker: ${parsed.error}`));
        return;
      }
      if (code !== 0) {
        const tail = stderrBuf.split("\n").slice(-10).join("\n");
        reject(new Error(`align_worker exited with code ${code}\n${tail}`));
        return;
      }
      if (!parsed?.words) {
        reject(new Error(`align_worker produced no words. stdout=${stdoutBuf.slice(-500)}`));
        return;
      }

      resolve(parsed.words);
    });
  });
}
