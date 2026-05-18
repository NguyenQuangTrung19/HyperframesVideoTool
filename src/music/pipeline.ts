import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";
import { loadConfig } from "../config.js";
import { getDurationSec } from "../assets/audio-tools.js";
import { log } from "../utils/logger.js";
import { alignAudio, type WordTiming } from "../podcast/align.js";
import { buildAssFromWords } from "../podcast/caption-ass.js";
import { composeVideo, probeVideo, writeAssFile } from "../podcast/video-compose.js";

const TOTAL_STEPS = 5;

const VIDEO_EXTS = ["mp4", "mov", "webm", "mkv", "m4v"] as const;
const AUDIO_EXTS = ["mp3", "wav", "m4a", "flac", "aac", "ogg"] as const;

/**
 * Build a 9:16 TikTok music-video clip from a user-supplied song + video,
 * with karaoke-style lyric captions burned on top.
 *
 * Required input layout (sibling files):
 *   input/<slug>/<slug>.<vid>    ← background video (any aspect)
 *   input/<slug>/<slug>.<audio>  ← song audio (mp3/wav/m4a/flac/...)
 * Optional:
 *   input/<slug>/<slug>.txt      ← lyrics; if present, used as Whisper hint
 *                                   to improve alignment accuracy on music.
 *
 * Output:
 *   output/<slug>/<slug>.mp4     ← final clip (deliverable)
 *   output/<slug>/words.json     ← word alignment (reused on rerun)
 *   output/<slug>/captions.ass   ← karaoke subtitle
 */
export async function runMusicPipeline(slugArg: string): Promise<void> {
  const cfg = loadConfig();

  // STEP 1: resolve sibling files
  log.step(1, TOTAL_STEPS, "Resolve sibling video + audio (+ optional lyrics)");
  const { slug, inputDir, videoPath, audioPath, lyricsPath } = resolveInputs(slugArg);
  log.info(`  slug=${slug}`);
  log.info(`  video: ${basename(videoPath)}`);
  log.info(`  audio: ${basename(audioPath)}`);
  log.info(`  lyrics: ${lyricsPath ? basename(lyricsPath) : "(none — Whisper will transcribe from scratch)"}`);

  const lyricsText = lyricsPath ? (await readFile(lyricsPath, "utf-8")).trim() : "";

  const outputDir = join(resolvePath(inputDir, "..", "..", "output"), slug);
  await mkdir(outputDir, { recursive: true });

  const audioDurationSec = await getDurationSec(audioPath);
  const probe = await probeVideo(videoPath);
  log.info(`  audio duration: ${audioDurationSec.toFixed(2)}s  video: ${probe.width}x${probe.height}, ${probe.durationSec.toFixed(1)}s`);

  // STEP 2: word-level alignment of the music audio
  log.step(2, TOTAL_STEPS, "Align lyrics to music audio (faster-whisper)");
  const wordsJson = join(outputDir, "words.json");
  let words: WordTiming[];
  if (existsSync(wordsJson)) {
    log.info(`  REUSE existing words.json — delete to force re-align`);
    words = JSON.parse(await readFile(wordsJson, "utf-8")) as WordTiming[];
  } else {
    const modelEnv = process.env.MUSIC_ALIGN_MODEL?.trim();
    const modelSize = (modelEnv as "small" | "medium" | "large-v3" | undefined) || "medium";
    words = await alignAudio({
      audioPath,
      vieneuProjectDir: cfg.vieneuProjectDir,
      workerScript: join(dirname(cfg.vieneuWorkerScript), "align_worker.py"),
      uvBin: cfg.vieneuUvBin,
      language: process.env.MUSIC_ALIGN_LANG?.trim() || "vi",
      modelSize,
      initialPrompt: lyricsText || undefined,
    });
    await writeFile(wordsJson, JSON.stringify(words, null, 2), "utf-8");
  }
  log.info(`  aligned ${words.length} words across ${audioDurationSec.toFixed(1)}s`);

  if (words.length === 0) {
    throw new Error(
      "Alignment returned 0 words. Music may be instrumental-only or vocals unclear. " +
      "Try MUSIC_ALIGN_MODEL=large-v3 or provide cleaner audio.",
    );
  }

  // STEP 3: build karaoke .ass
  log.step(3, TOTAL_STEPS, "Generate karaoke .ass subtitle");
  const windowSize = parseInt(process.env.MUSIC_CAPTION_WINDOW ?? "5", 10) as 1 | 3 | 5;
  const assContent = buildAssFromWords(words, {
    font: process.env.MUSIC_CAPTION_FONT?.trim() || "Arial Black",
    fontSize: parseInt(process.env.MUSIC_CAPTION_FONTSIZE ?? "84", 10),
    windowSize: [1, 3, 5].includes(windowSize) ? windowSize : 5,
    yPosition: parseFloat(process.env.MUSIC_CAPTION_Y ?? "0.62"),
    activeColorRgb: process.env.MUSIC_CAPTION_ACTIVE_COLOR?.trim() || "FFFF00",
    baseColorRgb: process.env.MUSIC_CAPTION_BASE_COLOR?.trim() || "FFFFFF",
  });
  const assPath = join(outputDir, "captions.ass");
  await writeAssFile(assContent, assPath);
  log.info(`  wrote ${basename(assPath)}`);

  // STEP 4: compose final 9:16 video
  log.step(4, TOTAL_STEPS, "Compose 9:16 video (blur-bg + center video + burn captions + mux music)");
  const finalMp4 = join(outputDir, `${slug}.mp4`);
  await composeVideo({
    sourceVideoPaths: [videoPath],
    ttsAudioPath: audioPath, // music audio is muxed in place of TTS — same shape
    assPath,
    outPath: finalMp4,
    ttsDurationSec: audioDurationSec,
    fps: parseInt(process.env.MUSIC_FPS ?? "30", 10),
    crf: parseInt(process.env.MUSIC_CRF ?? "20", 10),
    preset: process.env.MUSIC_PRESET || "medium",
  });

  // STEP 5: done
  log.step(5, TOTAL_STEPS, "Done");
  console.log("\n=== Result ===");
  console.log(`Video:  ${finalMp4}`);
  console.log(`Words:  ${wordsJson}`);
  console.log(`Total:  ${audioDurationSec.toFixed(2)}s`);
}

function resolveInputs(slugArg: string): {
  slug: string;
  inputDir: string;
  videoPath: string;
  audioPath: string;
  lyricsPath: string | null;
} {
  const absArg = resolvePath(slugArg);
  // Accept either a slug directory or any sibling file inside it.
  let inputDir: string;
  let slug: string;
  if (existsSync(absArg) && extname(absArg) === "") {
    inputDir = absArg;
    slug = basename(absArg);
  } else if (existsSync(absArg)) {
    inputDir = dirname(absArg);
    slug = basename(absArg, extname(absArg));
  } else {
    throw new Error(`Input path not found: ${absArg}`);
  }

  const videoPath = findSibling(inputDir, slug, VIDEO_EXTS);
  if (!videoPath) {
    throw new Error(
      `No sibling video found in ${inputDir}. Place a video named ${slug}.{${VIDEO_EXTS.join("|")}}.`,
    );
  }
  const audioPath = findSibling(inputDir, slug, AUDIO_EXTS);
  if (!audioPath) {
    throw new Error(
      `No sibling music audio found in ${inputDir}. Place a song file named ${slug}.{${AUDIO_EXTS.join("|")}}.`,
    );
  }
  const lyricsCandidate = join(inputDir, `${slug}.txt`);
  const lyricsPath = existsSync(lyricsCandidate) ? lyricsCandidate : null;

  return { slug, inputDir, videoPath, audioPath, lyricsPath };
}

function findSibling(dir: string, slug: string, exts: readonly string[]): string | null {
  for (const ext of exts) {
    const candidate = join(dir, `${slug}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
