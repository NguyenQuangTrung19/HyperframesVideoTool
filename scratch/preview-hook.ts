/* One-off: render the real hook frame (real styles.css + animations.js) and screenshot it. */
import { composeHtml } from "../src/render/html-composer.js";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL = join(__dirname, "../src/render/templates");
const OUT = join(__dirname, "_hook-preview");
mkdirSync(OUT, { recursive: true });

const script: any = {
  version: "1.0",
  metadata: { title: "preview", source: { url: "", domain: "", image: null }, channel: "SportsForAllTV" },
  voice: { provider: "ausynclab", voiceId: "x", speed: 1 },
  scenes: [
    { id: "hook", type: "hook", voiceText: "x", templateData: {
      template: "hook", eyebrow: "Ngoại hạng Anh", eyebrowSub: "Vòng 32",
      bigStat: "0-4", headline: "Man City sụp đổ", kenBurns: "impact-zoom" } },
    { id: "outro", type: "outro", voiceText: "x", templateData: {
      template: "outro", ctaTop: "Theo dõi ngay", channelName: "SportsForAllTV", source: "goal.com" } },
  ],
};
const sceneAudio = [{ id: "hook", durationSec: 4 }, { id: "outro", durationSec: 3 }];
const html = composeHtml({ script, sceneAudio, gapSec: 0.3, sceneImages: {}, audioRelPath: "voice.mp3" });
writeFileSync(join(OUT, "index.html"), html);
copyFileSync(join(TPL, "styles.css"), join(OUT, "styles.css"));
copyFileSync(join(TPL, "animations.js"), join(OUT, "animations.js"));

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
const fileUrl = "file:///" + join(OUT, "index.html").replace(/\\/g, "/");
await page.goto(fileUrl, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1200)); // fonts + gsap
await page.evaluate(() => { (window as any).__timelines["news-video"].seek(2.9); });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: join(OUT, "hook.png") });
await browser.close();
console.log("wrote", join(OUT, "hook.png"));
