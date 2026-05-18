import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { loadConfig, type Config } from "../config.js";
import { createTtsClient, type TtsClient } from "../tts/tts-client.js";
import { ElevenLabsClient } from "../tts/elevenlabs-client.js";
import { VieNeuClient } from "../tts/vieneu-client.js";
import { AusynclabClient } from "../tts/ausynclab-client.js";
import { getDurationSec } from "../assets/audio-tools.js";
import { log } from "../utils/logger.js";
import { alignAudio, type WordTiming } from "./align.js";
import { buildAssFromChunks, buildAssFromSentences, buildAssFromWords } from "./caption-ass.js";
import { realignCaptionsToSource } from "./realign-to-source.js";
import { composeVideo, probeVideo, writeAssFile } from "./video-compose.js";

const TOTAL_STEPS = 6;

/**
 * Build a 9:16 TikTok podcast clip from a .txt script + a sibling video file.
 *
 * Input layout (must hold both files):
 *   input/<slug>/<slug>.txt   ← podcast script (any Vietnamese prose)
 *   input/<slug>/<slug>.mp4   ← user-supplied background video
 *
 * Output:
 *   output/<slug>/<slug>.mp4    ← final clip (the deliverable)
 *   output/<slug>/voice.mp3     ← TTS audio (intermediate, reused on rerun)
 *   output/<slug>/words.json    ← word alignment (intermediate, reused on rerun)
 *   output/<slug>/captions.ass  ← karaoke subtitle file
 */
export interface PodcastPipelineOpts {
  /**
   * Optional override for the background-music file. Resolution rules:
   *   1) Empty/undefined → fall back to env / auto-discovery.
   *   2) Path containing a separator OR absolute path → used as-is.
   *   3) Bare filename (no separator) → resolved against `assets/beat/`.
   * The file may be mp3 / m4a / wav / mp4 — anything ffmpeg can decode audio
   * from. Passed to the compose step, which extracts the audio track.
   */
  musicOverride?: string;
}

export async function runPodcastPipeline(txtPath: string, opts: PodcastPipelineOpts = {}): Promise<void> {
  const cfg = loadConfig();
  if (cfg.ttsProvider !== "vieneu") {
    // The alignment worker runs inside the VieNeu uv env. Other providers are
    // technically OK for TTS but lose the env we lean on for faster-whisper.
    log.warn(`TTS_PROVIDER=${cfg.ttsProvider} but alignment expects the VieNeu Python env — proceeding anyway.`);
  }

  // STEP 1: validate inputs
  log.step(1, TOTAL_STEPS, "Validate inputs (.txt + sibling video)");
  const absTxt = resolvePath(txtPath);
  if (!existsSync(absTxt)) throw new Error(`Source .txt not found: ${absTxt}`);
  if (extname(absTxt).toLowerCase() !== ".txt") {
    throw new Error(`Expected a .txt file, got: ${absTxt}`);
  }
  const inputDir = dirname(absTxt);
  const slug = basename(absTxt, ".txt");
  const sourceVideoPaths = findSiblingVideos(inputDir, slug);
  if (sourceVideoPaths.length === 0) {
    throw new Error(
      `No sibling video found. Place one or more videos next to ${absTxt} named ${slug}.{mp4,mov,webm,mkv,m4v} (optionally numbered: ${slug}2.mp4, ${slug}3.mp4, …).`,
    );
  }

  const text = (await readFile(absTxt, "utf-8")).trim();
  if (!text) throw new Error(`Source .txt is empty: ${absTxt}`);
  const speakText = normalizeForTts(text);
  log.info(`  slug=${slug}  voice-chars=${speakText.length}  source-videos=${sourceVideoPaths.length} (${sourceVideoPaths.map((p) => basename(p)).join(", ")})`);

  // Output dir
  const outputDir = join(resolvePath(inputDir, "..", "..", "output"), slug);
  await mkdir(outputDir, { recursive: true });

  // Probe every source video (also a sanity check that ffmpeg can read them)
  let totalSourceDur = 0;
  for (const p of sourceVideoPaths) {
    const probe = await probeVideo(p);
    totalSourceDur += probe.durationSec;
    log.info(`  source: ${basename(p)} ${probe.width}x${probe.height}, ${probe.durationSec.toFixed(1)}s`);
  }
  log.info(`  total source duration: ${totalSourceDur.toFixed(1)}s`);

  // STEP 2: TTS (skipped if voice.mp3 already exists — idempotent)
  const { client: tts, label: ttsLabel } = createPodcastTts(cfg);
  log.step(2, TOTAL_STEPS, `Generate TTS via ${ttsLabel}`);
  const voiceMp3 = join(outputDir, "voice.mp3");
  if (existsSync(voiceMp3)) {
    log.info(`  REUSE existing voice.mp3 — delete to force re-TTS`);
  } else {
    try {
      await tts.generate(speakText, voiceMp3);
    } finally {
      await tts.dispose?.();
    }
  }
  const ttsDurationSec = await getDurationSec(voiceMp3);
  log.info(`  voice.mp3 duration: ${ttsDurationSec.toFixed(2)}s`);

  // STEP 3: word-level alignment (skipped if words.json exists)
  log.step(3, TOTAL_STEPS, "Align voice audio → per-word timestamps (faster-whisper)");
  const wordsJson = join(outputDir, "words.json");
  let words: WordTiming[];
  if (existsSync(wordsJson)) {
    log.info(`  REUSE existing words.json — delete to force re-align`);
    words = JSON.parse(await readFile(wordsJson, "utf-8")) as WordTiming[];
  } else {
    words = await alignAudio({
      audioPath: voiceMp3,
      vieneuProjectDir: cfg.vieneuProjectDir,
      workerScript: join(dirname(cfg.vieneuWorkerScript), "align_worker.py"),
      uvBin: cfg.vieneuUvBin,
      language: process.env.PODCAST_ALIGN_LANG?.trim() || "vi",
      modelSize: (process.env.PODCAST_ALIGN_MODEL?.trim() as "small" | undefined) || "small",
    });
    await writeFile(wordsJson, JSON.stringify(words, null, 2), "utf-8");
  }
  log.info(`  aligned ${words.length} words across ${ttsDurationSec.toFixed(1)}s`);

  if (words.length === 0) {
    throw new Error("Alignment returned 0 words. Check that the TTS audio actually contains speech.");
  }

  // STEP 3.5: realign Whisper timings to source-text spelling. Whisper is
  // allowed to mis-spell proper nouns / foreign brand names / numbers; we
  // throw away its text and keep only its timings, then use the user's exact
  // .txt words for captions. Guarantees captions spell things the way the
  // user wrote them (correct Vietnamese diacritics, "Casemiro" not
  // "Cát-xê-mi-rô", "FA Cup" not "ép a cập").
  const { words: realignedWords, report } = realignCaptionsToSource(words, speakText);
  log.info(
    `  realigned to source: ${report.unchanged} identical, ${report.replaced} spelling-corrected, ${report.inserted} interpolated, ${report.dropped} Whisper-hallucinations dropped`,
  );
  if (report.replacedSamples.length > 0) {
    const preview = report.replacedSamples.slice(0, 4).map((p) => `"${p.whisper}" → "${p.source}"`).join("; ");
    log.info(`    corrected: ${preview}${report.replacedSamples.length > 4 ? " …" : ""}`);
  }
  if (report.insertedSamples.length > 0) {
    log.info(`    interpolated (Whisper missed): ${report.insertedSamples.slice(0, 4).join(", ")}${report.insertedSamples.length > 4 ? " …" : ""}`);
  }
  if (report.droppedSamples.length > 0) {
    log.info(`    dropped (Whisper extra): ${report.droppedSamples.slice(0, 4).join(", ")}${report.droppedSamples.length > 4 ? " …" : ""}`);
  }
  // Save the realigned words next to words.json so the user can inspect.
  await writeFile(join(outputDir, "words-realigned.json"), JSON.stringify(realignedWords, null, 2), "utf-8");
  words = realignedWords;

  // Layout — `card` (default, the redesigned TikTok/Reels podcast clip:
  // square 880×880 video card centered vertically inside a thin white outline,
  // small logo + brand text aligned with the outline's left edge above the
  // card) or `vignette` (legacy viral-clip aesthetic with blurred-source bg,
  // search bar, watermark, progress bar).
  const layoutEnv = (process.env.PODCAST_LAYOUT?.trim().toLowerCase() ?? "card");
  const layout: "vignette" | "card" = layoutEnv === "vignette" ? "vignette" : "card";

  // Foreground card layout. Explicit width/height/y env vars take precedence.
  // Defaults vary by layout: vignette gets a tall portrait card (760×1240 at
  // y=300, sitting below the search bar); card gets the 3:4 small card
  // (660×880 at y=240). Legacy FG_MARGIN still works as a tertiary fallback.
  const fgWidthEnv = process.env.PODCAST_FG_WIDTH?.trim();
  const fgHeightEnv = process.env.PODCAST_FG_HEIGHT?.trim();
  const fgYEnv = process.env.PODCAST_FG_Y?.trim();
  const fgXEnv = process.env.PODCAST_FG_X?.trim();
  const fgMarginEnv = process.env.PODCAST_FG_MARGIN?.trim();
  // Square card defaults (redesign 2026-05-17). Both vignette + card layouts
  // use a square 880×880 foreground. For card layout, the card is also
  // vertically CENTERED on the 1080×1920 canvas (y=520) so equal black space
  // above + below frames it cleanly — TikTok/Reels production aesthetic.
  // Vignette keeps y=300 since it has a search bar + progress bar that need
  // room above and below.
  const defaultW = 880;
  const defaultH = 880;
  const defaultY = layout === "vignette" ? 300 : 520;
  let foregroundWidth: number;
  let foregroundHeight: number;
  let foregroundY: number;
  let foregroundX: number | undefined;
  if (fgWidthEnv || fgHeightEnv || fgYEnv || fgXEnv) {
    foregroundWidth = parseInt(fgWidthEnv ?? String(defaultW), 10);
    foregroundHeight = parseInt(fgHeightEnv ?? String(defaultH), 10);
    foregroundY = parseInt(fgYEnv ?? String(defaultY), 10);
    if (fgXEnv) foregroundX = parseInt(fgXEnv, 10);
  } else if (fgMarginEnv) {
    const m = parseInt(fgMarginEnv, 10);
    foregroundWidth = 1080 - 2 * m;
    foregroundHeight = 1920 - 2 * m;
    foregroundY = m;
  } else {
    foregroundWidth = defaultW;
    foregroundHeight = defaultH;
    foregroundY = defaultY;
  }
  log.info(`  layout: ${layout}  fg card: ${foregroundWidth}x${foregroundHeight} at y=${foregroundY}${foregroundX !== undefined ? `, x=${foregroundX}` : " (centered)"}`);

  // Derive logo defaults from card position so the brand-shell aligns with
  // the card outline's left edge (same vertical line) and sits just above
  // the card with a breathing gap. Only applies when no explicit logo env
  // is set — users can still override every value.
  const cardLeftXResolved = foregroundX !== undefined ? foregroundX : Math.floor((1080 - foregroundWidth) / 2);
  const cardStrokeResolved = parseInt(process.env.PODCAST_CARD_STROKE ?? (
    layout === "card"
      ? "8"
      : ((process.env.PODCAST_VIGNETTE_BG ?? "true").toLowerCase() !== "false" ? "0" : "4")
  ), 10);
  const outlineLeftX = Math.max(0, cardLeftXResolved - cardStrokeResolved);
  const outlineTopY = Math.max(0, foregroundY - cardStrokeResolved);
  // Card layout: logo aligns with outline-left, smaller size + smaller brand
  // text. Vignette: keep legacy sizing.
  const defaultLogoWidth = layout === "card" ? 60 : 90;
  const defaultLogoMargin = layout === "card" ? outlineLeftX : 60;
  const logoWidthResolved = parseInt(process.env.PODCAST_LOGO_WIDTH ?? String(defaultLogoWidth), 10);
  const logoMarginResolved = parseInt(process.env.PODCAST_LOGO_MARGIN ?? String(defaultLogoMargin), 10);
  // Card layout: logo sits 24px above the outline top edge.
  const defaultLogoMarginTop = layout === "card"
    ? Math.max(0, outlineTopY - logoWidthResolved - 24)
    : undefined;
  const logoMarginTopResolved = process.env.PODCAST_LOGO_MARGIN_TOP
    ? parseInt(process.env.PODCAST_LOGO_MARGIN_TOP, 10)
    : defaultLogoMarginTop;
  const defaultBrandNameFs = layout === "card" ? 22 : 32;
  const defaultBrandTagFs = layout === "card" ? 14 : 18;

  // STEP 4: build .ass karaoke subtitle file
  log.step(4, TOTAL_STEPS, "Generate karaoke .ass subtitle");
  const captionY = process.env.PODCAST_CAPTION_Y?.trim();
  // Caption mode:
  //   "chunks" — viral-clip 2-4 word chunks ALL CAPS (default for vignette).
  //   "sentence" — full current sentence with active word highlighted.
  //   "word" — classic 3-word sliding karaoke window.
  const captionModeEnv = process.env.PODCAST_CAPTION_MODE?.trim().toLowerCase();
  const captionMode: "chunks" | "sentence" | "word" =
    captionModeEnv === "chunks" || (captionModeEnv == null && layout === "vignette")
      ? "chunks"
      : captionModeEnv === "word"
        ? "word"
        : "sentence";
  // Auto-anchor caption position based on layout + card geometry.
  //   - vignette: place captions in the lower-1/4 of the card (overlay the
  //     bottom portion of the sharp video). Center of caption ~ cardY + cardH*0.78.
  //   - card: place captions BELOW the card (180px gap), if room allows;
  //     otherwise fall back to the caption module's default.
  const cardBottom = foregroundY + foregroundHeight;
  let captionAutoY: number | undefined;
  if (layout === "vignette") {
    captionAutoY = (foregroundY + foregroundHeight * 0.78) / 1920;
  } else if (cardBottom <= 1400) {
    // 50px gap below the card bottom — captions sit TIGHT beneath the
    // outline so the eye reads card → caption as one unit.
    captionAutoY = (cardBottom + 50) / 1920;
  }
  // Caption wrap margins — constrain captions to stay strictly inside the
  // card outline (not bleeding past the white stroke). Each side gets:
  //   margin = (canvas edge → card edge) + inset
  // where `inset` is small breathing room inside the card. For chunks mode
  // (vignette default), WrapStyle 0 then breaks long chunks onto multiple
  // lines instead of overflowing past the card.
  const cardLeftPx = foregroundX !== undefined ? foregroundX : Math.floor((1080 - foregroundWidth) / 2);
  const cardRightPx = cardLeftPx + foregroundWidth;
  const inset = parseInt(process.env.PODCAST_CAPTION_INSET ?? "30", 10);
  const captionMarginL = Math.max(0, cardLeftPx + inset);
  const captionMarginR = Math.max(0, (1080 - cardRightPx) + inset);
  const captionOpts = {
    font: process.env.PODCAST_CAPTION_FONT?.trim() || undefined,
    fontSize: process.env.PODCAST_CAPTION_FONTSIZE ? parseInt(process.env.PODCAST_CAPTION_FONTSIZE, 10) : undefined,
    yPosition: captionY ? parseFloat(captionY) : captionAutoY,
    marginL: captionMarginL,
    marginR: captionMarginR,
  };
  const assContent = captionMode === "chunks"
    ? buildAssFromChunks(words, captionOpts)
    : captionMode === "sentence"
      ? buildAssFromSentences(words, captionOpts)
      : buildAssFromWords(words, captionOpts);
  log.info(`  caption mode: ${captionMode}`);
  const assPath = join(outputDir, "captions.ass");
  await writeAssFile(assContent, assPath);
  log.info(`  wrote ${basename(assPath)}`);

  // STEP 4.5: generate outro voice (idempotent — reused if file already exists).
  // The outro card needs a brief TTS line that plays during the outro phase.
  // We use the same TTS provider as the main voice for tonal consistency.
  const outroEnabled = (process.env.PODCAST_OUTRO_ENABLED ?? "true").toLowerCase() !== "false";
  const outroSec = parseFloat(process.env.PODCAST_OUTRO_SEC ?? "5");
  const tailSec = parseFloat(process.env.PODCAST_TAIL_SEC ?? "7");
  const outroText = process.env.PODCAST_OUTRO_TEXT?.trim() ||
    "Theo dõi Sports For All Ti Vi để xem nhiều phân tích sâu hơn mỗi tuần.";
  let outroVoicePath: string | null = null;
  if (outroEnabled && outroSec > 0) {
    const outroMp3 = join(outputDir, "outro-voice.mp3");
    if (existsSync(outroMp3)) {
      log.info(`  REUSE existing outro-voice.mp3 — delete to force re-TTS`);
    } else {
      const { client: outroTts } = createPodcastTts(cfg);
      try {
        await outroTts.generate(outroText, outroMp3);
      } finally {
        await outroTts.dispose?.();
      }
    }
    outroVoicePath = outroMp3;
  }

  // STEP 5: compose final video
  log.step(5, TOTAL_STEPS, "Compose 9:16 video (black bars + rounded-corner foreground + burn captions + mux TTS)");
  const finalMp4 = join(outputDir, `${slug}.mp4`);

  // Background music resolution order:
  //   1) CLI arg (opts.musicOverride)
  //   2) PODCAST_BG_MUSIC env
  //   3) Auto-discover assets/beat/input.{m4a,mp3,wav,mp4}
  // For each rule: bare filenames (no separator) resolve against assets/beat/.
  // An empty string disables music regardless of other sources.
  const repoRoot = resolvePath(inputDir, "..", "..");
  const beatDir = join(repoRoot, "assets", "beat");
  const resolveBeat = (s: string): string => {
    const trimmed = s.trim();
    // No path separators → treat as a filename inside assets/beat/
    if (!trimmed.includes("/") && !trimmed.includes("\\") && !isAbsolute(trimmed)) {
      return join(beatDir, trimmed);
    }
    return resolvePath(trimmed);
  };

  let bgMusicPath: string | null = null;
  if (opts.musicOverride !== undefined) {
    bgMusicPath = opts.musicOverride.trim() ? resolveBeat(opts.musicOverride) : null;
  } else if (process.env.PODCAST_BG_MUSIC !== undefined) {
    bgMusicPath = process.env.PODCAST_BG_MUSIC.trim() ? resolveBeat(process.env.PODCAST_BG_MUSIC) : null;
  } else {
    for (const ext of ["m4a", "mp3", "wav", "mp4"]) {
      const candidate = join(beatDir, `input.${ext}`);
      if (existsSync(candidate)) {
        bgMusicPath = candidate;
        break;
      }
    }
  }
  if (bgMusicPath) {
    if (!existsSync(bgMusicPath)) {
      throw new Error(`Background music file not found: ${bgMusicPath}`);
    }
    log.info(`  bg music: ${bgMusicPath}`);
  }

  // Logo overlay: default to assets/logoPodcast.png when present;
  // PODCAST_LOGO env overrides (empty string disables).
  const logoEnv = process.env.PODCAST_LOGO;
  let logoPath: string | null = null;
  if (logoEnv !== undefined) {
    logoPath = logoEnv.trim() ? resolvePath(logoEnv.trim()) : null;
  } else {
    const defaultLogo = join(repoRoot, "assets", "logoPodcast.png");
    if (existsSync(defaultLogo)) logoPath = defaultLogo;
  }
  if (logoPath) {
    log.info(`  logo: ${logoPath}`);
  }

  await composeVideo({
    sourceVideoPaths,
    ttsAudioPath: voiceMp3,
    assPath,
    outPath: finalMp4,
    ttsDurationSec,
    fps: parseInt(process.env.PODCAST_FPS ?? "30", 10),
    crf: parseInt(process.env.PODCAST_CRF ?? "20", 10),
    preset: process.env.PODCAST_PRESET || "medium",
    layout,
    cornerRadius: parseInt(process.env.PODCAST_CORNER_RADIUS ?? (layout === "vignette" ? "20" : "40"), 10),
    // Default stroke: card layout always 4; vignette layout depends on blur
    // bg — when blur bg is on, rounded corners read against the colored blur;
    // when bg is pure-black (PODCAST_VIGNETTE_BG=false), bump to 4 so the
    // corners aren't lost as black-on-black.
    cardStrokeWidth: cardStrokeResolved,
    foregroundWidth,
    foregroundHeight,
    foregroundY,
    foregroundX,
    foregroundFit: (process.env.PODCAST_FG_FIT?.trim().toLowerCase() === "contain" ? "contain" : "cover") as "cover" | "contain",
    foregroundCropBottom: process.env.PODCAST_FG_CROP_BOTTOM ? parseInt(process.env.PODCAST_FG_CROP_BOTTOM, 10) : undefined,
    foregroundCropAnchor: ((): "top" | "center" | "bottom" => {
      const v = process.env.PODCAST_FG_CROP_ANCHOR?.trim().toLowerCase();
      return v === "center" || v === "bottom" ? v : "top";
    })(),
    vignetteBlurSigma: parseFloat(process.env.PODCAST_VIGNETTE_BLUR ?? "40"),
    vignetteBrightness: parseFloat(process.env.PODCAST_VIGNETTE_BRIGHTNESS ?? "-0.3"),
    vignetteSaturation: parseFloat(process.env.PODCAST_VIGNETTE_SATURATION ?? "0.7"),
    searchBarText: process.env.PODCAST_SEARCHBAR_TEXT ?? (layout === "vignette" ? "Tìm nội dung liên quan" : ""),
    watermarkText: process.env.PODCAST_WATERMARK_TEXT ?? (layout === "vignette" ? "Sports For All Podcast" : ""),
    progressBarEnabled: (process.env.PODCAST_PROGRESS_BAR ?? "true").toLowerCase() !== "false",
    playButtonEnabled: (process.env.PODCAST_PLAY_BUTTON ?? "false").toLowerCase() === "true",
    vignetteBgEnabled: (process.env.PODCAST_VIGNETTE_BG ?? "true").toLowerCase() !== "false",
    backgroundMusicPath: bgMusicPath ?? undefined,
    bgMusicVolume: parseFloat(process.env.PODCAST_BG_MUSIC_VOLUME ?? "0.15"),
    logoPath: logoPath ?? undefined,
    logoWidth: logoWidthResolved,
    logoMargin: logoMarginResolved,
    logoMarginTop: logoMarginTopResolved,
    logoCornerRadius: parseInt(process.env.PODCAST_LOGO_RADIUS ?? "12", 10),
    // In vignette mode, the watermark drawtext on the card replaces the
    // brand-shell — suppress the brand text unless explicitly set.
    brandName: process.env.PODCAST_BRAND_NAME ?? (layout === "vignette" ? "" : (process.env.TIKTOK_DISPLAY_NAME ?? "SportsForAllPodcast")),
    brandTag: process.env.PODCAST_BRAND_TAG ?? (layout === "vignette" ? "" : "PODCAST"),
    brandNameFontSize: parseInt(process.env.PODCAST_BRAND_NAME_FONTSIZE ?? String(defaultBrandNameFs), 10),
    brandTagFontSize: parseInt(process.env.PODCAST_BRAND_TAG_FONTSIZE ?? String(defaultBrandTagFs), 10),
    tailSec,
    outroSec: outroEnabled ? outroSec : 0,
    outroAudioPath: outroVoicePath,
    outroChannelName: process.env.PODCAST_OUTRO_CHANNEL ?? cfg.tiktok.displayName ?? "SportsForAllTV",
    outroHandle: process.env.PODCAST_OUTRO_HANDLE ?? cfg.tiktok.handle ?? "@bonglan0702",
    outroFollowers: process.env.PODCAST_OUTRO_FOLLOWERS ?? cfg.tiktok.followers ?? "1.2M followers",
    outroCta: process.env.PODCAST_OUTRO_CTA ?? "Theo dõi ngay",
    outroSource: process.env.PODCAST_OUTRO_SOURCE ?? "Sưu tầm",
  });

  // STEP 6: done
  log.step(6, TOTAL_STEPS, "Done");
  console.log("\n=== Result ===");
  console.log(`Video:  ${finalMp4}`);
  console.log(`Voice:  ${voiceMp3}`);
  console.log(`Words:  ${wordsJson}`);
  console.log(`Total:  ${ttsDurationSec.toFixed(2)}s`);
}

/**
 * Pick a TTS client for the podcast pipeline. Podcast voice is the product
 * here, so allow an override independent of the global TTS_PROVIDER (which
 * stays on VieNeu for motion-graphic). Resolution order:
 *   1) PODCAST_TTS_PROVIDER env (explicit) — "elevenlabs" | "vieneu" | "ausynclab"
 *   2) ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID present → ElevenLabs (auto)
 *   3) Global cfg.ttsProvider (VieNeu by default)
 */
function createPodcastTts(cfg: Config): { client: TtsClient; label: string } {
  const override = process.env.PODCAST_TTS_PROVIDER?.trim().toLowerCase();
  const allowed = ["elevenlabs", "vieneu", "ausynclab"];
  if (override && !allowed.includes(override)) {
    throw new Error(`PODCAST_TTS_PROVIDER must be ${allowed.join("|")}, got "${override}"`);
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
  const elevenVoice = process.env.ELEVENLABS_VOICE_ID?.trim();
  const wantEleven = override === "elevenlabs" || (!override && elevenKey && elevenVoice);

  if (wantEleven) {
    if (!elevenKey || !elevenVoice) {
      throw new Error("PODCAST_TTS_PROVIDER=elevenlabs requires ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID");
    }
    const modelId = process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2";
    return {
      client: new ElevenLabsClient({
        apiKey: elevenKey,
        voiceId: elevenVoice,
        modelId,
        endpoint: process.env.ELEVENLABS_ENDPOINT?.trim() || "https://api.elevenlabs.io/v1",
        stability: floatEnv("ELEVENLABS_STABILITY"),
        similarityBoost: floatEnv("ELEVENLABS_SIMILARITY_BOOST"),
        style: floatEnv("ELEVENLABS_STYLE"),
        useSpeakerBoost: boolEnv("ELEVENLABS_SPEAKER_BOOST"),
      }),
      label: `elevenlabs (model=${modelId}, voice=${elevenVoice})`,
    };
  }

  if (override === "vieneu") {
    return {
      client: new VieNeuClient({
        projectDir: cfg.vieneuProjectDir,
        workerScript: cfg.vieneuWorkerScript,
        voiceId: cfg.vieneuVoiceId,
        emotion: cfg.vieneuEmotion,
        uvBin: cfg.vieneuUvBin,
      }),
      label: `vieneu (voice=${cfg.vieneuVoiceId})`,
    };
  }

  if (override === "ausynclab") {
    if (!cfg.ausynclabApiKey) {
      throw new Error("PODCAST_TTS_PROVIDER=ausynclab requires AUSYNCLAB_API_KEY");
    }
    // Podcast-specific overrides. The global AUSYNCLAB_VOICE_ID / AUSYNCLAB_SPEED
    // stay on the channel's main /create-video config; PODCAST_AUSYNCLAB_VOICE_ID
    // and PODCAST_AUSYNCLAB_SPEED let the podcast pipeline pick its own narrator
    // and pacing without per-run env juggling. Speed is a duration multiplier
    // (lower = faster, higher = slower — counter-intuitive, see
    // memory/project_ausynclab_speed_quirk.md).
    const podcastVoiceEnv = process.env.PODCAST_AUSYNCLAB_VOICE_ID?.trim();
    const podcastVoiceId = podcastVoiceEnv ? parseInt(podcastVoiceEnv, 10) : cfg.ausynclabVoiceId;
    if (!podcastVoiceId) {
      throw new Error("PODCAST_TTS_PROVIDER=ausynclab requires PODCAST_AUSYNCLAB_VOICE_ID or AUSYNCLAB_VOICE_ID");
    }
    const podcastSpeedEnv = process.env.PODCAST_AUSYNCLAB_SPEED?.trim();
    const podcastSpeed = podcastSpeedEnv ? parseFloat(podcastSpeedEnv) : cfg.ausynclabSpeed;
    return {
      client: new AusynclabClient({
        apiKey: cfg.ausynclabApiKey,
        voiceId: podcastVoiceId,
        modelName: cfg.ausynclabModelName,
        speed: podcastSpeed,
        baseUrl: cfg.ausynclabBaseUrl,
        pollIntervalMs: cfg.ausynclabPollIntervalMs,
        pollTimeoutMs: cfg.ausynclabPollTimeoutMs,
      }),
      label: `ausynclab (model=${cfg.ausynclabModelName}, voice=${podcastVoiceId}${podcastVoiceEnv ? " [podcast-override]" : ""}, speed=${podcastSpeed}${podcastSpeedEnv ? " [podcast-override]" : ""})`,
    };
  }

  return {
    client: createTtsClient(cfg),
    label: cfg.ttsProvider === "vieneu" ? `vieneu (voice=${cfg.vieneuVoiceId})` : cfg.ttsProvider,
  };
}

function floatEnv(name: string): number | undefined {
  const v = process.env[name]?.trim();
  if (!v) return undefined;
  const n = parseFloat(v);
  if (isNaN(n)) throw new Error(`Env var ${name} must be a number, got "${v}"`);
  return n;
}

function boolEnv(name: string): boolean | undefined {
  const v = process.env[name]?.trim().toLowerCase();
  if (!v) return undefined;
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Find every sibling video file in `dir` whose basename starts with `slug` and
 * has a recognized extension, sorted in natural order so that
 *   slug.mp4 < slug2.mp4 < slug10.mp4
 * (i.e. multi-digit suffixes don't break the order). The base file with no
 * numeric suffix always sorts first; the rest are ordered by their numeric
 * suffix, then by extension.
 */
function findSiblingVideos(dir: string, slug: string): string[] {
  const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "mkv", "m4v"]);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const slugLower = slug.toLowerCase();
  const matched: Array<{ path: string; suffixNum: number; ext: string; name: string }> = [];
  for (const name of entries) {
    const ext = extname(name).toLowerCase().replace(/^\./, "");
    if (!VIDEO_EXTS.has(ext)) continue;
    const stem = name.slice(0, name.length - ext.length - 1).toLowerCase();
    if (stem !== slugLower && !stem.startsWith(slugLower)) continue;
    // Extract the numeric suffix after the slug, or 0 for the bare slug.
    const rest = stem.slice(slugLower.length);
    if (rest !== "" && !/^\d+$/.test(rest)) continue; // only allow bare or slug<digits>
    const suffixNum = rest === "" ? 0 : parseInt(rest, 10);
    matched.push({ path: join(dir, name), suffixNum, ext, name });
  }
  matched.sort((a, b) => a.suffixNum - b.suffixNum || a.ext.localeCompare(b.ext));
  return matched.map((m) => m.path);
}

/**
 * Lightly clean the source .txt before sending to TTS.
 *
 * - Strip markdown-style heading lines (`# Foo`, `## Bar`) so the voice doesn't
 *   read "hash hash" or pause awkwardly on label lines.
 * - Strip standalone label lines ("Key facts:", "Context:") that look like
 *   structure markers in refine-txt output.
 * - Collapse 3+ blank lines to a paragraph break (single blank).
 *
 * Anything inside actual sentences passes through untouched so the user keeps
 * full control over what gets spoken.
 */
function normalizeForTts(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s/.test(line)) continue;                 // markdown heading
    if (/^[A-Za-zÀ-ỹ ]{1,30}:$/.test(line)) continue;    // bare label ("Key facts:")
    cleaned.push(line);
  }
  // Collapse runs of blank lines.
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
