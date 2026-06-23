import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve as resolvePath, basename } from "node:path";

export interface ComposeOpts {
  /**
   * Absolute path(s) to source videos supplied by the user (any aspect ratio).
   * When multiple paths are provided, they are concatenated in order via
   * ffmpeg's concat demuxer; the chain is then looped indefinitely so even
   * very long TTS durations are covered. All videos in the list should share
   * the same resolution + codec — the concat demuxer does NOT transcode.
   */
  sourceVideoPaths: string[];
  /** Absolute path to TTS audio (mp3) produced earlier in the pipeline. */
  ttsAudioPath: string;
  /** Absolute path to the karaoke .ass subtitle file. */
  assPath: string;
  /** Absolute path to where the final 9:16 mp4 should be written. */
  outPath: string;
  /** TTS duration in seconds — used to clamp the looped video to voice length. */
  ttsDurationSec: number;
  /** Output frame rate. Default 30. */
  fps?: number;
  /** libx264 CRF (lower = higher quality, larger file). Default 20. */
  crf?: number;
  /** libx264 preset. Default "medium". Use "fast"/"veryfast" to halve render time. */
  preset?: string;
  /**
   * Corner radius (px) applied to the foreground video before it sits on the
   * black 1080x1920 canvas. 0 = sharp corners. Default 40.
   */
  cornerRadius?: number;
  /**
   * Foreground card width in px (max bounds for fit-inside scaling). Default
   * 660 — a 3:4 portrait card paired with the default 880 height, sized to
   * leave room for brand-shell above and captions below.
   */
  foregroundWidth?: number;
  /**
   * Foreground card height in px (max bounds for fit-inside scaling). Default
   * 880 — 3:4 paired with the default 660 width.
   */
  foregroundHeight?: number;
  /**
   * Top Y position of the foreground card on the 1080x1920 canvas. Default
   * 240 — sits just below the top brand-shell header.
   */
  foregroundY?: number;
  /**
   * Left X position of the foreground card on the 1080x1920 canvas. When
   * undefined, the card is horizontally centered: x=(1080-width)/2.
   */
  foregroundX?: number;
  /**
   * Width (px) of a thin white outline drawn around the card to make the
   * rounded corners visible against a pure-black canvas. 0 = no outline.
   * Default 4. Only drawn when cornerRadius > 0.
   */
  cardStrokeWidth?: number;
  /**
   * Optional background music. The file's audio track is looped to TTS
   * duration and mixed under the TTS at `bgMusicVolume`. Can be an mp3/wav/m4a
   * or a video file (audio track is extracted automatically).
   */
  backgroundMusicPath?: string;
  /**
   * Volume multiplier (linear, 0..1) for the background music before mixing.
   * 0.15 ≈ −16 dB below TTS, leaves the voice clearly dominant. 0.5 is
   * markedly present without overpowering the voice. Default 0.5.
   */
  bgMusicVolume?: number;
  /**
   * Seconds of "video tail" appended after the main voice ends. Video + music
   * continue, but voice + captions are silent. Provides a breath before the
   * outro card slides in. Default 7.
   */
  tailSec?: number;
  /**
   * Seconds of outro card at the very end. During this phase the rounded
   * foreground video is replaced with a TikTok-style follow card (channel
   * name, handle, follow button, source). Default 5.
   */
  outroSec?: number;
  /**
   * Path to TTS audio of the outro line (e.g. "Theo dõi Sports For All Ti Vi
   * để xem nhiều phân tích sâu hơn mỗi tuần"). Plays during the outro phase
   * over the background music. Set to null/undefined to leave the outro
   * silent (music only).
   */
  outroAudioPath?: string | null;
  /** Channel handle rendered on the outro card (e.g. `"@bonglan0702"`). */
  outroHandle?: string;
  /** Follower-count line on the outro card (e.g. `"1.2M followers"`). */
  outroFollowers?: string;
  /** CTA pill label on the outro card. Default `"Theo dõi ngay"`. */
  outroCta?: string;
  /** Source-attribution line on the outro card. Default `"Sưu tầm"`. */
  outroSource?: string;
  /**
   * Channel display name shown on the outro card (matches /create-video's
   * outro). Distinct from `brandName` (top-left shell) because the outro
   * needs the brand's actual channel name (e.g. "SportsForAllTV") rather
   * than the podcast-show label (e.g. "SportsForAllPodcast"). Defaults to
   * `brandName` when unset.
   */
  outroChannelName?: string;
  /**
   * Optional PNG logo overlaid at the top-right of the 1080x1920 canvas.
   * Scaled to `logoWidth` px wide (aspect-preserved), with transparency
   * respected. Skip the overlay by passing null/undefined.
   */
  logoPath?: string;
  /** Logo target width in px. Default 90. Height is computed from aspect. */
  logoWidth?: number;
  /** Margin (px) from the top + left edges of the canvas. Default 60. */
  logoMargin?: number;
  /** Corner radius (px) for the logo. 0 = sharp corners. Default 16. */
  logoCornerRadius?: number;
  /** Brand-name font size (px). Default 32. */
  brandNameFontSize?: number;
  /** Brand-tag font size (px). Default 18. */
  brandTagFontSize?: number;
  /**
   * Channel display name rendered beside the logo (matches /create-video's
   * brand header). Pass empty string to suppress.
   */
  brandName?: string;
  /**
   * Small tag line under the channel name (matches /create-video's
   * "TIN TỨC BÓNG ĐÁ"). Empty string suppresses it.
   */
  brandTag?: string;
  /**
   * Visual layout preset.
   *   - `"vignette"` (default): viral-clip aesthetic. Source video is split
   *     two ways — one copy is scaled up + heavily blurred + dimmed to cover
   *     the full canvas as a vignette background; the second copy sits sharp
   *     in a centered rounded card on top. Decorations: mock search bar at
   *     top, progress bar + timestamp at bottom, faded watermark on the card.
   *   - `"card"`: legacy look. Solid black canvas, rounded card centered,
   *     optional white outline. Brand-shell text top-left.
   *   - `"fullbleed"`: aesthetic-bg mode for high-quality scenery / street
   *     ambient footage. Source video fills the full 1080×1920 canvas (cover
   *     crop), with an optional dim overlay so the karaoke captions stay
   *     legible. No card, no search bar, no progress bar, no watermark — the
   *     footage IS the visual. Wordmark sits free-floating at the top of the
   *     canvas. Best when paired with cinematic / aesthetic footage where the
   *     image quality is the draw, not topic-specific clips.
   *   - `"landscape"`: 16:9 footage on a black 9:16 canvas. Source is scaled
   *     to width=1080 (no crop) and sits as a horizontal strip slightly above
   *     center. Same corner brand text + caption font as fullbleed, but the
   *     karaoke is positioned INSIDE the strip's bottom area (not the empty
   *     black region below it). Use when source aspect ratio is landscape
   *     (auto-selected by pipeline.ts based on ffprobe).
   */
  layout?: "vignette" | "card" | "fullbleed" | "landscape";
  /**
   * Landscape only — vertical offset of the 16:9 strip from canvas center.
   * Negative = above center (default -80, biased upward for caption space
   * below the strip's natural reading position).
   */
  landscapeVerticalBias?: number;
  /**
   * Fullbleed only — opacity (0..1) of the black dim overlay over the
   * scenery footage. Higher = darker scenery = more legible captions.
   * Default 0.28 — a noticeable dim without crushing the image. Set to 0
   * to disable the dim entirely.
   */
  fullbleedDim?: number;
  /**
   * Fullbleed only — small decorative text drawn at the top-left corner of
   * the canvas (in place of the wordmark stack). Default "Life Podcast".
   * Empty string disables the corner text entirely (clean scenery only).
   */
  fullbleedCornerText?: string;
  /** Fullbleed corner-text font size (px). Default 48. */
  fullbleedCornerFontSize?: number;
  /**
   * Fullbleed corner-text font file (absolute Windows path or ffmpeg-style
   * escaped path). Default Palatino Linotype Italic — elegant serif italic
   * that pairs well with scenery aesthetic. Swap to `segoesc.ttf` for a
   * handwritten cursive, or `gabriola.ttf` for a more decorative feel.
   */
  fullbleedCornerFontFile?: string;
  /** Vignette bg: gblur sigma (higher = blurrier). Default 40. Vignette only. */
  vignetteBlurSigma?: number;
  /** Vignette bg: brightness offset (-1..1). Default -0.3 (dims for contrast). */
  vignetteBrightness?: number;
  /** Vignette bg: saturation multiplier (0..3). Default 0.7. */
  vignetteSaturation?: number;
  /** Search-bar mock text. Empty string suppresses the search bar. Vignette only. */
  searchBarText?: string;
  /** Watermark text rendered top-right of the card. Empty disables. Vignette only. */
  watermarkText?: string;
  /** Progress bar at the bottom — toggle. Default true. Vignette only. */
  progressBarEnabled?: boolean;
  /** Optional translucent white play-triangle in card center. Default false. */
  playButtonEnabled?: boolean;
  /**
   * Vignette layout — toggle the blurred-source background. When `false`,
   * the canvas is pure black behind the sharp card (still using the
   * vignette card sizing + caption chunks). Default `true`.
   */
  vignetteBgEnabled?: boolean;
  /**
   * How the source video is scaled into the card box.
   *   - `"cover"` (default): scale up + crop center so the source FILLS the
   *     card. Crops content along the shorter axis. Best when source aspect
   *     differs noticeably from card aspect — no internal letterboxing.
   *   - `"contain"`: fit-inside with black letterbox/pillarbox padding.
   *     Preserves all source content; adds black bars when aspects differ.
   */
  foregroundFit?: "cover" | "contain";
  /**
   * When `foregroundFit="cover"`, biases the crop so the BOTTOM of the
   * source is cropped by exactly this many px and the top crop takes the
   * remainder. Lets you preserve head/upper content when the source is
   * taller-than-card. Default: undefined → center crop (split excess evenly).
   */
  foregroundCropBottom?: number;
  /**
   * When `foregroundFit="cover"`, controls where the crop is anchored:
   *   - `"top"` (DEFAULT for square crops): anchor crop at y=0 — preserves
   *     the top of the source, crops only from the bottom. Ideal when the
   *     source is taller-than-card and the focal subject (heads, scoreboards)
   *     sits in the upper half.
   *   - `"center"`: classic center-crop (legacy behavior).
   *   - `"bottom"`: anchor crop at the bottom — preserves the bottom of the
   *     source, crops from the top.
   * Ignored when `foregroundCropBottom` is supplied (that param wins).
   */
  foregroundCropAnchor?: "top" | "center" | "bottom";
  /**
   * Top-Y position (px) of the brand-shell logo + name on the canvas. When
   * unset, falls back to `logoMargin` so the X and Y margins are equal
   * (legacy behavior). Allow separate Y so the brand-shell can sit close to
   * the top edge of the foreground card without also pushing it rightward.
   */
  logoMarginTop?: number;
  /**
   * When `true`, replace the legacy side-by-side logo + brandName + brandTag
   * with a centered "wordmark" stack drawn directly above the card outline:
   *   • `brandName` rendered big in white Segoe UI Bold with a soft purple
   *     drop-shadow glow.
   *   • A short gradient underline (purple → cyan) below the name.
   *   • `brandTag` rendered small in cyan beneath the underline.
   * No logo PNG is overlaid — the wordmark IS the brand identity. Suppresses
   * the logo input entirely (saves an ffmpeg `-i` slot too). Default `false`.
   */
  brandWordmark?: boolean;
  /**
   * Main wordmark font size (px) when `brandWordmark=true`. Default `56`.
   */
  brandWordmarkFontSize?: number;
  /**
   * Tag font size (px) for the small line below the wordmark underline when
   * `brandWordmark=true`. Default `22`.
   */
  brandWordmarkTagFontSize?: number;
  /**
   * Width (px) of the gradient underline beneath the wordmark. Default `280`.
   */
  brandWordmarkUnderlineWidth?: number;
  /**
   * Wordmark visual style.
   *   - `"display"` (default): heavy Segoe UI Black, purple border glow,
   *     gradient underline, cyan tag. Bold broadcast aesthetic.
   *   - `"elegant"`: refined serif italic (Palatino), no glow, thin subtle
   *     separator, no tag, letter-spaced. Minimal editorial masthead that
   *     doesn't compete with the video. Ideal for locket / pendant-frame.
   */
  brandWordmarkStyle?: "display" | "elegant";
  /**
   * Font file for the wordmark main text. Default depends on `brandWordmarkStyle`:
   * Segoe UI Black for "display", Palatino Linotype Italic for "elegant".
   */
  brandWordmarkFontFile?: string;
  /**
   * Draw the top-right corner badge lockup (rounded logo tile + channel name
   * to its LEFT) on non-chromeless layouts too — used by locket. Chromeless
   * layouts (fullbleed / landscape) always use the lockup regardless of this
   * flag. When enabled it SUPPRESSES the centered brand wordmark and the
   * legacy top-left brand shell.
   */
  cornerBadge?: boolean;
}

/**
 * Build the final 9:16 podcast clip with one ffmpeg invocation.
 *
 * Look produced (TikTok / Reels / FB podcast-clip aesthetic):
 *   - Solid black 1080×1920 canvas (no blurred bg).
 *   - Source video scaled into a small 3:4 portrait rounded-corner card
 *     (default 660×880) anchored near the top of the canvas, leaving room
 *     above for the brand-shell and below for big karaoke captions.
 *   - Karaoke .ass burned below the card (white base + light-blue active word).
 *
 * Pipeline (all in one filter graph):
 *   1. `color=black` source generates the 1080×1920 background.
 *   2. Source video is looped (`-stream_loop -1`) and clamped to TTS duration
 *      via `-t`. Source audio is dropped — only TTS is mapped.
 *   3. Source scaled to fit-inside the configured fg box → its corners are
 *      masked via geq so they fade to transparent at the configured radius.
 *   4. Foreground overlaid at (fgX, fgY) — X auto-centered when not given.
 *   5. Burn the karaoke .ass via libass.
 *
 * The subtitles filter needs a path it can read; on Windows, an absolute path
 * like `C:\foo\bar.ass` triggers libavfilter's `:`-as-arg-separator parser.
 * Work around it by running ffmpeg with cwd=<dir holding the .ass> and passing
 * a bare filename. We copy the .ass next to the output if it's elsewhere so
 * this is safe regardless of caller layout.
 */
export async function composeVideo(opts: ComposeOpts): Promise<void> {
  const fps = opts.fps ?? 30;
  const crf = opts.crf ?? 20;
  const preset = opts.preset ?? "medium";
  const layout: "vignette" | "card" | "fullbleed" | "landscape" =
    opts.layout === "card" ? "card"
    : opts.layout === "fullbleed" ? "fullbleed"
    : opts.layout === "landscape" ? "landscape"
    : "vignette";
  const isFullbleed = layout === "fullbleed";
  const isLandscape = layout === "landscape";
  /**
   * Fullbleed AND landscape both skip the wordmark/card/brand-shell overlays
   * and rely on the corner brand text + a cleaner caption position.
   */
  const isChromeless = isFullbleed || isLandscape;
  /**
   * Corner lockup mode — the top-right logo badge + name branding. Always on
   * for chromeless layouts; opt-in for card/locket via `cornerBadge`. When
   * active, the centered wordmark + legacy brand shell are suppressed.
   */
  const cornerLockup = isChromeless || !!opts.cornerBadge;
  const landscapeVerticalBias = Math.floor(opts.landscapeVerticalBias ?? -80);
  const fullbleedDim = Math.max(0, Math.min(1, opts.fullbleedDim ?? 0.28));
  const fullbleedCornerText = opts.fullbleedCornerText ?? "Trạm Dừng Bất Ngờ";
  const fullbleedCornerFontSize = Math.max(16, Math.floor(opts.fullbleedCornerFontSize ?? 48));
  const fullbleedCornerFontFile = opts.fullbleedCornerFontFile ?? "C\\:/Windows/Fonts/palai.ttf";
  const blurSigma = Math.max(0, Math.min(100, opts.vignetteBlurSigma ?? 40));
  const vBrightness = Math.max(-1, Math.min(1, opts.vignetteBrightness ?? -0.3));
  const vSaturation = Math.max(0, Math.min(3, opts.vignetteSaturation ?? 0.7));
  const searchBarText = opts.searchBarText ?? "Tìm nội dung liên quan";
  const watermarkText = opts.watermarkText ?? "Sports For All Podcast";
  const progressBarEnabled = opts.progressBarEnabled ?? true;
  const playButtonEnabled = opts.playButtonEnabled ?? false;
  const vignetteBgEnabled = opts.vignetteBgEnabled ?? true;
  const radius = Math.max(0, Math.floor(opts.cornerRadius ?? 40));
  // Foreground card sizing — explicit width/height/y, X auto-centered when
  // omitted. Clamped to canvas bounds so a misconfigured value can't push the
  // card off-screen. Defaults: 660×880 (3:4 portrait), anchored at y=240. This
  // is the TikTok / Reels podcast-clip aesthetic — portrait card up top,
  // captions below.
  const fgBoxW = Math.max(120, Math.min(1080, Math.floor(opts.foregroundWidth ?? 880)));
  const fgBoxH = Math.max(120, Math.min(1920, Math.floor(opts.foregroundHeight ?? 880)));
  const fgY = Math.max(0, Math.min(1920 - fgBoxH, Math.floor(opts.foregroundY ?? 300)));
  const fgX = opts.foregroundX !== undefined
    ? Math.max(0, Math.min(1080 - fgBoxW, Math.floor(opts.foregroundX)))
    : Math.floor((1080 - fgBoxW) / 2);
  const bgMusic = opts.backgroundMusicPath ? resolvePath(opts.backgroundMusicPath) : null;
  const bgMusicVol = Math.max(0, Math.min(2, opts.bgMusicVolume ?? 1.0));
  const logoPath = opts.logoPath ? resolvePath(opts.logoPath) : null;
  const logoWidth = Math.max(40, Math.min(500, Math.floor(opts.logoWidth ?? 90)));
  const logoMargin = Math.max(0, Math.min(400, Math.floor(opts.logoMargin ?? 60)));
  // Brand-shell Y position. When unset, defaults to (fgY - 110) so the
  // logo sits ~110px above the foreground card top — close to the card
  // outline with a small breathing gap. Falls back to legacy `logoMargin`
  // (square X+Y) only when foregroundY is also unset.
  const defaultLogoMarginTop = Math.max(0, fgY - 110);
  const logoMarginTop = Math.max(0, Math.min(1800, Math.floor(opts.logoMarginTop ?? (opts.foregroundY !== undefined ? defaultLogoMarginTop : logoMargin))));
  const logoCornerRadius = Math.max(0, Math.min(Math.floor(logoWidth / 2), Math.floor(opts.logoCornerRadius ?? 16)));
  const brandName = opts.brandName ?? "";
  const brandTag = opts.brandTag ?? "";
  const brandNameFontSize = Math.max(10, Math.floor(opts.brandNameFontSize ?? 32));
  const brandTagFontSize = Math.max(8, Math.floor(opts.brandTagFontSize ?? 18));
  const tailSec = Math.max(0, opts.tailSec ?? 7);
  const outroSec = Math.max(0, opts.outroSec ?? 5);
  const outroAudio = opts.outroAudioPath ? resolvePath(opts.outroAudioPath) : null;
  const outroStart = opts.ttsDurationSec + tailSec;
  const totalDur = opts.ttsDurationSec + tailSec + outroSec;
  const outroHandle = opts.outroHandle ?? "@bonglan0702";
  const outroFollowers = opts.outroFollowers ?? "1.2M followers";
  const outroCta = opts.outroCta ?? "Theo dõi ngay";
  const outroSource = opts.outroSource ?? "Sưu tầm";
  const outroChannelName = opts.outroChannelName ?? opts.brandName ?? "SportsForAllTV";

  if (!opts.sourceVideoPaths || opts.sourceVideoPaths.length === 0) {
    throw new Error("composeVideo: sourceVideoPaths must contain at least one file");
  }
  const absSources = opts.sourceVideoPaths.map((p) => resolvePath(p));
  const absAudio = resolvePath(opts.ttsAudioPath);
  const absOut = resolvePath(opts.outPath);
  const absAss = resolvePath(opts.assPath);

  const workDir = dirname(absOut);
  await mkdir(workDir, { recursive: true });

  // Ensure the .ass sits beside the output so the subtitles filter receives a
  // colon-free relative path (Windows-safe). If it's already in workDir we
  // skip the copy, otherwise we drop a local copy named captions.ass.
  const assFilename = "captions.ass";
  const localAss = join(workDir, assFilename);
  if (resolvePath(localAss) !== absAss) {
    await copyFile(absAss, localAss);
  }

  // Foreground card sits inside a fgBoxW × fgBoxH box at (fgX, fgY) on the
  // black canvas. Source is scaled fit-inside that box (aspect preserved), so
  // the card is at most that size — never larger. The space around the card
  // is reserved for the brand-shell header (top) and the karaoke captions
  // (below).
  // Scale the source into the card box, then ensure the result is exactly
  // fgBoxW × fgBoxH so the card stays a consistent shape regardless of source
  // aspect ratio.
  //   - "cover": scale-to-cover (max-scale) + crop center. Source FILLS the
  //     card with no internal letterbox; content along the shorter axis is
  //     cropped off equally on both sides.
  //   - "contain": fit-inside (min-scale) + pad. Preserves all source content;
  //     adds black bars inside the card when aspects differ.
  const fgFit = opts.foregroundFit ?? "cover";
  const fgCropBottom = opts.foregroundCropBottom;
  const fgCropAnchor = opts.foregroundCropAnchor ?? "top";
  // Cover mode crop expression. Priority:
  //   1) `fgCropBottom` (explicit px) — bottom-crop amount, top crop = excess - cropBottom
  //   2) `fgCropAnchor` — "top" anchors crop at y=0 (preserve top, crop bottom),
  //      "bottom" anchors at y=ih-H (preserve bottom, crop top), "center" splits evenly
  // Crop coords are evaluated in the scaled source (post `scale=…increase`), so
  // `ih` here is the scaled input height. Default anchor is "top" — preserves
  // the focal subject in the upper half when source is taller-than-card.
  const coverCrop = fgCropBottom !== undefined
    ? `crop=${fgBoxW}:${fgBoxH}:(iw-${fgBoxW})/2:ih-${fgBoxH}-${Math.max(0, Math.floor(fgCropBottom))}`
    : fgCropAnchor === "top"
      ? `crop=${fgBoxW}:${fgBoxH}:(iw-${fgBoxW})/2:0`
      : fgCropAnchor === "bottom"
        ? `crop=${fgBoxW}:${fgBoxH}:(iw-${fgBoxW})/2:ih-${fgBoxH}`
        : `crop=${fgBoxW}:${fgBoxH}`;
  const scaleAndPad = fgFit === "cover"
    ? `scale=${fgBoxW}:${fgBoxH}:force_original_aspect_ratio=increase,${coverCrop},setsar=1`
    : `scale=${fgBoxW}:${fgBoxH}:force_original_aspect_ratio=decrease,pad=${fgBoxW}:${fgBoxH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  const fgChain = radius > 0
    // For each pixel in a corner region (radius R from a corner), set alpha to
    // 0 if it falls OUTSIDE the inscribed circle of radius R; otherwise keep
    // fully opaque. The 4 nested `if`s cover top-left, top-right, bottom-left,
    // bottom-right corners; the final 255 is for the bulk of the frame.
    ? `[0:v]${scaleAndPad},format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt(X,${radius})*lt(Y,${radius}),if(lte(pow(${radius}-X,2)+pow(${radius}-Y,2),${radius * radius}),255,0),if(gt(X,W-${radius})*lt(Y,${radius}),if(lte(pow(X-W+${radius},2)+pow(${radius}-Y,2),${radius * radius}),255,0),if(lt(X,${radius})*gt(Y,H-${radius}),if(lte(pow(${radius}-X,2)+pow(Y-H+${radius},2),${radius * radius}),255,0),if(gt(X,W-${radius})*gt(Y,H-${radius}),if(lte(pow(X-W+${radius},2)+pow(Y-H+${radius},2),${radius * radius}),255,0),255))))'[fg]`
    : `[0:v]${scaleAndPad}[fg]`;

  // Optional thin white stroke around the card so the rounded corners read
  // against a pure-black canvas. Implemented as a SLIGHTLY LARGER rounded-rect
  // (white, radius+strokeW) overlaid behind the card — where it pokes out
  // beyond the card's rounded boundary, it becomes a uniform-width ring. No
  // ring math needed.
  // Stroke cap raised to 80 so the white outline can be widened on all 4
  // sides (acts as a "matted picture frame" around the card).
  const cardStrokeW = Math.max(0, Math.min(80, Math.floor(opts.cardStrokeWidth ?? 4)));
  const showStroke = radius > 0 && cardStrokeW > 0;
  let strokeChain: string | null = null;
  let strokeOverlay: string | null = null;
  let preFgOverlayLabel = "bg";
  if (showStroke) {
    const outerW = fgBoxW + 2 * cardStrokeW;
    const outerH = fgBoxH + 2 * cardStrokeW;
    const oR = radius + cardStrokeW;
    const oRSq = oR * oR;
    const strokeMask = `if(lt(X,${oR})*lt(Y,${oR}),if(lte(pow(${oR}-X,2)+pow(${oR}-Y,2),${oRSq}),255,0),if(gt(X,W-${oR})*lt(Y,${oR}),if(lte(pow(X-W+${oR},2)+pow(${oR}-Y,2),${oRSq}),255,0),if(lt(X,${oR})*gt(Y,H-${oR}),if(lte(pow(${oR}-X,2)+pow(Y-H+${oR},2),${oRSq}),255,0),if(gt(X,W-${oR})*gt(Y,H-${oR}),if(lte(pow(X-W+${oR},2)+pow(Y-H+${oR},2),${oRSq}),255,0),255))))`;
    strokeChain = `color=c=black:s=${outerW}x${outerH}:d=0.04:rate=${fps},format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='${strokeMask}',loop=loop=-1:size=1:start=0[stroke]`;
    strokeOverlay = `[bg][stroke]overlay=${fgX - cardStrokeW}:${fgY - cardStrokeW}[bg_stroked]`;
    preFgOverlayLabel = "bg_stroked";
  }

  // Input indices in the order they are passed to ffmpeg's `-i`:
  //   0 = source video (always)
  //   1 = TTS voice (always)
  //   2 = bg music (if present)
  //   3 = logo (if present)
  //   4 = outro voice audio (if present)
  // Each slot only takes an index if the corresponding feature is enabled.
  let inputCursor = 2;
  const musicIndex = bgMusic ? inputCursor++ : -1;
  const logoIndex = logoPath ? inputCursor++ : -1;
  const outroIndex = outroAudio ? inputCursor++ : -1;

  // Audio chain.
  //
  // The output runs for `totalDur` = ttsDurationSec + tailSec + outroSec.
  // We need:
  //   • Voice plays at 0..ttsDur (followed by silence to totalDur)
  //   • Outro voice plays at outroStart..totalDur (followed by silence to totalDur)
  //   • Music plays at 0..totalDur, attenuated under everything
  // Everything is padded to totalDur via apad so the final amix gets equal-
  // length streams and we don't get sudden drop-outs.
  const audioChain: string[] = [];
  audioChain.push(`[1:a]apad=whole_dur=${totalDur.toFixed(3)}[voice_pad]`);
  let speechLabel = "voice_pad";
  if (outroAudio && outroIndex >= 0) {
    const startMs = Math.max(0, Math.round(outroStart * 1000));
    audioChain.push(
      `[${outroIndex}:a]adelay=${startMs}|${startMs},apad=whole_dur=${totalDur.toFixed(3)}[outro_delayed]`,
    );
    audioChain.push(
      `[voice_pad][outro_delayed]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[speech_mixed]`,
    );
    speechLabel = "speech_mixed";
  }
  if (bgMusic && musicIndex >= 0) {
    audioChain.push(
      `[${musicIndex}:a]volume=${bgMusicVol.toFixed(3)},apad=whole_dur=${totalDur.toFixed(3)}[bgm]`,
    );
    audioChain.push(
      `[${speechLabel}][bgm]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`,
    );
  }
  const aoutLabel = bgMusic ? "[aout]" : `[${speechLabel}]`;

  // Wordmark mode: a centered branded stack above the card outline. When on,
  // it replaces BOTH the side-by-side brand-text drawtexts AND the logo PNG
  // overlay below (legacyBrandShell paths are skipped). Forced on by the
  // /create-podcast pipeline for the card layout — the wordmark is the brand.
  //
  // Fullbleed layout suppresses the wordmark entirely — it renders a small
  // decorative corner text instead (set by `fullbleedCornerText`). The user
  // can still pass `brandWordmark: true` but it'll be ignored in fullbleed.
  const useWordmark = !!opts.brandWordmark && !cornerLockup;
  const wmFontSize = Math.max(20, Math.floor(opts.brandWordmarkFontSize ?? 62));
  const wmTagFontSize = Math.max(10, Math.floor(opts.brandWordmarkTagFontSize ?? 28));
  const wmUnderlineW = Math.max(80, Math.min(1080, Math.floor(opts.brandWordmarkUnderlineWidth ?? 320)));
  const wmUnderlineH = 6;
  const wmStyle = opts.brandWordmarkStyle ?? "display";
  // Font for the wordmark main text. Elegant: Palatino Italic (editorial);
  // Display: Segoe UI Black (heavy broadcast). Custom override via opts.
  const wmFontFile = opts.brandWordmarkFontFile
    ?? (wmStyle === "elegant" ? "C\\:/Windows/Fonts/palai.ttf" : "C\\:/Windows/Fonts/seguibl.ttf");

  // /create-video matches the brand-shell header at top-left: square logo +
  // brand name (white Segoe UI Bold) + tag line (cyan #22D3EE Segoe UI).
  // Tag is uppercased manually to fake CSS text-transform.
  const brandTextGap = Math.round(brandNameFontSize * 0.4);
  const brandTotalHeight = brandNameFontSize + brandTextGap + brandTagFontSize;
  const brandNameX = logoPath ? logoMargin + logoWidth + 20 : logoMargin;
  // Vertically center the brand text against the logo. Y anchor uses
  // `logoMarginTop` so the brand-shell can sit near the card top without
  // pushing horizontally too.
  const brandNameY = logoPath
    ? logoMarginTop + Math.round((logoWidth - brandTotalHeight) / 2)
    : logoMarginTop + 4;
  const brandTagY = brandNameY + brandNameFontSize + brandTextGap;
  const fontBold = "C\\:/Windows/Fonts/segoeuib.ttf";
  const fontReg = "C\\:/Windows/Fonts/segoeui.ttf";
  // Segoe UI Black — heavier display weight, used for the centered wordmark
  // main text so it reads as a wordmark rather than a regular bold header.
  const fontBlack = "C\\:/Windows/Fonts/seguibl.ttf";

  // Legacy brand-text drawtexts are suppressed in fullbleed too — the corner
  // text replaces them with a single decorative line at top-left.
  const textFilters: string[] = [];
  if (!useWordmark && !cornerLockup && brandName) {
    textFilters.push(
      `drawtext=fontfile='${fontBold}':text='${escapeDrawtext(brandName)}':fontsize=${brandNameFontSize}:fontcolor=white:x=${brandNameX}:y=${brandNameY}:shadowcolor=black@0.6:shadowx=2:shadowy=2`,
    );
  }
  if (!useWordmark && !cornerLockup && brandTag) {
    textFilters.push(
      `drawtext=fontfile='${fontReg}':text='${escapeDrawtext(brandTag.toUpperCase())}':fontsize=${brandTagFontSize}:fontcolor=0x22D3EE:x=${brandNameX}:y=${brandTagY}:shadowcolor=black@0.6:shadowx=2:shadowy=2`,
    );
  }
  const textChain = textFilters.length > 0
    ? [`[${logoPath && !useWordmark ? "with_logo" : "burned"}]${textFilters.join(",")}[final]`]
    : [];

  // Logo with optional rounded corners via the same geq alpha-mask trick as
  // the foreground. Kept as a separate scale step so the mask sees a known
  // size (logoWidth × auto height). The mask hardcodes R into the formula.
  //
  // When the outro overlay is enabled, we ALSO need a bigger circular version
  // of the same PNG to use as the avatar at the top of the outro card. Split
  // the logo input into two streams up front so both versions share one disk
  // read.
  const lr = logoCornerRadius;
  const avatarDiameter = 240;
  const avatarR = avatarDiameter / 2;
  const wantAvatar = !!logoPath && outroSec > 0;
  // In wordmark mode (and fullbleed mode) the brand-shell logo PNG is NOT
  // overlaid. We only need the logo input for the outro avatar (a circular
  // 240px version).
  const wantBrandLogo = !!logoPath && !useWordmark && !cornerLockup;
  // Corner badge — the logo PNG rendered as a small rounded "album-art" tile
  // at the top-right, with the channel name sitting to its LEFT as a lockup
  // (added 2026-06-11). Always on for chromeless layouts; opt-in for locket
  // via `cornerBadge`.
  const wantCornerBadge = cornerLockup && !!logoPath;
  // Split the logo input into two streams only when BOTH a canvas overlay
  // (brand-shell or corner badge) AND the avatar need it. Otherwise feed the
  // single consumer directly from the raw input — splitting and leaving one
  // output unconsumed is a ffmpeg error.
  const needsLogoSplit = wantAvatar && (wantBrandLogo || wantCornerBadge);
  const logoSplit = needsLogoSplit
    ? `[${logoIndex}:v]split=2[logo_brand_in][logo_avatar_in]`
    : null;
  const logoBrandInput = needsLogoSplit ? "logo_brand_in" : `${logoIndex}:v`;
  const logoAvatarInput = needsLogoSplit ? "logo_avatar_in" : `${logoIndex}:v`;
  const logoBrandScaleAndMask = lr > 0
    ? `[${logoBrandInput}]scale=${logoWidth}:-1,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt(X,${lr})*lt(Y,${lr}),if(lte(pow(${lr}-X,2)+pow(${lr}-Y,2),${lr * lr}),255,0),if(gt(X,W-${lr})*lt(Y,${lr}),if(lte(pow(X-W+${lr},2)+pow(${lr}-Y,2),${lr * lr}),255,0),if(lt(X,${lr})*gt(Y,H-${lr}),if(lte(pow(${lr}-X,2)+pow(Y-H+${lr},2),${lr * lr}),255,0),if(gt(X,W-${lr})*gt(Y,H-${lr}),if(lte(pow(X-W+${lr},2)+pow(Y-H+${lr},2),${lr * lr}),255,0),255))))'[logo]`
    : `[${logoBrandInput}]scale=${logoWidth}:-1[logo]`;
  // Circular avatar — square crop then inscribed-circle alpha mask. The
  // crop dimension equals the smaller of the scaled width/height so the
  // result is exactly avatarDiameter × avatarDiameter.
  const logoAvatarScaleAndMask = wantAvatar
    ? `[${logoAvatarInput}]scale=${avatarDiameter}:${avatarDiameter}:force_original_aspect_ratio=increase,crop=${avatarDiameter}:${avatarDiameter},format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(pow(X-${avatarR},2)+pow(Y-${avatarR},2),${avatarR * avatarR}),255,0)'[logo_avatar]`
    : null;

  // In wordmark mode AND fullbleed mode the logo PNG isn't overlaid on the
  // canvas. We still build the circular avatar branch when the outro card
  // needs it, so the logoPath input stays useful.
  const logoChain = logoPath
    ? (useWordmark || cornerLockup)
      ? [
          ...(logoSplit ? [logoSplit] : []),
          ...(logoAvatarScaleAndMask ? [logoAvatarScaleAndMask] : []),
        ]
      : [
          ...(logoSplit ? [logoSplit] : []),
          logoBrandScaleAndMask,
          // Overlay top-LEFT — X=logoMargin, Y=logoMarginTop (separate so brand-
          // shell can sit close to the card top without shifting right).
          `[burned][logo]overlay=${logoMargin}:${logoMarginTop}[${textChain.length > 0 ? "with_logo" : "final"}]`,
          ...(logoAvatarScaleAndMask ? [logoAvatarScaleAndMask] : []),
        ]
    : [];

  // Subtitles output target: pipe straight to [final] only when no logo AND
  // no brand text AND no outro overlay follows. Otherwise route to [burned]
  // so the next stage can overlay on top.
  const hasOutroOverlay = outroSec > 0;
  const hasLegacyBrandOverlay = !useWordmark && !cornerLockup && (!!logoPath || textChain.length > 0);
  const hasFullbleedCorner = cornerLockup && (!!fullbleedCornerText || wantCornerBadge);
  const hasOverlayStage = useWordmark || hasLegacyBrandOverlay || hasFullbleedCorner || hasOutroOverlay;

  // Last label produced by the existing visual chain before the outro stage.
  // If outro is enabled, every prior stage targets [pre_outro] so we can
  // append the outro overlay; otherwise the existing chain targets [final]
  // directly as before.
  const preOutroLabel = hasOutroOverlay ? "pre_outro" : "final";
  // Adjust the last visual stage's output label to [pre_outro] when outro is
  // on. Each stage in the original chain wrote to [final]; rewrite to use
  // preOutroLabel so the outro stage gets a clean handoff.
  const subtitlesLabel = useWordmark || hasLegacyBrandOverlay || hasFullbleedCorner ? "burned" : preOutroLabel;
  const logoChainAdjusted = logoChain.map((step) => step.replace(/\[final\]$/, `[${preOutroLabel}]`));
  const textChainAdjusted = textChain.map((step) => step.replace(/\[final\]$/, `[${preOutroLabel}]`));

  // Brand-wordmark chain — only built when `useWordmark` is on. Geometry:
  //   • Anchored 32px above the card outline top.
  //   • Stack (bottom-up): tag → 14px gap → underline (4px) → 18px gap → main.
  //   • All elements horizontally centered on the 1080-wide canvas.
  // The main text gets a soft purple drop-shadow glow (#A855F7) to mimic the
  // gradient-fill look /create-video uses on its hero text without paying the
  // cost of a true gradient mask. The underline is a 4px tall geq gradient
  // #7C3AED → #22D3EE that the outro stage already proved works in this
  // pipeline. Tag is the existing `brandTag` value, uppercased + cyan.
  const wordmarkChain: string[] = [];
  if (useWordmark) {
    // Wordmark is suppressed in fullbleed layout, so this branch only runs
    // for card / vignette layouts — anchor above the card outline.
    const outlineTopY = Math.max(0, fgY - cardStrokeW);
    const wmName = brandName || "SportsForAllPodcast";

    if (wmStyle === "elegant") {
      // ── Elegant masthead ──────────────────────────────────────────────
      // Single centered line in refined serif italic (Palatino). No gradient
      // underline, no tag, no purple glow — just the name floating gracefully
      // above the card outline with a thin subtle separator. Letter-spaced
      // for an editorial-magazine feel. Designed for the locket / pendant-
      // frame aesthetic where the brand should be visible but must NOT
      // compete with the video.
      const sepH = 2;
      const sepW = 80;
      const sepGap = 30;   // gap between separator and card outline
      const nameGap = 16;  // gap between name bottom and separator top
      const sepY = outlineTopY - sepGap;
      const nameY = Math.max(20, sepY - nameGap - wmFontSize);
      const sepX = Math.round((1080 - sepW) / 2);
      // Letter-spacing: space between each char within words, wider gaps
      // between words for clear word boundaries.
      const spacedName = wmName.split(" ").map((w: string) => w.split("").join(" ")).join("   ");

      // 1) Thin subtle separator line — white at very low opacity.
      wordmarkChain.push(
        `color=c=white@0.15:s=${sepW}x${sepH}:d=0.04:rate=${fps},format=yuva420p,loop=loop=-1:size=1:start=0[wm_sep]`,
      );
      // 2) Brand name text — refined italic, soft shadow, no border glow.
      wordmarkChain.push(
        `[burned]drawtext=fontfile='${wmFontFile}':text='${escapeDrawtext(spacedName)}':fontsize=${wmFontSize}:fontcolor=white@0.92:x=(w-text_w)/2:y=${nameY}:shadowcolor=black@0.3:shadowx=0:shadowy=2[wm_name]`,
      );
      // 3) Overlay separator between name and card.
      wordmarkChain.push(
        `[wm_name][wm_sep]overlay=${sepX}:${sepY}[${preOutroLabel}]`,
      );
    } else {
      // ── Display wordmark ──────────────────────────────────────────────
      // Heavy bold broadcast aesthetic: Segoe UI Black + purple border glow +
      // gradient underline (purple→cyan) + cyan uppercased tag.
      const gapAboveOutline = 32;
      const tagToUnderlineGap = 14;
      const mainToUnderlineGap = 18;
      const wmTag = brandTag ? brandTag.toUpperCase() : "";
      // Compute Ys bottom-up so the block always lands flush above the outline.
      const wmBlockBottom = outlineTopY - gapAboveOutline;
      const tagBottomY = wmBlockBottom;
      const tagY = tagBottomY - wmTagFontSize;
      const underlineBottomY = wmTag ? (tagY - tagToUnderlineGap) : wmBlockBottom;
      const underlineY = underlineBottomY - wmUnderlineH;
      const mainBottomY = underlineY - mainToUnderlineGap;
      const mainY = Math.max(20, mainBottomY - wmFontSize);
      const underlineX = Math.round((1080 - wmUnderlineW) / 2);

      // 1) Gradient underline color-source. R=124→34 (G=58→211, B=237→238).
      wordmarkChain.push(
        `color=c=black:s=${wmUnderlineW}x${wmUnderlineH}:r=${fps}:d=0.04,format=rgba,geq=r='124-90*X/W':g='58+153*X/W':b='237+X/W':a=255,format=yuva420p,loop=loop=-1:size=1:start=0[wm_underline]`,
      );
      // 2) Main wordmark text — drawn straight onto [burned] (post-captions).
      //    Segoe UI Black for the heavier display weight, plus a slim purple
      //    border (#A855F7@0.65, 2px) that reads as a colored halo around each
      //    letter. Black drop-shadow at +0/+3 adds depth without harshness.
      wordmarkChain.push(
        `[burned]drawtext=fontfile='${wmFontFile}':text='${escapeDrawtext(wmName)}':fontsize=${wmFontSize}:fontcolor=white:x=(w-text_w)/2:y=${mainY}:bordercolor=0xA855F7@0.65:borderw=2:shadowcolor=black@0.55:shadowx=0:shadowy=3[wm_main]`,
      );
      // 3) Overlay underline on top of main-text stage.
      const afterUnderlineLabel = wmTag ? "wm_underline_done" : preOutroLabel;
      wordmarkChain.push(
        `[wm_main][wm_underline]overlay=${underlineX}:${underlineY}[${afterUnderlineLabel}]`,
      );
      // 4) Tag text (cyan, uppercased, semibold for a touch more weight,
      //    light letter-spacing approximated by inserting thin spaces ` ` (U+2009)
      //    between glyphs — gives the wordmark a "broadcasting" feel).
      if (wmTag) {
        const spacedTag = wmTag.split("").join(" ");
        wordmarkChain.push(
          `[wm_underline_done]drawtext=fontfile='${fontBold}':text='${escapeDrawtext(spacedTag)}':fontsize=${wmTagFontSize}:fontcolor=0x22D3EE:x=(w-text_w)/2:y=${tagY}:shadowcolor=black@0.4:shadowx=0:shadowy=2[${preOutroLabel}]`,
        );
      }
    }
  }

  // Fullbleed corner branding — top-left of the canvas (in place of the
  // wordmark stack). Two variants:
  //   • With logoPath (default since 2026-06-11): a rounded "album-art" badge
  //     of the logo PNG at (60,60), with the corner text drawn beside it,
  //     vertically centered against the badge — a horizontal lockup.
  //   • Without logo: legacy bare corner text at (60,80).
  // Default text font is Palatino Linotype Italic; swap via
  // fullbleedCornerFontFile. Badge size/radius ride the existing logoWidth /
  // logoCornerRadius opts (env PODCAST_LOGO_WIDTH / PODCAST_LOGO_RADIUS).
  const fullbleedCornerChain: string[] = [];
  if (hasFullbleedCorner) {
    const cornerX = 60;
    if (wantCornerBadge) {
      const badgeW = logoWidth;
      const badgeR = Math.max(0, Math.min(Math.floor(badgeW / 2), logoCornerRadius));
      // Top-RIGHT lockup (moved from top-left 2026-06-11): the channel name
      // sits to the LEFT of the logo badge. Geometry picked to clear the
      // TikTok / Reels top-right UI (search / camera icons live at y<160
      // hugging the corner) and the channel's 120px right safe margin:
      //   badge right edge at x = 1080-120, badge top at y = 180.
      const badgeRightMargin = 120;
      const badgeX = 1080 - badgeRightMargin - badgeW;
      const badgeY = 180;
      const badgeTextGap = 26;
      const badgeMask = badgeR > 0
        ? `,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt(X,${badgeR})*lt(Y,${badgeR}),if(lte(pow(${badgeR}-X,2)+pow(${badgeR}-Y,2),${badgeR * badgeR}),255,0),if(gt(X,W-${badgeR})*lt(Y,${badgeR}),if(lte(pow(X-W+${badgeR},2)+pow(${badgeR}-Y,2),${badgeR * badgeR}),255,0),if(lt(X,${badgeR})*gt(Y,H-${badgeR}),if(lte(pow(${badgeR}-X,2)+pow(Y-H+${badgeR},2),${badgeR * badgeR}),255,0),if(gt(X,W-${badgeR})*gt(Y,H-${badgeR}),if(lte(pow(X-W+${badgeR},2)+pow(Y-H+${badgeR},2),${badgeR * badgeR}),255,0),255))))'`
        : "";
      // Square-crop the logo (it ships square; crop guards odd sources), then
      // round the corners with the usual geq alpha mask.
      fullbleedCornerChain.push(
        `[${logoBrandInput}]scale=${badgeW}:${badgeW}:force_original_aspect_ratio=increase,crop=${badgeW}:${badgeW}${badgeMask}[corner_badge]`,
      );
      const afterBadgeLabel = fullbleedCornerText ? "corner_badged" : preOutroLabel;
      fullbleedCornerChain.push(
        `[burned][corner_badge]overlay=${badgeX}:${badgeY}[${afterBadgeLabel}]`,
      );
      if (fullbleedCornerText) {
        // Right-align the name against the badge's left edge via text_w.
        const textRightEdge = badgeX - badgeTextGap;
        const textY = badgeY + Math.round((badgeW - fullbleedCornerFontSize) / 2) - 2;
        fullbleedCornerChain.push(
          `[corner_badged]drawtext=fontfile='${fullbleedCornerFontFile}':text='${escapeDrawtext(fullbleedCornerText)}':fontsize=${fullbleedCornerFontSize}:fontcolor=white:x=${textRightEdge}-text_w:y=${textY}:shadowcolor=black@0.75:shadowx=0:shadowy=3:borderw=1:bordercolor=black@0.4[${preOutroLabel}]`,
        );
      }
    } else {
      // Text-only branding (logo disabled via PODCAST_LOGO="") — the channel
      // name alone asserts the watermark. TOP-LEFT placement (moved from
      // top-right 2026-06-11 per user request): x=80 (left safe margin),
      // y=180 (clears the TikTok / Reels top UI row at y<160).
      const cornerLeftX = 80;
      const cornerY = 180;
      fullbleedCornerChain.push(
        `[burned]drawtext=fontfile='${fullbleedCornerFontFile}':text='${escapeDrawtext(fullbleedCornerText)}':fontsize=${fullbleedCornerFontSize}:fontcolor=white:x=${cornerLeftX}:y=${cornerY}:shadowcolor=black@0.75:shadowx=0:shadowy=3:borderw=1:bordercolor=black@0.4[${preOutroLabel}]`,
      );
    }
  }

  // Outro stage — matches the /create-video Remotion outro layout as close as
  // ffmpeg primitives allow.
  //
  // Visual stack (matches the reference frame from /create-video):
  //   • Purple full-screen background (~#4C1D95)
  //   • Brand-shell stays top-left (already drawn earlier in the chain)
  //   • Outlined "Theo dõi ngay" pill at y≈720 (transparent fill, white
  //     stroke, white text)
  //   • Channel name big white bold at y≈900 (Remotion uses gradient text;
  //     we use solid white because ffmpeg drawtext can't gradient-fill)
  //   • Cyan gradient underline at y≈1020 (we use solid cyan accent)
  //   • "Nguồn: Sưu tầm" gray at y≈1080
  //   • TikTok follow card HORIZONTAL at y≈1500: dark transparent backplate,
  //     avatar circle left, name + handle + followers middle, pink pill
  //     "Following ✓" right
  const outroChain: string[] = [];
  if (hasOutroOverlay) {
    const t0 = outroStart.toFixed(3);
    const enable = `enable='gte(t\\,${t0})'`;

    // Animation timeline (relative to outroStart) — mirrors /create-video's
    // animations.js animateOutro() exactly:
    //   t=0.20  CTA pill: y from -30, fade-in (0.5s)
    //   t=0.55  Channel name: fade-in (0.6s)  [scale 0.6→1 skipped — drawtext no scale]
    //   t=0.95  Underline: width 0 → full (0.55s)  [via crop draw-in]
    //   t=1.35  Source text: y from +20, fade-in (0.4s)
    //   t=1.60  TT follow card: y from +300, fade-in (0.55s)
    //   t=2.65  Button text: "Follow" → "Following ✓" swap (skipped; static "Follow")
    const ANIM = {
      cta: { delay: 0.20, dur: 0.5, offset: -30 },
      channel: { delay: 0.55, dur: 0.6 },
      underline: { delay: 0.95, dur: 0.55 },
      source: { delay: 1.35, dur: 0.4, offset: 20 },
      ttCard: { delay: 1.6, dur: 0.55, offset: 300 },
    };
    // Helper: ffmpeg expression for y position interpolating from `baseY +
    // startOffset` at (outroStart+delay) to `baseY` at (outroStart+delay+dur).
    // `\\,` is the JS-escaped `\,` that ffmpeg expressions require for comma
    // arguments inside function calls.
    const animY = (baseY: number, startOffset: number, delay: number, duration: number): string => {
      if (startOffset === 0 || duration <= 0) return `${baseY}`;
      const T0 = (outroStart + delay).toFixed(3);
      const D = duration.toFixed(3);
      const op = startOffset > 0 ? "+" : "-";
      const abs = Math.abs(startOffset);
      return `${baseY}${op}${abs}*(1-clip((t-${T0})/${D}\\,0\\,1))`;
    };
    // Helper: alpha 0→1 starting at (outroStart+delay) over `duration` s.
    const animAlpha = (delay: number, duration: number): string => {
      if (duration <= 0) return "1";
      const T0 = (outroStart + delay).toFixed(3);
      const D = duration.toFixed(3);
      return `clip((t-${T0})/${D}\\,0\\,1)`;
    };

    // Helper: build a rounded-rect alpha-mask geq formula for a (W,H) box with
    // corner radius R. Returns the geq alpha expression (not the full filter).
    const roundedRectMask = (R: number) => {
      const RR = R * R;
      // Note the \\, comma escapes — required inside an `enable='…'` arg
      // because the filter parser otherwise eats the bare commas.
      return (
        `if(lt(X\\,${R})*lt(Y\\,${R})\\,if(lte(pow(${R}-X\\,2)+pow(${R}-Y\\,2)\\,${RR})\\,255\\,0)\\,` +
        `if(gt(X\\,W-${R})*lt(Y\\,${R})\\,if(lte(pow(X-W+${R}\\,2)+pow(${R}-Y\\,2)\\,${RR})\\,255\\,0)\\,` +
        `if(lt(X\\,${R})*gt(Y\\,H-${R})\\,if(lte(pow(${R}-X\\,2)+pow(Y-H+${R}\\,2)\\,${RR})\\,255\\,0)\\,` +
        `if(gt(X\\,W-${R})*gt(Y\\,H-${R})\\,if(lte(pow(X-W+${R}\\,2)+pow(Y-H+${R}\\,2)\\,${RR})\\,255\\,0)\\,255))))`
      );
    };

    // 1) Vertical gradient background — matches /create-video CSS
    //    linear-gradient(180deg, #4c1d95 0%, #0a1628 100%). The `gradient`
    //    lavfi filter is missing in some ffmpeg builds, so compute it via
    //    `geq` over an rgba canvas: r/g/b interpolate from top to bottom.
    //    #4C1D95 = rgb(76,29,149); #0A1628 = rgb(10,22,40).
    outroChain.push(
      `color=c=black:s=1080x1920:r=${fps}:d=0.04,format=rgba,geq=r='76-66*Y/H':g='29-7*Y/H':b='149-109*Y/H':a=255,format=yuva420p,loop=loop=-1:size=1:start=0[outro_grad]`,
    );
    outroChain.push(
      `[${preOutroLabel}][outro_grad]overlay=0:0:${enable}[outro_bg]`,
    );

    // 2) "Theo dõi ngay" pill — 3px white@0.7 border, 50px corner radius,
    //    52px white text. CTA padding ≈ 20×56, so size ≈ text_w + 112 wide,
    //    52 + 40 = 92 tall. Build it as a rounded-mask color source + text.
    const ctaH = 92;
    const ctaPillW = 460; // width sized for "Theo dõi ngay" at 52px text
    const ctaPillX = Math.round((1080 - ctaPillW) / 2);
    const ctaPillY = 760;
    const ctaR = 46; // pill radius (≈ half height for capsule)
    // White rounded rectangle as the OUTER border, with a slightly smaller
    // gradient rectangle "punched" inside to leave only a 3px ring.
    outroChain.push(
      `color=c=white@0.7:s=${ctaPillW}x${ctaH}:d=0.04:rate=${fps},format=yuva420p,geq=lum='p(X\\,Y)':cb='p(X\\,Y)':cr='p(X\\,Y)':a='${roundedRectMask(ctaR)}',loop=loop=-1:size=1:start=0[cta_ring_outer]`,
    );
    // Inner punch: same gradient color, slightly smaller and inset 3px.
    const ctaInsetW = ctaPillW - 6;
    const ctaInsetH = ctaH - 6;
    const ctaInsetR = ctaR - 3;
    // Pick the visual midpoint of the gradient where the CTA sits (y≈800/1920
    // ≈ 42% from top) → blend mostly purple, slight dark-blue tint.
    outroChain.push(
      `color=c=0x3A1875:s=${ctaInsetW}x${ctaInsetH}:d=0.04:rate=${fps},format=yuva420p,geq=lum='p(X\\,Y)':cb='p(X\\,Y)':cr='p(X\\,Y)':a='${roundedRectMask(ctaInsetR)}',loop=loop=-1:size=1:start=0[cta_inner]`,
    );
    // CTA pill slides down from y=ctaPillY-30 to ctaPillY over 0.5s starting
    // at outroStart+0.2. All three sub-layers (outer ring, inner punch, text)
    // share the same y animation so they move in lockstep.
    const ctaRingY = animY(ctaPillY, ANIM.cta.offset, ANIM.cta.delay, ANIM.cta.dur);
    const ctaInnerY = animY(ctaPillY + 3, ANIM.cta.offset, ANIM.cta.delay, ANIM.cta.dur);
    const ctaTextY = animY(ctaPillY + Math.round((ctaH - 52) / 2) - 4, ANIM.cta.offset, ANIM.cta.delay, ANIM.cta.dur);
    const ctaAlpha = animAlpha(ANIM.cta.delay, ANIM.cta.dur);
    outroChain.push(
      `[outro_bg][cta_ring_outer]overlay=${ctaPillX}:'${ctaRingY}':eval=frame:${enable}[outro_cta_ring]`,
    );
    outroChain.push(
      `[outro_cta_ring][cta_inner]overlay=${ctaPillX + 3}:'${ctaInnerY}':eval=frame:${enable}[outro_cta_bg]`,
    );
    // CTA text — 52px Inter-substitute (Segoe UI Bold). Animated y + alpha.
    outroChain.push(
      `[outro_cta_bg]drawtext=fontfile='${fontBold}':text='${escapeDrawtext(outroCta)}':fontsize=52:fontcolor=white:x=(w-text_w)/2:y='${ctaTextY}':alpha='${ctaAlpha}':${enable}[outro_cta]`,
    );

    // 3) Channel name — 120px in /create-video CSS, but for long names like
    //    "SportsForAllPodcast" (19 chars) we taper down so it stays inside
    //    the 1080 canvas with comfortable padding. User wants "vừa phải".
    const nameLen = outroChannelName.length;
    // Auto-size so the name comfortably fits within the 920px content width
    // even for long brand names. Tiers tuned for Segoe UI Bold avg-glyph
    // width ≈ 0.55em.
    const nameFontSize = nameLen <= 12 ? 120
      : nameLen <= 14 ? 110
      : nameLen <= 16 ? 100
      : nameLen <= 18 ? 92
      : nameLen <= 22 ? 84
      : 76;
    // Gap below CTA: 80px (CSS margin-bottom). CTA bottom = ctaPillY + ctaH = 852.
    const nameY = ctaPillY + ctaH + 80;
    // Channel name fades in over 0.6s starting at outroStart+0.55. /create-
    // video also scales it 0.6→1, but drawtext lacks a scale param so we keep
    // fade-only (still gives a noticeable "appear" beat).
    const channelAlpha = animAlpha(ANIM.channel.delay, ANIM.channel.dur);
    outroChain.push(
      `[outro_cta]drawtext=fontfile='${fontBold}':text='${escapeDrawtext(outroChannelName)}':fontsize=${nameFontSize}:fontcolor=white:x=(w-text_w)/2:y=${nameY}:alpha='${channelAlpha}':shadowcolor=0xA855F7@0.55:shadowx=0:shadowy=0:borderw=0:${enable}[outro_name]`,
    );

    // 4) Gradient underline — 280×4 px, #7c3aed → #22d3ee, 40px below name.
    const underlineW = 280;
    const underlineH = 4;
    const underlineY = nameY + nameFontSize + 40;
    const underlineX = Math.round((1080 - underlineW) / 2);
    // Horizontal gradient via geq. Underline appears with delayed enable so
    // it pops in after the channel name finishes its fade-in — keeps the
    // animation cadence even without a true draw-in sweep.
    const ulT0 = (outroStart + ANIM.underline.delay).toFixed(3);
    outroChain.push(
      `color=c=black:s=${underlineW}x${underlineH}:r=${fps}:d=0.04,format=rgba,geq=r='124-90*X/W':g='58+153*X/W':b='237+X/W':a=255,format=yuva420p,loop=loop=-1:size=1:start=0[outro_underline_grad]`,
    );
    outroChain.push(
      `[outro_name][outro_underline_grad]overlay=${underlineX}:${underlineY}:enable='gte(t\\,${ulT0})'[outro_underline]`,
    );

    // 5) "Nguồn: Sưu tầm" — 44px Inter 500, white@0.65, 40px below underline.
    // Slides up from sourceY+20 over 0.4s with fade-in.
    const sourceY = underlineY + underlineH + 40;
    const sourceTextY = animY(sourceY, ANIM.source.offset, ANIM.source.delay, ANIM.source.dur);
    const sourceAlpha = animAlpha(ANIM.source.delay, ANIM.source.dur);
    outroChain.push(
      `[outro_underline]drawtext=fontfile='${fontReg}':text='${escapeDrawtext("Nguồn: " + outroSource)}':fontsize=44:fontcolor=white@0.65:x=(w-text_w)/2:y='${sourceTextY}':alpha='${sourceAlpha}':${enable}[outro_source]`,
    );

    // 6) TikTok follow card — solid #1a1a1a pill (75px corner radius),
    //    bottom 360px from canvas bottom. Layout:
    //    [avatar 120 + 3px ring] [name/handle/followers] [Follow pill 250×80]
    const cardW = 920;
    const cardH = 170;
    const cardR = 75;
    const cardX = Math.round((1080 - cardW) / 2);
    const cardY = 1920 - 360 - cardH; // = 1390
    outroChain.push(
      `color=c=0x1A1A1A:s=${cardW}x${cardH}:d=0.04:rate=${fps},format=yuva420p,geq=lum='p(X\\,Y)':cb='p(X\\,Y)':cr='p(X\\,Y)':a='${roundedRectMask(cardR)}',loop=loop=-1:size=1:start=0[tt_card_bg]`,
    );
    // TT card slides UP from +300px over 0.55s starting at outroStart+1.6.
    // All sub-elements (avatar ring, avatar, profile text, follow button)
    // use the SAME y animation so the card moves as one cohesive unit.
    const ttCardY = animY(cardY, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
    const ttCardAlpha = animAlpha(ANIM.ttCard.delay, ANIM.ttCard.dur);
    outroChain.push(
      `[outro_source][tt_card_bg]overlay=${cardX}:'${ttCardY}':eval=frame:${enable}[outro_card_bg]`,
    );

    // Avatar 120 + 3px #333 ring around it.
    const cardAvatarD = 120;
    const cardAvatarX = cardX + 25;
    const cardAvatarY = cardY + Math.round((cardH - cardAvatarD) / 2);
    let afterAvatarLabel = "outro_card_bg";
    if (wantAvatar) {
      // Ring: 126×126 #333 circle.
      const ringD = cardAvatarD + 6;
      const ringR = ringD / 2;
      outroChain.push(
        `color=c=0x333333:s=${ringD}x${ringD}:d=0.04:rate=${fps},format=yuva420p,geq=lum='p(X\\,Y)':cb='p(X\\,Y)':cr='p(X\\,Y)':a='if(lte(pow(X-${ringR}\\,2)+pow(Y-${ringR}\\,2)\\,${ringR * ringR})\\,255\\,0)',loop=loop=-1:size=1:start=0[tt_avatar_ring]`,
      );
      const ttAvatarRingY = animY(cardAvatarY - 3, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
      outroChain.push(
        `[outro_card_bg][tt_avatar_ring]overlay=${cardAvatarX - 3}:'${ttAvatarRingY}':eval=frame:${enable}[outro_avatar_ring]`,
      );
      // Avatar — scale the pre-built 240px circular [logo_avatar] down to 120.
      outroChain.push(
        `[logo_avatar]scale=${cardAvatarD}:${cardAvatarD}[logo_avatar_small]`,
      );
      const ttAvatarY = animY(cardAvatarY, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
      outroChain.push(
        `[outro_avatar_ring][logo_avatar_small]overlay=${cardAvatarX}:'${ttAvatarY}':eval=frame:${enable}[outro_avatar]`,
      );
      afterAvatarLabel = "outro_avatar";
    }

    // Middle column: name 42 DM Sans 700 white / handle 28 #a0a0a0 / followers 25 #737373.
    // CSS: padding-top 25, gap ≈ 2px between lines (line-height 1.3 with small font).
    // For px: name baseline ≈ cardY+25; handle ≈ +50; followers ≈ +35 below handle.
    // All three text rows slide UP in lockstep with the card.
    const colX = cardAvatarX + cardAvatarD + 30;
    const colNameY = cardY + 22;
    const colHandleY = colNameY + 50;
    const colFollowersY = colHandleY + 38;
    const ttNameY = animY(colNameY, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
    const ttHandleY = animY(colHandleY, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
    const ttFollowersY = animY(colFollowersY, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
    outroChain.push(
      `[${afterAvatarLabel}]` +
      `drawtext=fontfile='${fontBold}':text='${escapeDrawtext(outroChannelName)}':fontsize=42:fontcolor=white:x=${colX}:y='${ttNameY}':alpha='${ttCardAlpha}':${enable},` +
      `drawtext=fontfile='${fontReg}':text='${escapeDrawtext(outroHandle)}':fontsize=28:fontcolor=0xA0A0A0:x=${colX}:y='${ttHandleY}':alpha='${ttCardAlpha}':${enable},` +
      `drawtext=fontfile='${fontReg}':text='${escapeDrawtext(outroFollowers)}':fontsize=25:fontcolor=0x737373:x=${colX}:y='${ttFollowersY}':alpha='${ttCardAlpha}':${enable}[outro_card_text]`,
    );

    // Follow button — 250×80 TikTok-pink (#fe2c55) pill, 40px radius,
    //    "Follow" text (30px DM Sans 700 white). Animated alongside card.
    const followBtnW = 250;
    const followBtnH = 80;
    const followBtnX = cardX + cardW - 25 - followBtnW;
    const followBtnY = cardY + Math.round((cardH - followBtnH) / 2);
    const followBtnR = 40;
    const ttFollowBtnY = animY(followBtnY, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
    const ttFollowTextY = animY(followBtnY + Math.round((followBtnH - 30) / 2) - 4, ANIM.ttCard.offset, ANIM.ttCard.delay, ANIM.ttCard.dur);
    outroChain.push(
      `color=c=0xFE2C55:s=${followBtnW}x${followBtnH}:d=0.04:rate=${fps},format=yuva420p,geq=lum='p(X\\,Y)':cb='p(X\\,Y)':cr='p(X\\,Y)':a='${roundedRectMask(followBtnR)}',loop=loop=-1:size=1:start=0[follow_pill]`,
    );
    outroChain.push(
      `[outro_card_text][follow_pill]overlay=${followBtnX}:'${ttFollowBtnY}':eval=frame:${enable}[outro_follow_bg]`,
    );
    outroChain.push(
      `[outro_follow_bg]drawtext=fontfile='${fontBold}':text='${escapeDrawtext("Follow")}':fontsize=30:fontcolor=white:x=${followBtnX}+(${followBtnW}-text_w)/2:y='${ttFollowTextY}':alpha='${ttCardAlpha}':${enable}[final]`,
    );
  }

  // === FULLBLEED VISUAL CHAIN ===
  // Aesthetic-bg mode: source video fills the full 1080×1920 canvas
  // (cover-crop), with an optional black dim overlay so the karaoke
  // captions stay legible. No card, no chrome.
  const fullbleedVisual: string[] = [];
  if (layout === "fullbleed") {
    if (fullbleedDim > 0) {
      fullbleedVisual.push(
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[fb_scaled]`,
      );
      fullbleedVisual.push(
        `color=c=black@${fullbleedDim.toFixed(3)}:s=1080x1920:r=${fps}[fb_dim]`,
      );
      fullbleedVisual.push(
        `[fb_scaled][fb_dim]overlay=0:0:shortest=1[composed]`,
      );
    } else {
      fullbleedVisual.push(
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[composed]`,
      );
    }
  }

  // === LANDSCAPE VISUAL CHAIN ===
  // 16:9 (or wider) source on a black 9:16 canvas. Source is fitted to
  // width=1080 with NO crop — letterbox safety pad if aspect is wider than
  // 16:9. Height comes from `landscapeVideoHeight` (resolved by pipeline.ts
  // from ffprobe) and centered vertically with a small upward bias so the
  // burned-in caption (sitting inside the strip's lower portion) reads
  // against the footage, not against dead black space below it.
  const landscapeVisual: string[] = [];
  let landscapeVideoY = 0;
  let landscapeVideoH = 608;
  if (layout === "landscape") {
    // Caller may pass the actual source W/H via foregroundWidth/foregroundHeight
    // as a hint; otherwise we let ffmpeg's force_original_aspect_ratio=decrease
    // pad to a default 1080×608 box (true 16:9 strip). The pipeline normally
    // probes the source and passes the real height so the strip matches.
    landscapeVideoH = Math.max(200, Math.min(1080, Math.floor(opts.foregroundHeight ?? 608)));
    landscapeVideoY = Math.max(0, Math.min(
      1920 - landscapeVideoH,
      Math.round((1920 - landscapeVideoH) / 2) + landscapeVerticalBias,
    ));
    // Black 9:16 canvas.
    landscapeVisual.push(`color=c=black:s=1080x1920:r=${fps}[bg]`);
    // Scale source to width=1080 fit-inside (no crop). Pad if needed so the
    // strip is exactly 1080×landscapeVideoH.
    landscapeVisual.push(
      `[0:v]scale=1080:${landscapeVideoH}:force_original_aspect_ratio=decrease,` +
        `pad=1080:${landscapeVideoH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[ls_strip]`,
    );
    landscapeVisual.push(
      `[bg][ls_strip]overlay=0:${landscapeVideoY}:shortest=1[composed]`,
    );
  }

  // === VIGNETTE VISUAL CHAIN ===
  // Split source: one copy is scaled up + heavily blurred + dimmed to cover
  // the full 1080×1920 canvas as a vignette background; the second copy sits
  // sharp in the rounded card on top. Then decorate with mock UI elements:
  // search bar at top, watermark on card, progress bar + timestamp at bottom.
  const vignetteVisual: string[] = [];
  let vignetteSubsInput = "composed";
  if (layout === "vignette") {
    // Build a rounded-mask geq formula for the sharp foreground card.
    const roundedMaskFg = radius > 0
      ? `format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt(X,${radius})*lt(Y,${radius}),if(lte(pow(${radius}-X,2)+pow(${radius}-Y,2),${radius * radius}),255,0),if(gt(X,W-${radius})*lt(Y,${radius}),if(lte(pow(X-W+${radius},2)+pow(${radius}-Y,2),${radius * radius}),255,0),if(lt(X,${radius})*gt(Y,H-${radius}),if(lte(pow(${radius}-X,2)+pow(Y-H+${radius},2),${radius * radius}),255,0),if(gt(X,W-${radius})*gt(Y,H-${radius}),if(lte(pow(X-W+${radius},2)+pow(Y-H+${radius},2),${radius * radius}),255,0),255))))'`
      : "";
    let canvasLabel: string;
    if (vignetteBgEnabled) {
      // Split source: blurred zoomed copy for vignette bg + sharp copy for card.
      vignetteVisual.push(`[0:v]split=2[src_a][src_b]`);
      vignetteVisual.push(
        `[src_a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=${blurSigma},eq=brightness=${vBrightness.toFixed(2)}:saturation=${vSaturation.toFixed(2)},setsar=1[bg_vignette]`,
      );
      vignetteVisual.push(
        `[src_b]${scaleAndPad}${roundedMaskFg ? `,${roundedMaskFg}` : ""}[fg]`,
      );
      canvasLabel = "bg_vignette";
    } else {
      // Pure black canvas behind the sharp card — same card-sizing + caption
      // chunks as vignette, just no blurred backdrop.
      vignetteVisual.push(`color=c=black:s=1080x1920:r=${fps}[bg_black]`);
      vignetteVisual.push(
        `[0:v]${scaleAndPad}${roundedMaskFg ? `,${roundedMaskFg}` : ""}[fg]`,
      );
      canvasLabel = "bg_black";
    }
    // Apply optional white stroke underneath the card so the rounded corners
    // read against a pure-black canvas (black-on-black would hide the curve).
    // The strokeChain + strokeOverlay variables are built earlier — reuse them
    // but redirect overlay to the vignette canvas label.
    let preFgComposeLabel = canvasLabel;
    if (showStroke && strokeChain) {
      vignetteVisual.push(strokeChain);
      preFgComposeLabel = `${canvasLabel}_stroked`;
      vignetteVisual.push(
        `[${canvasLabel}][stroke]overlay=${fgX - cardStrokeW}:${fgY - cardStrokeW}[${preFgComposeLabel}]`,
      );
    }
    vignetteVisual.push(`[${preFgComposeLabel}][fg]overlay=${fgX}:${fgY}:shortest=1[composed]`);

    // Mock UI decorations.
    let cur = "composed";
    // Search bar mock — translucent dark pill below the brand-shell row.
    // Brand-shell occupies roughly y=60-150 (logo 90px + 60px margin), so the
    // search bar starts at y=180 to leave a 30px gap.
    if (searchBarText) {
      const sbX = 80, sbY = 180, sbW = 920, sbH = 80;
      const sbTextY = sbY + Math.round((sbH - 30) / 2) - 2;
      vignetteVisual.push(
        `[${cur}]drawbox=x=${sbX}:y=${sbY}:w=${sbW}:h=${sbH}:color=0x1F2937@0.55:t=fill,` +
        // Tiny circle "lens" as search-icon placeholder
        `drawbox=x=${sbX + 28}:y=${sbY + 28}:w=24:h=24:color=white@0.5:t=2,` +
        `drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='${escapeDrawtext(searchBarText)}':fontsize=30:fontcolor=white@0.55:x=${sbX + 80}:y=${sbTextY}[with_searchbar]`,
      );
      cur = "with_searchbar";
    }
    // Watermark — small faded text top-right of card.
    if (watermarkText) {
      vignetteVisual.push(
        `[${cur}]drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='${escapeDrawtext(watermarkText)}':fontsize=22:fontcolor=white@0.45:x=${fgX + fgBoxW - 290}:y=${fgY + 28}:shadowcolor=black@0.5:shadowx=1:shadowy=1[with_watermark]`,
      );
      cur = "with_watermark";
    }
    // Optional play-button triangle in center of card.
    if (playButtonEnabled) {
      // Triangle approximated as 3 overlapping drawbox lines — simpler than geq path.
      // A 100×100 white@0.6 triangle is hard with primitives; use a drawtext with
      // the unicode triangle ▶ as a pragmatic substitute.
      const pbCx = fgX + Math.floor(fgBoxW / 2);
      const pbCy = fgY + Math.floor(fgBoxH / 2);
      vignetteVisual.push(
        `[${cur}]drawtext=fontfile='C\\:/Windows/Fonts/seguisym.ttf':text='▶':fontsize=140:fontcolor=white@0.55:x=${pbCx - 50}:y=${pbCy - 90}:shadowcolor=black@0.4:shadowx=2:shadowy=2[with_play]`,
      );
      cur = "with_play";
    }
    // Progress bar + timestamp at bottom (mock player UI).
    if (progressBarEnabled) {
      const speakTotal = opts.ttsDurationSec + tailSec;
      const barX = 120, barY = 1800, barW = 840, barH = 4;
      const totalMm = Math.floor(speakTotal / 60);
      const totalSs = Math.round(speakTotal % 60).toString().padStart(2, "0");
      const totalLabel = `${totalMm}:${totalSs}`;
      // Track (dim) + fill (bright, time-varying width) + total-duration label
      vignetteVisual.push(
        `[${cur}]drawbox=x=${barX}:y=${barY}:w=${barW}:h=${barH}:color=white@0.25:t=fill,` +
        `drawbox=x=${barX}:y=${barY}:w='min(${barW}*t/${speakTotal.toFixed(3)}\\,${barW})':h=${barH}:color=white:t=fill,` +
        `drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='${escapeDrawtext(totalLabel)}':fontsize=24:fontcolor=white@0.7:x=${barX + barW - 70}:y=${barY + 20}[with_progress]`,
      );
      cur = "with_progress";
    }
    vignetteSubsInput = cur;
  }

  const filter = [
    ...(layout === "vignette"
      ? vignetteVisual
      : layout === "fullbleed"
        ? fullbleedVisual
        : layout === "landscape"
          ? landscapeVisual
          : [
            // Pure-black 9:16 canvas. Duration is clamped at the output side via -t.
            `color=c=black:s=1080x1920:r=${fps}[bg]`,
            fgChain,
            ...(strokeChain ? [strokeChain, strokeOverlay!] : []),
            `[${preFgOverlayLabel}][fg]overlay=${fgX}:${fgY}:shortest=1[composed]`,
          ]),
    `[${layout === "vignette" ? vignetteSubsInput : "composed"}]subtitles=${assFilename}[${subtitlesLabel}]`,
    ...logoChainAdjusted,
    ...textChainAdjusted,
    ...wordmarkChain,
    ...fullbleedCornerChain,
    ...outroChain,
    ...audioChain,
  ].join(";");

  // When multiple source videos are provided, feed them through the concat
  // demuxer as a single logical input. Write a concat list next to the output
  // so the spawned ffmpeg can find it via the cwd we already set.
  let videoInputArgs: string[];
  if (absSources.length === 1) {
    videoInputArgs = ["-stream_loop", "-1", "-i", absSources[0]];
  } else {
    const concatListPath = join(workDir, "concat.txt");
    const lines = absSources
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(concatListPath, lines + "\n", "utf-8");
    videoInputArgs = [
      "-stream_loop", "-1",
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
    ];
  }

  const args = [
    "-y",
    // Loop the video sequence forever; the -t at the output side stops
    // encoding once we've covered the TTS duration.
    ...videoInputArgs,
    "-i", absAudio,
  ];
  if (bgMusic) {
    args.push("-stream_loop", "-1", "-i", bgMusic);
  }
  if (logoPath) {
    // Loop the logo forever so it covers the whole TTS duration; PNG already
    // works as a single-frame input but -stream_loop keeps timing consistent.
    args.push("-stream_loop", "-1", "-i", logoPath);
  }
  if (outroAudio) {
    // Outro voice is a one-shot — no loop. adelay in the filter graph offsets
    // it to outroStart so it lands during the outro phase.
    args.push("-i", outroAudio);
  }
  args.push(
    "-filter_complex", filter,
    "-map", "[final]",
    "-map", aoutLabel,
    "-t", totalDur.toFixed(3),
    "-r", String(fps),
    "-c:v", "libx264",
    "-preset", preset,
    "-crf", String(crf),
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    absOut,
  );

  await runFfmpeg(args, workDir);
}

/**
 * Escape a literal string for ffmpeg's drawtext `text=` value. Within a
 * single-quoted filter argument, single quotes themselves must be escaped, as
 * must backslashes and the colon. Newlines are preserved as literal newlines.
 */
function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

function runFfmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { cwd });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const tail = stderr.split("\n").slice(-25).join("\n");
        reject(new Error(`ffmpeg compose failed (exit ${code}):\n${tail}`));
      }
    });
  });
}

/**
 * Validate that a source video file exists and is something ffmpeg can read.
 * Cheap probe via ffprobe; returns the duration in seconds for logging.
 */
export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  /** Decimal frames-per-second, parsed from r_frame_rate (e.g. "30/1" → 30, "30000/1001" → 29.97). */
  fps: number;
  /** Pixel format (e.g. "yuv420p"). May be empty when stream metadata is missing it. */
  pixFmt: string;
  /** Video codec name (e.g. "h264"). */
  codec: string;
}

export async function probeVideo(sourceVideoPath: string): Promise<ProbeResult> {
  const abs = resolvePath(sourceVideoPath);
  const out = await new Promise<string>((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,r_frame_rate,pix_fmt,codec_name:format=duration",
      "-of", "default=noprint_wrappers=1",
      abs,
    ]);
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe failed on ${basename(abs)} (exit ${code}): ${stderr}`));
    });
  });

  const parseNum = (key: string): number | null => {
    const m = out.match(new RegExp(`${key}=([0-9.]+)`));
    return m ? parseFloat(m[1]) : null;
  };
  const parseStr = (key: string): string => {
    const m = out.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return m ? m[1].trim() : "";
  };
  const width = parseNum("width");
  const height = parseNum("height");
  const durationSec = parseNum("duration");
  if (!width || !height || !durationSec) {
    throw new Error(`ffprobe did not return width/height/duration for ${basename(abs)}: ${out}`);
  }
  // r_frame_rate is a ratio like "30/1" or "30000/1001". Convert to decimal.
  const frRaw = parseStr("r_frame_rate") || "0/1";
  const frParts = frRaw.split("/");
  const fpsNum = parseFloat(frParts[0]) || 0;
  const fpsDen = parseFloat(frParts[1]) || 1;
  const fps = fpsDen ? fpsNum / fpsDen : 0;
  return {
    durationSec,
    width,
    height,
    fps,
    pixFmt: parseStr("pix_fmt"),
    codec: parseStr("codec_name"),
  };
}

/**
 * Helper for the pipeline: write the .ass file to a stable path.
 * Kept here (rather than in caption-ass.ts) so caption-ass stays pure (string
 * in → string out, easy to unit-test).
 */
export async function writeAssFile(assContent: string, outPath: string): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, assContent, "utf-8");
}
