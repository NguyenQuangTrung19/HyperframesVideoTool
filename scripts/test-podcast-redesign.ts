/**
 * Visual-only test for the redesigned podcast layout.
 *
 * What this verifies:
 *   - Foreground card is square (880×880 default)
 *   - Source video is cropped from the BOTTOM (top preserved) — see neymar's head/face
 *   - Logo + "SportsForAllPodcast" brand-shell sits close to the card top, not at canvas top
 *
 * No TTS, no music, no captions — pure visual layout test. Uses neymar.mp4
 * (18.2s) as the source so the render is fast and well under 30s.
 *
 * Run:  npx tsx scripts/test-podcast-redesign.ts
 * Output: output/test-podcast-redesign/test.mp4
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { composeVideo, writeAssFile } from "../src/podcast/video-compose.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const SOURCE_VIDEO = resolve(REPO_ROOT, "input/neymar/neymar.mp4");
const OUT_DIR = resolve(REPO_ROOT, "output/test-podcast-redesign");
const SILENT_AUDIO = join(OUT_DIR, "silent.mp3");
const EMPTY_ASS = join(OUT_DIR, "captions.ass");
// Crop anchor: "top" preserves the upper portion (default for podcast use —
// face/scoreboard usually sits in the top half). "center" preserves the
// middle (cuts equally from top + bottom). Switch via the CROP_ANCHOR env.
const CROP_ANCHOR = ((): "top" | "center" | "bottom" => {
  const v = process.env.CROP_ANCHOR?.trim().toLowerCase();
  return v === "center" || v === "bottom" ? v : "top";
})();
const OUT_VIDEO = join(OUT_DIR, `test-${CROP_ANCHOR}.mp4`);
const LOGO = resolve(REPO_ROOT, "assets/logoPodcast.png");

const DURATION_SEC = 18.0;

async function ensureSilentAudio(): Promise<void> {
  if (existsSync(SILENT_AUDIO)) return;
  console.log(`▶ generating ${DURATION_SEC}s silent audio...`);
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `anullsrc=channel_layout=stereo:sample_rate=44100`,
    "-t", String(DURATION_SEC),
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    SILENT_AUDIO,
  ]);
}

async function ensureEmptyAss(): Promise<void> {
  // Minimal empty .ass file — no events, just headers. Subtitles filter
  // requires a valid file but rendering 0 lines is fine.
  const content =
    `[Script Info]\n` +
    `ScriptType: v4.00+\n` +
    `PlayResX: 1080\n` +
    `PlayResY: 1920\n` +
    `WrapStyle: 0\n` +
    `ScaledBorderAndShadow: yes\n` +
    `\n` +
    `[V4+ Styles]\n` +
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `Style: Default,Segoe UI,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,30,30,200,1\n` +
    `\n` +
    `[Events]\n` +
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  await writeAssFile(content, EMPTY_ASS);
}

async function main(): Promise<void> {
  if (!existsSync(SOURCE_VIDEO)) {
    throw new Error(`Source video not found: ${SOURCE_VIDEO}`);
  }
  if (!existsSync(LOGO)) {
    throw new Error(`Logo not found: ${LOGO}`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  await ensureSilentAudio();
  await ensureEmptyAss();

  // Layout dimensions for the redesigned podcast clip:
  //   - Card: 880×880 (square), vertically centered on the 1080×1920 canvas
  //   - Outline: 8px white stroke (thicker than default 4px so it reads more
  //     as a "frame"; cap raised to 80px in compose.ts for further widening)
  //   - Logo: 60px small, aligned with the outline's LEFT edge (same X col)
  //   - Brand text: sits beside the logo, both above the card with breathing gap
  const fgW = 880;
  const fgH = 880;
  const fgX = (1080 - fgW) / 2;          // = 100, horizontal centre
  const fgY = (1920 - fgH) / 2;          // = 520, vertical centre
  const stroke = 8;                       // outline thickness
  const outlineLeftX = fgX - stroke;      // = 92 — visible left edge of outline
  const logoW = 60;                       // small logo
  const logoTopGap = 24;                  // gap between logo bottom and outline top
  // logoMarginTop = outline_top - logo_height - gap
  //               = (fgY - stroke) - logoW - logoTopGap
  //               = 512 - 60 - 24 = 428
  const logoY = fgY - stroke - logoW - logoTopGap;

  console.log(`▶ compose: 880×880 square card centered at y=${fgY}, outline ${stroke}px, logo ${logoW}px aligned with outline-left at x=${outlineLeftX}, y=${logoY}`);
  await composeVideo({
    sourceVideoPaths: [SOURCE_VIDEO],
    ttsAudioPath: SILENT_AUDIO,
    assPath: EMPTY_ASS,
    outPath: OUT_VIDEO,
    ttsDurationSec: DURATION_SEC,
    fps: 30,
    crf: 22,
    preset: "fast",
    layout: "card",
    cornerRadius: 40,
    cardStrokeWidth: stroke,
    foregroundWidth: fgW,
    foregroundHeight: fgH,
    foregroundY: fgY,
    foregroundFit: "cover",
    foregroundCropAnchor: CROP_ANCHOR,
    // Skip music + outro for clean visual test.
    backgroundMusicPath: undefined,
    tailSec: 0,
    outroSec: 0,
    // Logo: shrunk + X-aligned with the white outline's left edge so they
    // share the same vertical line.
    logoPath: LOGO,
    logoWidth: logoW,
    logoMargin: outlineLeftX,             // X (aligns with outline left)
    logoMarginTop: logoY,                  // Y (above the card with gap)
    logoCornerRadius: 12,
    brandName: "SportsForAllPodcast",
    brandTag: "PODCAST",
    brandNameFontSize: 22,                 // smaller to match smaller logo
    brandTagFontSize: 14,
  });

  console.log(`✓ test render complete: ${OUT_VIDEO}`);
  console.log(`  open the file to verify:`);
  console.log(`    1. card is square (880×880), not 3:4`);
  console.log(`    2. source video shows neymar's head/face (top preserved, bottom cropped)`);
  console.log(`    3. logo + 'SportsForAllPodcast' sits close to card top with small gap`);
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", rej);
    proc.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`ffmpeg failed (exit ${code}):\n${stderr.split("\n").slice(-15).join("\n")}`));
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
