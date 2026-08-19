import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} failed (exit ${code}): ${err}`));
    });
    proc.on("error", reject);
  });
}

export async function getDurationSec(path: string): Promise<number> {
  const out = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const d = parseFloat(out.trim());
  if (isNaN(d)) throw new Error(`ffprobe returned non-numeric duration for ${path}: ${out}`);
  return d;
}

/**
 * Concatenate audio files with `gapSec` silence between each, producing a single
 * output mp3.
 *
 * Uses ffmpeg's CONCAT FILTER (not concat demuxer) with explicit sample-rate /
 * channel normalization to avoid clicks/pops at boundaries. Each input is also
 * given a tiny 8 ms fade-in/fade-out which inaudibly smooths any DC offset
 * discontinuity at the boundary — this eliminates the "pét" clicking sound.
 *
 * `leadInSec` prepends silence BEFORE the first clip. Without it the video opens
 * mid-syllable at near-peak amplitude (measured -6 dB inside the first 60 ms),
 * and the 8 ms fade-in above eats the attack of the very first word on top of
 * that. Symptom: Whisper mis-heard word #1 on 22 of 36 delivered videos while
 * reading every following word correctly ("Nếu Ronaldo…" → "Kể Ronaldo…",
 * "Bản tin tối…" → "Tần tin tối…"). A viewer hears it worse than Whisper does,
 * because the player needs its own ~100 ms to ramp up. Callers MUST offset their
 * scene timeline by the same amount or the visuals drift ahead of the voice.
 */
export async function concatWithSilence(
  inputPaths: string[],
  gapSec: number,
  outPath: string,
  leadInSec = 0,
): Promise<void> {
  if (inputPaths.length === 0) throw new Error("concatWithSilence: empty inputPaths");
  if (inputPaths.length === 1 && leadInSec <= 0) {
    // No concat needed — just normalize the single file + apply voice
    // dynaudnorm to level out TTS prosody decay at sentence tails.
    await run("ffmpeg", [
      "-y", "-i", inputPaths[0],
      "-af", "dynaudnorm=p=0.9:f=250:g=15:m=15",
      "-ar", "44100", "-ac", "1",
      "-c:a", "libmp3lame", "-b:a", "192k",
      outPath,
    ]);
    return;
  }

  const tmp = await mkdtemp(join(tmpdir(), "concat-"));
  try {
    // Generate WAV silence (lossless, no encoder priming pops)
    const silencePath = join(tmp, "silence.wav");
    await run("ffmpeg", [
      "-y", "-f", "lavfi",
      "-i", `anullsrc=r=44100:cl=mono`,
      "-t", String(gapSec),
      "-ac", "1", "-ar", "44100",
      silencePath,
    ]);

    // Lead-in gets its own file — it is a different length from the inter-scene gap.
    let leadInPath: string | null = null;
    if (leadInSec > 0) {
      leadInPath = join(tmp, "lead-in.wav");
      await run("ffmpeg", [
        "-y", "-f", "lavfi",
        "-i", `anullsrc=r=44100:cl=mono`,
        "-t", String(leadInSec),
        "-ac", "1", "-ar", "44100",
        leadInPath,
      ]);
    }

    // Build ffmpeg input args + concat filter graph.
    // We interleave: voice[0] silence voice[1] silence voice[2] ... voice[N-1]
    // Each is fed through a chain that:
    //   1) resamples to 44100 mono (aresample with high-quality)
    //   2) applies a tiny 8ms fade-in + fade-out (inaudible but smooths boundary)
    // Then all are concatenated by the `concat=n=K:v=0:a=1` filter.
    const ffArgs: string[] = ["-y"];
    const filterParts: string[] = [];
    const labels: string[] = [];
    let idx = 0;
    const FADE_SEC = 0.008; // 8ms — inaudible

    // Voice inputs get dynaudnorm to level out AusyncLab's natural prosody
    // decay at sentence ends (which the user perceives as "nuốt chữ cuối" —
    // tail consonants quieter than the rest of the utterance). Silence
    // inserts skip the filter (no-op on silence anyway, just wastes CPU).
    //
    // dynaudnorm tuning:
    //   p=0.9   peak target (90%) — leaves headroom
    //   f=250   250ms frame length — short enough to catch single-word tails
    //   g=15    Gaussian smoothing window — gentle enough to keep prosody
    //           natural, aggressive enough to bring up the quietest 100ms tails
    //   m=15    max gain — cap at 15× boost (prevents pumping on pure-silence)
    const VOICE_FILTER = "dynaudnorm=p=0.9:f=250:g=15:m=15";

    const addInput = (path: string, isVoice: boolean) => {
      ffArgs.push("-i", path);
      const inLabel = `[${idx}:a]`;
      const outLabel = `a${idx}`;
      // Chain: resample → (voice only: dynaudnorm) → micro-fade-in → micro-fade-out
      const dynaudnormStep = isVoice ? `${VOICE_FILTER},` : "";
      filterParts.push(
        `${inLabel}aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
        `${dynaudnormStep}` +
        `afade=t=in:st=0:d=${FADE_SEC},` +
        // Trim fade-out: reverse → fade-in → reverse (this fades the END)
        `areverse,afade=t=in:st=0:d=${FADE_SEC},areverse[${outLabel}]`
      );
      labels.push(`[${outLabel}]`);
      idx++;
    };

    if (leadInPath) addInput(leadInPath, false); // breathing room before word #1
    inputPaths.forEach((p, i) => {
      addInput(p, true); // voice scene
      if (i < inputPaths.length - 1) addInput(silencePath, false); // silence insert
    });

    const concatFilter = `${labels.join("")}concat=n=${labels.length}:v=0:a=1[out]`;
    const filterGraph = `${filterParts.join(";")};${concatFilter}`;

    ffArgs.push(
      "-filter_complex", filterGraph,
      "-map", "[out]",
      "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100",
      outPath,
    );

    await run("ffmpeg", ffArgs);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export interface SfxMixSpec {
  /** Absolute path to SFX mp3/wav file */
  path: string;
  /** Time in seconds (within voice.mp3) when SFX starts */
  startSec: number;
  /** Volume 0–1 */
  volume: number;
}

/**
 * Mix SFX layer onto an existing voice mp3.
 *
 * - Voice stays at full volume
 * - Each SFX is delayed to its `startSec` and scaled by its `volume`
 * - All SFX layers are summed, then mixed with voice (amix duration=first)
 * - Output is mp3 at 192kbps
 *
 * If `sfxList` is empty, just copies voicePath → outPath.
 */
export async function mixSfxOntoVoice(
  voicePath: string,
  sfxList: SfxMixSpec[],
  outPath: string,
): Promise<void> {
  if (sfxList.length === 0) {
    // No SFX — just normalize/copy voice
    await run("ffmpeg", [
      "-y", "-i", voicePath,
      "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100",
      outPath,
    ]);
    return;
  }

  const ffArgs: string[] = ["-y", "-i", voicePath];
  const filterParts: string[] = [];
  const sfxLabels: string[] = [];

  // Cap every SFX to 1.0s (with a 0.15s fade-out so the cut isn't a click).
  // SFX impact comes from the onset; sustained tones beyond ~1s drone over
  // the voice and perceptually mask Vietnamese tail consonants (-ng, -nh,
  // -n, -m). Cap is universal — applies even to short SFX (no-op there).
  const SFX_MAX_SEC = 1.0;
  const SFX_FADE_OUT_SEC = 0.15;
  const SFX_FADE_START = SFX_MAX_SEC - SFX_FADE_OUT_SEC; // 0.85s

  sfxList.forEach((s, i) => {
    ffArgs.push("-i", s.path);
    const inputIdx = i + 1; // voice is index 0
    const outLabel = `s${i}`;
    const delayMs = Math.max(0, Math.round(s.startSec * 1000));
    // Per-SFX chain: resample → trim to 1.0s → fade out → delay → volume
    filterParts.push(
      `[${inputIdx}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
      `atrim=0:${SFX_MAX_SEC},asetpts=PTS-STARTPTS,` +
      `afade=t=out:st=${SFX_FADE_START}:d=${SFX_FADE_OUT_SEC},` +
      `adelay=${delayMs}|${delayMs},volume=${s.volume}[${outLabel}]`
    );
    sfxLabels.push(`[${outLabel}]`);
  });

  // Mix all SFX layers together
  let mixedSfxLabel: string;
  if (sfxLabels.length === 1) {
    mixedSfxLabel = sfxLabels[0];
  } else {
    filterParts.push(
      `${sfxLabels.join("")}amix=inputs=${sfxLabels.length}:dropout_transition=0:normalize=0[sfxall]`
    );
    mixedSfxLabel = "[sfxall]";
  }

  // Voice path: resample, then mix with SFX layer (voice volume 1.0, SFX already scaled)
  filterParts.push(
    `[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono[voice]`
  );
  filterParts.push(
    `[voice]${mixedSfxLabel}amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`
  );

  ffArgs.push(
    "-filter_complex", filterParts.join(";"),
    "-map", "[out]",
    "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100",
    outPath,
  );

  await run("ffmpeg", ffArgs);
}

export interface BgMusicMixOptions {
  /** Linear volume for the bed BEFORE ducking. Kept low — see the volume note below. */
  volume?: number;
  /** Fade-in length at the head, seconds. */
  fadeInSec?: number;
  /** Fade-out length at the tail, seconds. */
  fadeOutSec?: number;
}

/**
 * Mix a looping background-music bed under an existing voice track.
 *
 * The bed is SIDECHAIN-DUCKED by the voice: whenever the narrator speaks the
 * music drops, and it swells back in the gaps between scenes. This is not a
 * nicety — a flat music bed sits right on top of the Vietnamese tail
 * consonants (-ng, -nh, -n, -m) and smears them, the same failure mode that
 * forced the 1.0s / 0.22-volume cap on SFX. Ducking lets the bed be audible in
 * the gaps while staying out of the way of every spoken syllable.
 *
 * The music is looped (`-stream_loop -1`) and hard-trimmed to the voice
 * duration, so a 40s track under a 150s video just repeats.
 */
export async function mixBgMusicOntoVoice(
  voicePath: string,
  musicPath: string,
  outPath: string,
  opts: BgMusicMixOptions = {},
): Promise<void> {
  // 0.22 = the channel owner's chosen level (2026-07-31), picked by ear from a
  // 0.14 / 0.18 / 0.22 A/B. Measured against real Pixabay library tracks (mean
  // ~-10.5 dB) under dynaudnorm'd narration (~-16.3 dB) it puts the ducked bed
  // 14.2 dB under the voice — deliberately louder than the 15-20 dB broadcast
  // norm. Do not "correct" this back down without asking; it is a taste call,
  // not an oversight. 0.22 is the ceiling — above it the bed starts eating
  // Vietnamese tail consonants (-ng, -nh, -n, -m).
  const volume = Math.max(0, Math.min(1, opts.volume ?? 0.22));
  const fadeIn = Math.max(0, opts.fadeInSec ?? 1.5);
  const fadeOut = Math.max(0, opts.fadeOutSec ?? 2.5);

  const durationSec = await getDurationSec(voicePath);
  const fadeOutStart = Math.max(0, durationSec - fadeOut);

  // Both legs are normalized to MONO 44.1k: sidechaincompress requires its two
  // inputs to agree on format, and the rest of the pipeline is mono end-to-end
  // (concatWithSilence writes -ac 1). Do NOT "upgrade" this to stereo — ffmpeg's
  // mono→stereo rematrix applies a -3 dB per-channel gain to preserve power, so
  // a stereo bed chain quietly drops the whole voice track by ~3 dB and videos
  // with music come out noticeably softer than videos without.
  const fmt = "aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono";

  const filter = [
    // Voice is used twice: once as the audible track, once as the ducking key.
    `[0:a]${fmt}[v]`,
    `[v]asplit=2[vout][vkey]`,
    // Bed: format → attenuate → trim to voice length → fade in/out.
    `[1:a]${fmt},volume=${volume.toFixed(3)},` +
      `atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:st=0:d=${fadeIn.toFixed(2)},` +
      `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(2)}[bed]`,
    // Duck the bed against the voice — a GENTLE ~6 dB, not a hard gate.
    // Measured against a constant-level key (worst case): this setting leaves
    // the bed ~27 dB under the voice while speaking and lets it return to full
    // level in the gaps. Do NOT crank ratio up (ratio=14 buries the bed ~35 dB
    // down, i.e. inaudible): SCENE_GAP_SEC is only 0.3s, shorter than the
    // compressor release, so a deep duck never recovers and the music is
    // effectively off for the whole video. At volume 0.10 the bed already sits
    // ~20 dB below the voice; the compressor is a safety net for musical peaks,
    // not the main level control. Use VIDEO_BG_MUSIC_VOLUME to set loudness.
    `[bed][vkey]sidechaincompress=threshold=0.05:ratio=6:attack=12:release=300[bedduck]`,
    // duration=first pins the result to the voice length. The trailing limiter
    // is NOT optional: voice.mp3 already peaks at ~0 dBFS (dynaudnorm pushes it
    // there), so summing anything on top with normalize=0 overshoots full scale
    // and clips. alimiter catches those few samples transparently instead of
    // letting the mp3 encoder hard-clip them.
    `[vout][bedduck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mixed]`,
    `[mixed]alimiter=limit=0.97:level=disabled[out]`,
  ].join(";");

  await run("ffmpeg", [
    "-y",
    "-i", voicePath,
    "-stream_loop", "-1", "-i", musicPath,
    "-filter_complex", filter,
    "-map", "[out]",
    "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100",
    outPath,
  ]);
}

/**
 * Pick the background-music bed for a render, or null when music is off.
 *
 * Resolution order:
 *   1. `VIDEO_BG_MUSIC=""` (set but empty) → explicitly OFF.
 *   2. `VIDEO_BG_MUSIC=<path>` → that file. Bare names resolve inside
 *      `musicDir` (`VIDEO_BG_MUSIC=calm-drive.mp3`), absolute/relative paths
 *      are used as-is.
 *   3. Unset → pick one track from `musicDir` at random. Empty dir → null.
 *
 * Random-by-default is deliberate: it makes a freshly-dropped library "just
 * work" for every render without per-video config, and stops a whole batch of
 * videos going out with the identical bed.
 */
export function resolveBgMusic(
  musicDir: string,
  envValue: string | undefined,
  listDir: (dir: string) => string[],
): string | null {
  const AUDIO_EXTS = [".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac"];

  if (envValue !== undefined) {
    const trimmed = envValue.trim();
    if (!trimmed) return null; // explicit off
    return /[\\/]/.test(trimmed) ? resolve(trimmed) : join(musicDir, trimmed);
  }

  const tracks = listDir(musicDir)
    .filter((f) => AUDIO_EXTS.some((e) => f.toLowerCase().endsWith(e)))
    .sort();
  if (tracks.length === 0) return null;
  return join(musicDir, tracks[Math.floor(Math.random() * tracks.length)]);
}
