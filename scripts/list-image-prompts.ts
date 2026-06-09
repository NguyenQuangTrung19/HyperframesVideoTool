import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ScriptSchema } from "../src/render/script-schema.js";

const IMAGE_TEMPLATES = new Set(["hook", "callout", "stat-hero"]);
const OVERRIDE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

function findOverride(imagesDir: string, sceneId: string): string | null {
  for (const ext of OVERRIDE_EXTS) {
    const p = join(imagesDir, `${sceneId}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function findAiCached(imagesDir: string, sceneId: string): string | null {
  if (!existsSync(imagesDir)) return null;
  const entries = readdirSync(imagesDir);
  const match = entries.find((f) => f.startsWith(`${sceneId}-`) && f.endsWith(".png"));
  return match ? join(imagesDir, match) : null;
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npm run images:list -- <slug>");
    console.error("       (slug is the folder name under video/output/)");
    process.exit(2);
  }

  const outputDir = resolve("video", "output", slug);
  const scriptPath = join(outputDir, "script.json");
  if (!existsSync(scriptPath)) {
    console.error(`✗ not found: ${scriptPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(scriptPath, "utf8"));
  const parsed = ScriptSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("✗ script.json failed schema validation:");
    console.error(parsed.error.message);
    process.exit(1);
  }
  const script = parsed.data;

  const imagesDir = join(outputDir, "images");
  const eligible = script.scenes.filter(
    (s) => s.imagePrompt && IMAGE_TEMPLATES.has(s.templateData.template),
  );

  console.log(`\n=== ${script.metadata.title} ===`);
  console.log(`slug      : ${slug}`);
  console.log(`scenes    : ${script.scenes.length} total, ${eligible.length} with imagePrompt\n`);

  if (eligible.length === 0) {
    console.log("(no scenes have imagePrompt — nothing to override)");
    return;
  }

  eligible.forEach((scene, idx) => {
    const override = findOverride(imagesDir, scene.id);
    const aiCached = findAiCached(imagesDir, scene.id);
    const status = override
      ? `OVERRIDE  ${override}`
      : aiCached
        ? `AI-cached ${aiCached}`
        : `(none yet)`;

    console.log(`[${idx + 1}] ${scene.id}  template=${scene.templateData.template}`);
    console.log(`    status:   ${status}`);
    console.log(`    drop at:  ${join(imagesDir, scene.id + ".png")}`);
    console.log(`    prompt (copy to grok.com):`);
    console.log(`    ─────────────────────────────────────────────`);
    console.log(`    ${scene.imagePrompt!.replace(/\n/g, "\n    ")}`);
    console.log(`    ─────────────────────────────────────────────\n`);
  });

  console.log("Workflow:");
  console.log("  1. Copy a prompt above → paste into grok.com (or any tool)");
  console.log("  2. Generate, download, save as the 'drop at' path (any of .png/.jpg/.jpeg/.webp)");
  console.log("  3. Run: npm run rerender -- <slug>");
  console.log("     → pipeline picks up the override automatically (no API call for that scene)\n");
}

main();
