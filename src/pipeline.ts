import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { ScriptSchema, type Script } from "./render/script-schema.js";
import { loadConfig, type Config } from "./config.js";
import { createTtsClient } from "./tts/tts-client.js";
import { fetchImage } from "./assets/image-fetcher.js";
import { getDurationSec, concatWithSilence, mixSfxOntoVoice, type SfxMixSpec } from "./assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "./assets/sfx-selector.js";
import { existsSync } from "node:fs";
import { composeHtml } from "./render/html-composer.js";
import { renderWithHyperframes } from "./render/hyperframes-runner.js";
import { generateSceneImages } from "./image/index.js";
import { log } from "./utils/logger.js";
import { spawn } from "node:child_process";
import { alignAudio, type WordTiming } from "./podcast/align.js";
import { realignCaptionsToSource } from "./podcast/realign-to-source.js";

const TOTAL_STEPS = 9;
// Pipeline only WARNS outside this range — exact bounds enforced by skill rules.
// News: 55–65s ideal. Analysis: 90–180s ideal. Range below tolerates both modes.
const DURATION_MIN_SEC = 48;
const DURATION_MAX_SEC = 200;
const SCENE_GAP_SEC = 0.3;
/**
 * Extra seconds added to the outro scene visual duration AFTER the voice ends.
 * Gives the TikTok follow card time to be read by the viewer (otherwise the
 * video ends a few hundred ms after the card slides up + click animation).
 * Audio stays silent during this hold; visual stays on screen.
 */
const OUTRO_HOLD_SEC = 3;

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "render", "templates");
/** Path to the SFX library (relative to project root) */
const SFX_DIR = join(__dirname, "..", "assets", "sfx");

const HYPERFRAMES_CONFIG = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: {
    blocks: "compositions",
    components: "compositions/components",
    assets: "assets",
  },
};

export async function runPipeline(scriptPath: string): Promise<void> {
  const cfg = loadConfig();
  const outputDir = dirname(scriptPath);
  log.info(`Output directory: ${outputDir}`);

  // STEP 1
  log.step(1, TOTAL_STEPS, `Load env + validate script.json (TTS provider: ${cfg.ttsProvider})`);
  const raw = JSON.parse(await readFile(scriptPath, "utf8"));
  // Substitute env placeholder before validation (skill templates use these tokens).
  if (raw.voice?.voiceId === "${VOICE_ID}") {
    raw.voice.voiceId =
      cfg.ttsProvider === "vieneu" ? cfg.vieneuVoiceId : String(cfg.ausynclabVoiceId!);
  }
  const script: Script = ScriptSchema.parse(raw);

  // Guard: a PRE-MATCH PREVIEW (folder `nhan-dinh-*`) MUST carry the verdict
  // scoreboard — a `comparison` scene with a `flag` on BOTH sides (flags + scoreline).
  // The render is schema-valid without it, so the scene is easy to silently drop
  // (happened 4× on 2026-06-14). Warn loudly so it's caught before publishing.
  if (basename(outputDir).startsWith("nhan-dinh-")) {
    const hasFlagScoreboard = script.scenes.some((s) => {
      const td = s.templateData as { template?: string; left?: { flag?: string }; right?: { flag?: string } };
      return td?.template === "comparison" && !!td.left?.flag && !!td.right?.flag;
    });
    if (!hasFlagScoreboard) {
      log.warn(
        "⚠ PRE-MATCH PREVIEW missing the verdict scoreboard: no `comparison` scene has a flag on both sides. " +
          "The predicted flags + scoreline card will NOT render. Add it per /create-video SKILL " +
          '(both sides set `flag: "https://flagcdn.com/<iso2>.svg"`).',
      );
    }
  }

  // STEP 2
  log.step(2, TOTAL_STEPS, "Write script.txt for CapCut");
  const fullText = script.scenes.map((s) => s.voiceText).join("\n\n");
  await writeFile(join(outputDir, "script.txt"), fullText);

  // STEP 3 + 4 in parallel
  log.step(3, TOTAL_STEPS, "Fetch og:image (parallel) + Step 4 TTS");
  const imgPath = join(outputDir, "images", "bg.jpg");
  const imgPromise = fetchImage(script.metadata.source.image, imgPath);

  // STEP 4
  const voiceDir = join(outputDir, "voice");
  await mkdir(voiceDir, { recursive: true });
  let sceneAudio: Array<{ id: string; path: string; durationSec: number }>;

  if (cfg.ttsProvider === "ausynclab") {
    // ── AusyncLab: full-text TTS for natural prosody ──────────────────
    // Generate one continuous audio from the complete script, then use
    // Whisper alignment to locate per-scene boundaries and split. This
    // avoids quality loss from generating each short scene independently
    // (AusyncLab treats each API call as a standalone utterance).
    sceneAudio = await ausyncFullTextTts(cfg, script, fullText, voiceDir);
  } else {
    // ── VieNeu: per-scene TTS (local, no prosody-continuity concern) ──
    const ttsClient = createTtsClient(cfg);
    const limit = pLimit(cfg.ttsConcurrency);

    const sceneAudioPromises = script.scenes.map((scene) =>
      limit(async () => {
        const out = join(voiceDir, `scene-${scene.id}.mp3`);
        const srtOut = join(voiceDir, `scene-${scene.id}.srt`);

        // IDEMPOTENT: skip TTS if voice file already exists.
        if (existsSync(out)) {
          const dur = await getDurationSec(out);
          log.info(`  scene ${scene.id}: REUSE existing mp3 (${dur.toFixed(2)}s) — delete to force re-TTS`);
          return { id: scene.id, path: out, durationSec: dur };
        }

        log.info(`  TTS scene ${scene.id} (${scene.voiceText.length} chars)...`);
        await ttsClient.generate(scene.voiceText, out, srtOut);
        const dur = await getDurationSec(out);
        log.info(`  scene ${scene.id}: ${dur.toFixed(2)}s`);
        return { id: scene.id, path: out, durationSec: dur };
      }),
    );

    sceneAudio = await Promise.all(sceneAudioPromises);
    // Done with TTS — release any worker subprocess (VieNeu) so its ~600 MB of
    // model weights stop sitting in memory during the rest of the pipeline.
    await ttsClient.dispose?.();
  }

  const imgResult = await imgPromise;

  let bgImageRelPath: string | null = null;
  if (imgResult.success) {
    bgImageRelPath = "images/bg.jpg";
  } else {
    log.warn(`Background image fetch failed: ${imgResult.reason} → using gradient fallback`);
  }

  // STEP 5 — Generate AI images for eligible scenes (parallel with SFX mix below)
  log.step(5, TOTAL_STEPS, "Generate AI scene images (hook/callout/stat-hero with imagePrompt)");
  const sceneImagesPromise = generateSceneImages({
    script,
    outputDir,
    config: cfg.image,
    hookOgImageRelPath: bgImageRelPath,
  });

  // STEP 6
  log.step(6, TOTAL_STEPS, "Concat voice scenes + mix SFX layer");
  const voiceRawMp3 = join(outputDir, "voice-raw.mp3");
  const voiceMp3 = join(outputDir, "voice.mp3");
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);

  // Compute scene start times (cumulative voice durations + gaps)
  let cursor = 0;
  const sceneStarts: Record<string, number> = {};
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }

  // Build SFX mix list using smart 3-tier selector
  const sfxIndex = indexSfxLibrary(SFX_DIR);
  const indexCats = Object.keys(sfxIndex).length;
  const indexFiles = Object.values(sfxIndex).reduce((s, a) => s + a.length, 0);
  log.info(`  SFX library: ${indexFiles} files in ${indexCats} categories`);

  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];

    // Tier 1: explicit override in script.json
    if (scene.sfx) {
      if (scene.sfx.name === "none") {
        log.info(`  scene ${scene.id}: SFX disabled (explicit "none")`);
        continue;
      }
      const sfxPath = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(sfxPath)) {
        sfxList.push({ path: sfxPath, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
        log.info(`  scene ${scene.id}: SFX override -> ${scene.sfx.name}.mp3`);
      } else {
        log.warn(`  scene ${scene.id}: explicit SFX not found, skipping: ${scene.sfx.name}.mp3`);
      }
      continue;
    }

    // Tier 2/3: smart selection by content + template
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: scene.templateData.template,
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) {
      log.warn(`  scene ${scene.id}: no SFX available (empty library?)`);
      continue;
    }

    const sfxPath = join(SFX_DIR, picked.relPath);
    const playback = defaultPlayback(picked);
    sfxList.push({ path: sfxPath, startSec: startSec + playback.offsetSec, volume: playback.volume });

    const why = picked.source === "semantic"
      ? `semantic match "${picked.matchedKeyword}"`
      : picked.source;
    log.info(`  scene ${scene.id}: SFX -> ${picked.relPath} (${why})`);
  }
  log.info(`  mixing ${sfxList.length} SFX into voice.mp3`);
  await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceMp3);

  const totalAudioSec = await getDurationSec(voiceMp3);
  log.info(`  voice.mp3 total: ${totalAudioSec.toFixed(2)}s`);
  if (totalAudioSec < DURATION_MIN_SEC || totalAudioSec > DURATION_MAX_SEC) {
    log.warn(`Total duration ${totalAudioSec.toFixed(1)}s outside [${DURATION_MIN_SEC}, ${DURATION_MAX_SEC}]s tolerance — proceeding anyway`);
  }

  // STEP 7 — Compose HTML + write hyperframes project files
  log.step(7, TOTAL_STEPS, "Compose HTML + project files");

  // Resolve image generation results (started in step 5, awaited here)
  const sceneImages = await sceneImagesPromise;

  // Resolve TikTok avatar — download URL if provided, else copy bundled default
  // Bundled avatar can be jpg/jpeg/png/webp — pick whichever exists
  const findBundledAvatar = (): string => {
    const baseDir = join(__dirname, "..", "assets");
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const p = join(baseDir, `logoTV.${ext}`);
      if (existsSync(p)) return p;
    }
    throw new Error(`No bundled avatar found. Place an image at assets/logoTV.{jpg,png,webp}`);
  };
  const bundledAvatar = findBundledAvatar();
  const ttAvatarExt = bundledAvatar.split(".").pop()!.toLowerCase();
  const ttAvatarFile = `tiktok-avatar.${ttAvatarExt}`;
  const ttAvatarOut = join(outputDir, ttAvatarFile);
  if (cfg.tiktok.avatarUrl) {
    const r = await fetchImage(cfg.tiktok.avatarUrl, ttAvatarOut);
    if (!r.success) {
      log.warn(`TikTok avatar download failed: ${r.reason} → falling back to bundled default`);
      await copyFile(bundledAvatar, ttAvatarOut);
    }
  } else {
    await copyFile(bundledAvatar, ttAvatarOut);
  }

  const html = composeHtml({
    script,
    sceneAudio: sceneAudio.map((a) => ({ id: a.id, durationSec: a.durationSec })),
    gapSec: SCENE_GAP_SEC,
    sceneImages,
    audioRelPath: "voice.mp3",
    tiktok: cfg.tiktok,
    tiktokAvatarRelPath: ttAvatarFile,
    outroHoldSec: OUTRO_HOLD_SEC,
  });

  // hyperframes expects: index.html (NOT composition.html), hyperframes.json, meta.json in DIR
  await writeFile(join(outputDir, "index.html"), html);

  await writeFile(join(outputDir, "hyperframes.json"), JSON.stringify(HYPERFRAMES_CONFIG, null, 2));

  const slug = basename(outputDir);
  await writeFile(join(outputDir, "meta.json"), JSON.stringify({
    id: slug,
    name: script.metadata.title,
    createdAt: new Date().toISOString(),
  }, null, 2));

  // Copy templates next to the index.html so relative paths resolve
  await copyFile(join(TPL_DIR, "styles.css"),    join(outputDir, "styles.css"));
  await copyFile(join(TPL_DIR, "animations.js"), join(outputDir, "animations.js"));

  // STEP 8
  log.step(8, TOTAL_STEPS, "Render with hyperframes");
  const videoPath = join(outputDir, "video.mp4");
  await renderWithHyperframes({
    compositionDir: outputDir,
    outputPath: videoPath,
    workers: cfg.hyperframesWorkers,
    gpu: cfg.hyperframesGpu,
  });

  // STEP 9
  log.step(9, TOTAL_STEPS, "Done");
  console.log("\n=== Result ===");
  console.log(`Video:  ${videoPath}`);
  console.log(`Audio:  ${voiceMp3}  (cho CapCut)`);
  console.log(`Script: ${join(outputDir, "script.txt")}  (cho CapCut auto-caption)`);
  console.log(`Tong thoi luong: ${totalAudioSec.toFixed(2)}s`);
}

/**
 * AusyncLab full-text TTS: generate one continuous audio from the full script,
 * align with Whisper, then split into per-scene segments.
 *
 * Idempotency:
 *   - `voice/full.mp3`        — cached, delete to force re-TTS
 *   - `voice/full-words.json` — cached, delete to force re-align
 *   - `voice/scene-*.mp3`     — always re-extracted from full.mp3
 */
async function ausyncFullTextTts(
  cfg: Config,
  script: Script,
  fullText: string,
  voiceDir: string,
): Promise<Array<{ id: string; path: string; durationSec: number }>> {
  const ttsClient = createTtsClient(cfg);
  const fullMp3 = join(voiceDir, "full.mp3");
  const wordsJsonPath = join(voiceDir, "full-words.json");

  // 1. TTS: generate full audio (cached)
  if (existsSync(fullMp3)) {
    log.info(`  REUSE existing full.mp3 — delete to force re-TTS`);
  } else {
    log.info(`  TTS full script (${fullText.length} chars) via AusyncLab...`);
    try {
      await ttsClient.generate(fullText, fullMp3);
    } finally {
      await ttsClient.dispose?.();
    }
  }
  const fullDur = await getDurationSec(fullMp3);
  log.info(`  full.mp3 duration: ${fullDur.toFixed(2)}s`);

  // 2. Whisper alignment: word-level timings (cached)
  let words: WordTiming[];
  if (existsSync(wordsJsonPath)) {
    log.info(`  REUSE existing full-words.json — delete to force re-align`);
    words = JSON.parse(await readFile(wordsJsonPath, "utf-8")) as WordTiming[];
  } else {
    log.info(`  Aligning full audio → word timings (faster-whisper)...`);
    words = await alignAudio({
      audioPath: fullMp3,
      vieneuProjectDir: cfg.vieneuProjectDir,
      workerScript: join(dirname(cfg.vieneuWorkerScript), "align_worker.py"),
      uvBin: cfg.vieneuUvBin,
      language: "vi",
      modelSize: "small",
      initialPrompt: fullText,
    });
    await writeFile(wordsJsonPath, JSON.stringify(words, null, 2), "utf-8");
  }
  log.info(`  aligned ${words.length} words across ${fullDur.toFixed(1)}s`);

  if (words.length === 0) {
    throw new Error("Alignment returned 0 words. Check that the TTS audio contains speech.");
  }

  // 2.5. Realign Whisper word timings to source-text spelling
  const { words: realignedWords, report } = realignCaptionsToSource(words, fullText);
  log.info(`  Realigned words to source text: ${realignedWords.length} words (${report.unchanged} unchanged, ${report.replaced} replaced, ${report.inserted} inserted, ${report.dropped} dropped)`);

  const tokenize = (text: string): string[] => {
    const cleaned = text.replace(/[“”‘’]/g, '"');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
    return tokens.filter((t) => /[\p{L}\p{N}]/u.test(t));
  };

  const sceneTokens = script.scenes.map((s) => tokenize(s.voiceText));
  const totalSceneWords = sceneTokens.reduce((sum, tokens) => sum + tokens.length, 0);

  const isMatch = realignedWords.length === totalSceneWords;
  if (!isMatch) {
    log.warn(`  Realigned word count (${realignedWords.length}) mismatches total scene tokens (${totalSceneWords})! Falling back to proportional splitting.`);
  }

  // 3. Map aligned words to scenes by exact token counts (if matching) or proportionally, then
  //    extract per-scene audio segments with ffmpeg.
  const sceneWordCounts = script.scenes.map((s) =>
    s.voiceText.trim().split(/\s+/).length,
  );

  const results: Array<{ id: string; path: string; durationSec: number }> = [];
  let wordIdx = 0;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const outPath = join(voiceDir, `scene-${scene.id}.mp3`);

    let startSec = 0;
    let endSec = 0;
    let hasValidSegment = true;
    let startIdx = 0;
    let endIdx = 0;

    if (isMatch) {
      const tokensCount = sceneTokens[i].length;
      startIdx = wordIdx;
      endIdx = wordIdx + tokensCount - 1;
      wordIdx += tokensCount;

      if (startIdx >= realignedWords.length) {
        hasValidSegment = false;
      } else {
        const startWord = realignedWords[startIdx];
        const endWord = realignedWords[Math.min(endIdx, realignedWords.length - 1)] || realignedWords[realignedWords.length - 1];
        startSec = startWord ? startWord.start : 0;
        endSec = endWord ? endWord.end : 0;
      }
    } else {
      // Fallback: proportional word assignment
      const wordsForScene =
        i === script.scenes.length - 1
          ? words.length - wordIdx
          : Math.max(1, Math.round((sceneWordCounts[i] / totalSceneWords) * words.length));

      startIdx = wordIdx;
      endIdx = Math.min(wordIdx + wordsForScene - 1, words.length - 1);
      wordIdx = endIdx + 1;

      if (startIdx >= words.length) {
        hasValidSegment = false;
      } else {
        startSec = words[startIdx]?.start ?? 0;
        endSec = words[endIdx]?.end ?? 0;
      }
    }

    if (!hasValidSegment) {
      log.warn(`  scene ${scene.id}: no aligned words — creating 1s silence`);
      await runFfmpeg([
        "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", "1", "-c:a", "libmp3lame", "-b:a", "192k", outPath,
      ]);
      results.push({ id: scene.id, path: outPath, durationSec: 1.0 });
      continue;
    }

    // Extract segment from full audio
    await runFfmpeg([
      "-y", "-i", fullMp3,
      "-ss", startSec.toFixed(3), "-to", endSec.toFixed(3),
      "-ar", "44100", "-ac", "1",
      "-c:a", "libmp3lame", "-b:a", "192k",
      outPath,
    ]);

    const actualDur = await getDurationSec(outPath);
    log.info(`  scene ${scene.id}: ${actualDur.toFixed(2)}s (words ${startIdx}–${endIdx})`);
    results.push({ id: scene.id, path: outPath, durationSec: actualDur });
  }

  return results;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let err = "";
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (exit ${code}): ${err.split("\n").slice(-5).join("\n")}`));
    });
    proc.on("error", reject);
  });
}
