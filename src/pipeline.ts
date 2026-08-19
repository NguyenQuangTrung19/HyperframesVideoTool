import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { ScriptSchema, type Script } from "./render/script-schema.js";
import { loadConfig, type Config } from "./config.js";
import { createTtsClient } from "./tts/tts-client.js";
import { fetchImage } from "./assets/image-fetcher.js";
import {
  getDurationSec,
  concatWithSilence,
  mixSfxOntoVoice,
  mixBgMusicOntoVoice,
  resolveBgMusic,
  type SfxMixSpec,
} from "./assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "./assets/sfx-selector.js";
import { existsSync, readdirSync } from "node:fs";
import { composeHtml } from "./render/html-composer.js";
import { readImageAspect } from "./render/image-dims.js";
import { renderWithHyperframes } from "./render/hyperframes-runner.js";
import { generateSceneImages } from "./image/index.js";
import { log } from "./utils/logger.js";
import { spawn } from "node:child_process";
import { alignAudio, type WordTiming } from "./podcast/align.js";
import { realignCaptionsToSource } from "./podcast/realign-to-source.js";

const TOTAL_STEPS = 9;
// Pipeline only WARNS outside this range — exact bounds enforced by skill rules.
// News: 55–65s ideal. Analysis: 90–180s ideal. Range below tolerates both modes.
// 16:9 is the roundup canvas (YouTube): 5–7 articles in one video, so its
// ceiling is the skill's 6-minute cap rather than the short-form 200s.
const DURATION_MIN_SEC = 48;
const DURATION_MAX_SEC: Record<"9:16" | "16:9", number> = { "9:16": 200, "16:9": 380 };
const SCENE_GAP_SEC = 0.3;
/**
 * Lead-in kept before the very first word when CUTTING scene 0 out of full.mp3.
 * Note this cannot save the opening on its own: AusyncLab starts speaking at
 * sample 0, so `max(0, start - VOICE_LEAD_IN_SEC)` clamps straight back to 0 and
 * scene 0 still begins mid-syllable. VIDEO_HEAD_LEAD_IN_SEC below is what
 * actually gives the first word room.
 */
const VOICE_LEAD_IN_SEC = 0.15;
/**
 * Silence prepended to the finished voice track, i.e. real dead air at the top
 * of the video. Without it the audio slams in at ~-6 dB on frame 0 and the first
 * word is swallowed — measured on 22 of 36 delivered videos (see
 * `concatWithSilence`). 0.35s is long enough for a phone player to ramp its
 * output and for the viewer to register the picture before anyone speaks, and
 * short enough that it does not read as a stall.
 */
const VIDEO_HEAD_LEAD_IN_SEC = 0.35;
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
/** Royalty-free background-music library. See assets/music/README.md for licensing. */
const MUSIC_DIR = join(__dirname, "..", "assets", "music");

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

  if (cfg.ttsProvider === "ausynclab" || cfg.ttsProvider === "manual") {
    // ── Full-text path (AusyncLab API, or a manually-supplied audio file) ──
    // Treat the voiceover as one continuous audio, then use Whisper alignment
    // to locate per-scene boundaries and split. For AusyncLab this avoids
    // quality loss from generating each short scene independently. For manual
    // mode (VBee credit exhausted → user records/exports the voice externally),
    // it lets a single drop-in mp4/mp3 flow through the same align+split logic.
    sceneAudio = await ausyncFullTextTts(cfg, script, fullText, voiceDir, outputDir);
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
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3, VIDEO_HEAD_LEAD_IN_SEC);

  // Compute scene start times (cumulative voice durations + gaps). Starts at the
  // head lead-in, not 0 — the voice track now opens with that much silence, and
  // SFX cues below are placed against this same cursor.
  let cursor = VIDEO_HEAD_LEAD_IN_SEC;
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

  // Background-music bed (optional). Auto-on when assets/music/ has tracks;
  // VIDEO_BG_MUSIC="" turns it off, VIDEO_BG_MUSIC=<name|path> pins one track.
  const bgMusicPath = resolveBgMusic(
    MUSIC_DIR,
    process.env.VIDEO_BG_MUSIC,
    (dir) => (existsSync(dir) ? readdirSync(dir) : []),
  );
  if (bgMusicPath) {
    if (!existsSync(bgMusicPath)) {
      throw new Error(
        `Background music file not found: ${bgMusicPath}\n` +
        `Check VIDEO_BG_MUSIC, or drop the track into ${MUSIC_DIR} (see its README.md).`,
      );
    }
    const bgVolume = parseFloat(process.env.VIDEO_BG_MUSIC_VOLUME ?? "0.22");
    log.info(`  bg music: ${basename(bgMusicPath)} @ volume ${bgVolume} (ducked under voice)`);
    const voiceNoMusic = join(outputDir, "voice-nomusic.mp3");
    await copyFile(voiceMp3, voiceNoMusic);
    await mixBgMusicOntoVoice(voiceNoMusic, bgMusicPath, voiceMp3, { volume: bgVolume });
  } else {
    log.info("  bg music: none (assets/music/ empty or VIDEO_BG_MUSIC=\"\")");
  }

  const totalAudioSec = await getDurationSec(voiceMp3);
  log.info(`  voice.mp3 total: ${totalAudioSec.toFixed(2)}s`);
  const durationMax = DURATION_MAX_SEC[script.metadata.aspect];
  if (totalAudioSec < DURATION_MIN_SEC || totalAudioSec > durationMax) {
    log.warn(`Total duration ${totalAudioSec.toFixed(1)}s outside [${DURATION_MIN_SEC}, ${durationMax}]s tolerance — proceeding anyway`);
  }

  // STEP 7 — Compose HTML + write hyperframes project files
  log.step(7, TOTAL_STEPS, "Compose HTML + project files");

  // Resolve image generation results (started in step 5, awaited here)
  const sceneImages = await sceneImagesPromise;

  // Measure each staged image's aspect ratio so the composer can switch
  // landscape photos (16:9 Getty etc.) to a framed hero card instead of a
  // cropped full-bleed cover. Missing/unreadable → composer keeps cover.
  const sceneImageAspect: Record<string, number> = {};
  for (const [id, rel] of Object.entries(sceneImages)) {
    const aspect = readImageAspect(join(outputDir, rel));
    if (aspect !== null) sceneImageAspect[id] = aspect;
  }

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
    leadInSec: VIDEO_HEAD_LEAD_IN_SEC,
    sceneImages,
    sceneImageAspect,
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
  await copyFile(join(TPL_DIR, "shader.js"),     join(outputDir, "shader.js"));
  // 16:9 loads a second stylesheet on top (geometry only — see its header).
  if (script.metadata.aspect === "16:9") {
    await copyFile(join(TPL_DIR, "styles-landscape.css"), join(outputDir, "styles-landscape.css"));
  }

  // STEP 8
  log.step(8, TOTAL_STEPS, "Render with hyperframes");
  const videoPath = join(outputDir, "video.mp4");
  await renderWithHyperframes({
    compositionDir: outputDir,
    outputPath: videoPath,
    fps: cfg.hyperframesFps,
    quality: cfg.hyperframesQuality,
    workers: cfg.hyperframesWorkers,
    gpu: cfg.hyperframesGpu,
  });

  // Auto fidelity check — so preview vs frame video thật, cảnh báo scene lệch
  try {
    const { checkRenderFidelity, printFidelityReport } = await import("./render/render-check.js");
    printFidelityReport(outputDir, await checkRenderFidelity(outputDir));
  } catch (e) {
    console.warn(`render-check skipped: ${e instanceof Error ? e.message : e}`);
  }

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
  outputDir: string,
): Promise<Array<{ id: string; path: string; durationSec: number }>> {
  const fullMp3 = join(voiceDir, "full.mp3");
  const wordsJsonPath = join(voiceDir, "full-words.json");

  // 1. Obtain full audio (cached as voice/full.mp3)
  if (existsSync(fullMp3)) {
    log.info(`  REUSE existing full.mp3 — delete to force re-TTS`);
  } else if (cfg.ttsProvider === "manual") {
    // ── Manual mode: no API call — convert a user-supplied audio file ──
    const source = findManualVoiceFile(outputDir);
    log.info(`  MANUAL voice: converting ${basename(source)} → voice/full.mp3`);
    await runFfmpeg([
      "-y", "-i", source,
      "-vn", "-ar", "44100", "-ac", "1",
      "-c:a", "libmp3lame", "-b:a", "192k",
      fullMp3,
    ]);
  } else {
    log.info(`  TTS full script (${fullText.length} chars) via ${cfg.ttsProvider}...`);
    const ttsClient = createTtsClient(cfg);
    try {
      await ttsClient.generate(fullText, fullMp3);
    } finally {
      await ttsClient.dispose?.();
    }
  }
  const fullDur = await getDurationSec(fullMp3);
  log.info(`  full.mp3 duration: ${fullDur.toFixed(2)}s`);

  const sourceTokenCount = fullText.trim().split(/\s+/).length;
  const runAlign = () =>
    alignAudio({
      audioPath: fullMp3,
      vieneuProjectDir: cfg.vieneuProjectDir,
      workerScript: join(dirname(cfg.vieneuWorkerScript), "align_worker.py"),
      uvBin: cfg.vieneuUvBin,
      language: "vi",
      modelSize: "small",
      // NO initialPrompt. Feeding Whisper the whole transcript as prior context
      // makes it treat the opening as already-said and skip ahead: measured
      // 2026-08-09 on one 1 848-char script, same audio, same model —
      //   with the transcript as prompt: 232 words, first at 30.00s
      //   with no prompt:                357 words, first at  0.00s
      // The prompt is meant to bias spelling of proper nouns, but Whisper only
      // budgets ~224 tokens for it and a full script blows past that. Nothing
      // is lost by dropping it: `realignCaptionsToSource` below re-spells every
      // word against the source text anyway, which is the stronger fix. Longer
      // scripts hit this harder, so the 16:9 roundups (3× a short) would have
      // hit it constantly.
    });

  // 2. Whisper alignment: word-level timings (cached)
  let words: WordTiming[];
  if (existsSync(wordsJsonPath)) {
    log.info(`  REUSE existing full-words.json — delete to force re-align`);
    words = JSON.parse(await readFile(wordsJsonPath, "utf-8")) as WordTiming[];
  } else {
    log.info(`  Aligning full audio → word timings (faster-whisper)...`);
    words = await runAlign();
    await writeFile(wordsJsonPath, JSON.stringify(words, null, 2), "utf-8");
  }
  log.info(`  aligned ${words.length} words across ${fullDur.toFixed(1)}s`);

  if (words.length === 0) {
    throw new Error("Alignment returned 0 words. Check that the TTS audio contains speech.");
  }

  // Whisper can come back having silently skipped a stretch of speech — seen
  // 2026-08-09: 232 words for a 383-word script, the first of them timestamped
  // at 30.0s on audio that is loud from 0.0s. Nothing downstream notices. The
  // realigner pads the gap with synthetic words that inherit degenerate
  // timings, the scene partition then hands the hook 30s and squeezes the two
  // scenes after it into 0.7s and 0.2s, and the pipeline exits 0 on a video
  // nobody can use. So: check the shape of the alignment, retry once (the
  // audio is cached, so a retry costs no TTS quota), and refuse rather than
  // burn a render on it.
  let brokenWhy = alignmentDefect(words, sourceTokenCount, fullDur);
  if (brokenWhy) {
    log.warn(`  ⚠ alignment looks wrong (${brokenWhy}) — re-aligning once`);
    words = await runAlign();
    await writeFile(wordsJsonPath, JSON.stringify(words, null, 2), "utf-8");
    log.info(`  retry aligned ${words.length} words across ${fullDur.toFixed(1)}s`);
    brokenWhy = alignmentDefect(words, sourceTokenCount, fullDur);
    if (brokenWhy) {
      throw new Error(
        `Alignment still wrong after a retry: ${brokenWhy}.\n` +
          `Scene boundaries come from these timings, so rendering now produces sub-second scenes.\n` +
          `voice/full.mp3 is cached (no TTS quota at stake) — delete voice/full-words.json and re-run, ` +
          `or check the audio itself if the defect repeats.`,
      );
    }
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
  const silences = await detectSilences(fullMp3);
  log.info(`  ${silences.length} silence gaps detected — scene cuts will land inside them`);
  let wordIdx = 0;
  let prevCutSec = 0;

  // PASS A — work out every scene boundary first, WITHOUT cutting any audio.
  // The partition has to be inspectable as a whole before it is committed: a
  // single scene starved of audio is only visible next to its neighbours, and
  // by the time ffmpeg has written the mp3s it is too late to reconsider.
  const bounds: Array<{ start: number; end: number; valid: boolean; startIdx: number; endIdx: number }> = [];

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];

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

    // Whisper ends a word at its last loud frame and starts the next one late, so the span
    // between two scenes holds the previous word's tail (Vietnamese ng/nh/c/t decay) AND the
    // next word's onset. Slicing at endWord.end throws that span away — the last syllable of
    // every scene goes missing. Partition the timeline contiguously instead: each scene runs
    // from the previous cut to a cut placed in the silence before the next scene's first word.
    if (hasValidSegment) {
      const alignedWords = isMatch ? realignedWords : words;
      const nextWord = alignedWords[endIdx + 1];
      startSec = i === 0 ? Math.max(0, startSec - VOICE_LEAD_IN_SEC) : prevCutSec;
      endSec = nextWord ? pickSceneCut(endSec, nextWord.start, silences, startSec + 0.2) : fullDur;
      prevCutSec = endSec;
    }

    bounds.push({ start: startSec, end: endSec, valid: hasValidSegment, startIdx, endIdx });
  }

  // REPAIR — a scene starved of audio means the word timings lied, not that the
  // voice actress rushed. Whisper drops real speech silently (measured
  // 2026-08-19: 98 of 131 words transcribed, the entire outro missing from a
  // stretch that meters at -15 dB), and every boundary downstream of the hole
  // is then wrong. `alignmentDefect` above only catches the gross shapes —
  // 75 % coverage and a 3.3 s tail both slipped under its thresholds while one
  // scene came out at 0.94 s for a nine-word line. The reliable signal is not
  // how many words Whisper found, it is whether each scene ended up with the
  // share of audio its OWN word count predicts.
  const speechStart = bounds.find((b) => b.valid)?.start ?? 0;
  const speechSpan = Math.max(0.1, fullDur - speechStart);
  const expectedDur = (i: number) => (sceneWordCounts[i] / Math.max(1, totalSceneWords)) * speechSpan;
  const starved = bounds
    .map((b, i) => ({ i, ratio: b.valid ? (b.end - b.start) / Math.max(0.01, expectedDur(i)) : 0 }))
    .filter((s) => s.ratio < 0.5);

  if (starved.length > 0) {
    const worst = starved.map((s) => `${script.scenes[s.i].id} ${(s.ratio * 100).toFixed(0)}%`).join(", ");
    log.warn(`  ⚠ partition starves ${starved.length} scene(s) (${worst}) — rebuilding it from word SHARE, not word timings`);
    // Lay the scenes out proportionally across the real speech span, then nudge
    // each internal cut into the nearest true silence so the join stays clean.
    let cursorSec = speechStart;
    for (let i = 0; i < bounds.length; i++) {
      const isLast = i === bounds.length - 1;
      const rawEnd = isLast ? fullDur : cursorSec + expectedDur(i);
      const end = isLast ? fullDur : snapToSilence(rawEnd, silences, cursorSec + 0.2, fullDur);
      bounds[i] = { ...bounds[i], start: cursorSec, end, valid: true };
      cursorSec = end;
    }
  }

  // PASS B — commit the partition to disk.
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const outPath = join(voiceDir, `scene-${scene.id}.mp3`);
    const { start: startSec, end: endSec, valid, startIdx, endIdx } = bounds[i];

    if (!valid) {
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

/**
 * Nearest point to `preferred` that sits inside a real silence, searched within
 * ±0.6 s and clamped to [lo, hi]. Falls back to `preferred` when the voice never
 * pauses near there — a cut mid-word beats a scene of the wrong length.
 */
function snapToSilence(
  preferred: number,
  silences: Array<{ start: number; end: number }>,
  lo: number,
  hi: number,
): number {
  const clamp = (t: number) => Math.min(hi, Math.max(lo, t));
  const WINDOW = 0.6;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const s of silences) {
    if (s.end < preferred - WINDOW || s.start > preferred + WINDOW) continue;
    // Inside this silence, the closest legal instant to where we wanted to cut.
    const cand = clamp(Math.min(Math.max(preferred, s.start), s.end));
    const dist = Math.abs(cand - preferred);
    if (dist < bestDist) { best = cand; bestDist = dist; }
  }
  return best ?? clamp(preferred);
}

/**
 * Locate the user-supplied voiceover for TTS_PROVIDER=manual.
 *
 * Resolution order:
 *   1. env VOICE_FILE — absolute (or cwd-relative) path, highest priority
 *      (handy for the /video-queue orchestrator to point at a per-row file).
 *   2. outputDir/voice-source.<ext> — drop-in next to script.json. First match
 *      wins in this extension order: mp4, m4a, mp3, wav, aac, ogg.
 *
 * Throws a clear, actionable error when nothing is found so the run fails loud
 * instead of silently producing a no-speech video.
 */
function findManualVoiceFile(outputDir: string): string {
  const envPath = process.env.VOICE_FILE?.trim();
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(`VOICE_FILE is set but does not exist: ${envPath}`);
    }
    return envPath;
  }
  const exts = ["mp4", "m4a", "mp3", "wav", "aac", "ogg"];
  for (const ext of exts) {
    const p = join(outputDir, `voice-source.${ext}`);
    if (existsSync(p)) return p;
  }
  throw new Error(
    `TTS_PROVIDER=manual but no voice file found. Drop your recording at ` +
      `"${join(outputDir, "voice-source.mp4")}" (or .m4a/.mp3/.wav/.aac/.ogg), ` +
      `or set VOICE_FILE to its absolute path. Tip: place it BEFORE running the pipeline.`,
  );
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

/**
 * Does this alignment describe the audio, or did Whisper lose part of it?
 *
 * Returns a human-readable defect, or null when the timings look usable. The
 * thresholds are deliberately loose — every one of them is unambiguous
 * breakage, not a judgement call:
 *
 *  - **coverage** — Whisper merges and splits tokens, so a word count within
 *    ~20% of the source is normal. Below 55% it did not transcribe a chunk.
 *  - **head** — TTS audio opens on speech within a few hundred ms. A first word
 *    six seconds in means the opening was dropped (the 2026-08-09 case had it
 *    at 30s).
 *  - **tail** — likewise at the end, allowing for the natural trailing pause.
 */
function alignmentDefect(
  words: WordTiming[],
  sourceTokenCount: number,
  fullDur: number,
): string | null {
  if (words.length === 0) return "0 words";

  const coverage = words.length / Math.max(1, sourceTokenCount);
  if (coverage < 0.55) {
    return `only ${words.length}/${sourceTokenCount} words transcribed (${(coverage * 100).toFixed(0)}%)`;
  }
  const head = words[0].start;
  if (head > 6) {
    return `first word at ${head.toFixed(1)}s — the opening was dropped`;
  }
  const tail = fullDur - words[words.length - 1].end;
  if (tail > 10) {
    return `last word ends ${tail.toFixed(1)}s before the audio does`;
  }
  return null;
}

/** Silence intervals in `audioPath`, one ffmpeg pass. Used to place scene cuts where nobody is speaking. */
function detectSilences(audioPath: string): Promise<Array<{ start: number; end: number }>> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-hide_banner", "-i", audioPath,
      "-af", "silencedetect=n=-45dB:d=0.06", "-f", "null", "-",
    ]);
    let err = "";
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("close", () => {
      const out: Array<{ start: number; end: number }> = [];
      let pending: number | null = null;
      for (const line of err.split("\n")) {
        const s = line.match(/silence_start:\s*(-?[\d.]+)/);
        if (s) { pending = parseFloat(s[1]); continue; }
        const e = line.match(/silence_end:\s*([\d.]+)/);
        if (e && pending !== null) { out.push({ start: pending, end: parseFloat(e[1]) }); pending = null; }
      }
      resolve(out);
    });
    proc.on("error", reject);
  });
}

/** How far outside the word gap to look for the real pause when Whisper's timings have drifted. */
const CUT_SNAP_SEC = 0.6;

/**
 * Where to split two adjacent scenes. Whisper ends a word at its last loud frame and starts
 * the next one late, so the span between them holds the previous word's tail AND the next
 * word's onset. Cut in the middle of the silence separating them. When Whisper reports no
 * span at all (end === next start) its timings have drifted off the real sentence boundary,
 * so widen the search — the pause is nearby, just not where Whisper put it.
 */
function pickSceneCut(
  prevEnd: number,
  nextStart: number,
  silences: Array<{ start: number; end: number }>,
  floor: number,
): number {
  const midpointOfWidest = (lo: number, hi: number): number | null => {
    const overlapping = silences
      .filter((s) => s.end > lo && s.start < hi)
      .map((s) => ({ start: Math.max(s.start, lo), end: Math.min(s.end, hi) }))
      .filter((s) => s.end > s.start && (s.start + s.end) / 2 > floor)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start));
    return overlapping.length > 0 ? (overlapping[0].start + overlapping[0].end) / 2 : null;
  };

  const inGap = nextStart > prevEnd ? midpointOfWidest(prevEnd, nextStart) : null;
  if (inGap !== null) return inGap;

  const snapped = midpointOfWidest(prevEnd - CUT_SNAP_SEC, nextStart + CUT_SNAP_SEC);
  if (snapped !== null) return snapped;

  return Math.max(nextStart > prevEnd ? (prevEnd + nextStart) / 2 : nextStart, floor);
}
