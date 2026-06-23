/**
 * Render-fidelity check — so sánh preview (index.html seek bằng GSAP timeline)
 * với video.mp4 đã render, tại cùng timestamp (65% mỗi scene, lúc animation
 * đã settle).
 *
 * Với mỗi scene: screenshot preview 1080×1920, trích frame video, ghép
 * side-by-side vào <outputDir>/render-check/compare-<scene>.png, chấm SSIM.
 *
 * Đọc điểm: hiệu ứng wall-clock (Ken Burns CSS, particles, shimmer) lệch pha
 * giữa preview và render nên SSIM thấp trên scene có ảnh nền động là nhiễu
 * bình thường. Chỉ scene < WARN_THRESHOLD mới đáng mở ảnh ghép soi layout.
 */
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const WARN_THRESHOLD = 0.75;
/** Scene có ảnh nền Ken Burns: pha zoom/pan giữa preview và render KHÔNG bao
 *  giờ trùng (wall-clock) nên SSIM thấp là nhiễu — chỉ cảnh báo khi rất thấp. */
export const WARN_THRESHOLD_ANIMATED_BG = 0.4;

export interface FidelityResult {
  id: string;
  layout: string;
  t: number;
  ssim: number | null;
  /** Scene có nền ảnh động (class kb-*) → dùng ngưỡng nới. */
  animatedBg: boolean;
}

function ffmpeg(args: string[]): string {
  const r = spawnSync("ffmpeg", ["-y", "-v", "info", ...args], { encoding: "utf8" });
  if (r.error) throw r.error;
  return (r.stderr ?? "") + (r.stdout ?? "");
}

export async function checkRenderFidelity(outputDir: string): Promise<FidelityResult[]> {
  const indexPath = join(outputDir, "index.html");
  const videoPath = join(outputDir, "video.mp4");
  if (!existsSync(indexPath) || !existsSync(videoPath)) {
    throw new Error(`render-check cần index.html + video.mp4 trong ${outputDir}`);
  }
  const checkDir = join(outputDir, "render-check");
  mkdirSync(checkDir, { recursive: true });

  // Puppeteer là devDependency — import động để module này không kéo nó vào
  // các đường chạy production không cần check.
  const { default: puppeteer } = await import("puppeteer");

  // ── 1. Preview screenshots ────────────────────────────────────────────
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  let scenes: Array<{ id: string; layout: string; t: number; animatedBg: boolean }>;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    await page.goto("file:///" + indexPath.replace(/\\/g, "/"), {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await page.evaluate("document.fonts.ready");

    scenes = await page.evaluate(`
      Array.from(document.querySelectorAll('.scene')).map(el => ({
        id: el.id.replace('scene-', ''),
        layout: el.dataset.layout,
        t: parseFloat(el.dataset.start) + parseFloat(el.dataset.duration) * 0.65,
        animatedBg: !!el.querySelector('.bg[class*="kb-"][style*="background-image"]'),
      }))
    `) as Array<{ id: string; layout: string; t: number; animatedBg: boolean }>;

    for (const s of scenes) {
      await page.evaluate(`(function(){
        var key = Object.keys(window.__timelines)[0];
        var tl = window.__timelines[key];
        tl.pause(); tl.seek(${s.t}, false);
      })()`);
      await new Promise((r) => setTimeout(r, 250));
      await page.screenshot({ path: join(checkDir, `preview-${s.id}.png`) as `${string}.png` });
    }
  } finally {
    await browser.close();
  }

  // ── 2. Video frames + composite + SSIM ────────────────────────────────
  const results: FidelityResult[] = [];
  for (const s of scenes) {
    const prev = join(checkDir, `preview-${s.id}.png`);
    const rend = join(checkDir, `render-${s.id}.png`);
    ffmpeg(["-ss", s.t.toFixed(2), "-i", videoPath, "-frames:v", "1", rend]);

    const ssimOut = ffmpeg([
      "-i", prev, "-i", rend,
      "-lavfi", "[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]ssim",
      "-f", "null", "-",
    ]);
    const m = ssimOut.match(/All:\s*([\d.]+)/);
    const ssim = m ? parseFloat(m[1]) : null;

    ffmpeg([
      "-i", prev, "-i", rend,
      "-filter_complex", "[0:v]scale=540:960[a];[1:v]scale=540:960[b];[a][b]hstack",
      join(checkDir, `compare-${s.id}.png`),
    ]);
    results.push({ id: s.id, layout: s.layout, t: s.t, ssim, animatedBg: s.animatedBg });
  }
  return results;
}

/** In bảng kết quả (xếp scene lệch nhất lên đầu) + cảnh báo dưới ngưỡng. */
export function printFidelityReport(outputDir: string, results: FidelityResult[]): void {
  console.log(`\nRender-fidelity check — ${outputDir}`);
  console.log("scene".padEnd(28) + "layout".padEnd(22) + "t(s)".padEnd(8) + "SSIM");
  const sorted = [...results].sort((a, b) => (a.ssim ?? 0) - (b.ssim ?? 0));
  for (const r of sorted) {
    const threshold = r.animatedBg ? WARN_THRESHOLD_ANIMATED_BG : WARN_THRESHOLD;
    let flag = "";
    if (r.ssim === null) flag = " ??";
    else if (r.ssim < threshold) flag = `  <-- LỆCH, soi render-check/compare-${r.id}.png`;
    else if (r.animatedBg && r.ssim < WARN_THRESHOLD) flag = "  (nhiễu nền động — OK)";
    console.log(
      r.id.padEnd(28) + r.layout.padEnd(22) + r.t.toFixed(1).padEnd(8) + (r.ssim?.toFixed(3) ?? "n/a") + flag,
    );
  }
}
