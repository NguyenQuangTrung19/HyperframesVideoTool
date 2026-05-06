import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createXAIImageProvider } from "../src/image/xai.js";

const PROMPT = `A dramatic 9:16 vertical sports photograph of a football match: a player
in a red kit celebrating a goal under stadium floodlights, motion blur in
the background, high contrast, photo-realistic, cinematic, shot on a 50mm
lens. Vertical 9:16 portrait composition.`;

async function main() {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("xai-XXXX")) {
    console.error("✗ XAI_API_KEY not set in .env.local (or still placeholder)");
    process.exit(1);
  }
  const model = process.env.XAI_IMAGE_MODEL ?? "grok-imagine-image-quality";
  const rawRes = (process.env.XAI_IMAGE_RESOLUTION ?? "1k").toLowerCase();
  if (rawRes !== "1k" && rawRes !== "2k") {
    console.error(`✗ XAI_IMAGE_RESOLUTION must be "1k" or "2k", got "${rawRes}"`);
    process.exit(1);
  }
  const resolution = rawRes as "1k" | "2k";

  const outDir = resolve("tmp");
  const outPath = resolve(outDir, `xai-test-${Date.now()}.png`);
  await mkdir(outDir, { recursive: true });

  console.log(`→ provider : xai`);
  console.log(`→ model    : ${model}`);
  console.log(`→ res      : ${resolution}`);
  console.log(`→ outPath  : ${outPath}`);
  console.log(`→ calling https://api.x.ai/v1/images/generations ...`);

  const provider = createXAIImageProvider({ apiKey, model, resolution });
  const t0 = Date.now();
  const result = await provider.generate({
    prompt: PROMPT,
    outPath,
    quality: "medium",
  });
  const ms = Date.now() - t0;

  if (!result.success) {
    console.error(`✗ FAILED in ${(ms / 1000).toFixed(1)}s — ${result.reason}`);
    process.exit(1);
  }

  const info = await stat(result.path);
  console.log(`✓ OK in ${(ms / 1000).toFixed(1)}s`);
  console.log(`  file: ${result.path}`);
  console.log(`  size: ${(info.size / 1024).toFixed(1)} KB`);
  console.log(`\nMở file đó xem ảnh có 9:16 và đẹp không.`);
}

main().catch((e) => {
  console.error("✗ unexpected:", e);
  process.exit(1);
});
