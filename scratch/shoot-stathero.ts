/* Screenshot-only: loads _stathero-preview/index.html and shoots every .frame
   element to <id>.png. Edit index.html directly, then re-run:
   npx tsx scratch/shoot-stathero.ts */
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "_stathero-preview");
mkdirSync(OUT, { recursive: true });

// Ensure the shared placeholder poster exists next to index.html.
if (!existsSync(join(OUT, "poster.jpg"))) {
  copyFileSync(
    join(__dirname, "..", "output", "psg-vo-dich-cl-qua-luan-luu", "images", "dembele-pen.jpg"),
    join(OUT, "poster.jpg"),
  );
}

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 6400, height: 2100, deviceScaleFactor: 1 });
const fileUrl = "file:///" + join(OUT, "index.html").replace(/\\/g, "/");
await page.goto(fileUrl, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500)); // webfonts

const ids: string[] = await page.$$eval(".frame", (els) => els.map((e) => e.id));

// Combined contact sheet — all frames in one row, one image for easy comparison.
await page.screenshot({ path: join(OUT, "contact.png"), fullPage: true });
console.log("wrote contact.png");

await browser.close();
console.log("done:", ids.join(", "));
