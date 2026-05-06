import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import {
  deriveSlugFromTxtPath,
  loadImagesPlan,
  stageImagesToOutput,
  validatePlan,
} from "../src/image/plan.js";

async function main() {
  const txtPath = process.argv[2];
  if (!txtPath) {
    console.error("Usage: npm run images:stage -- <path/to/source.txt>");
    process.exit(2);
  }

  const absTxt = resolve(txtPath);
  if (!existsSync(absTxt)) {
    console.error(`✗ source txt not found: ${absTxt}`);
    process.exit(1);
  }

  const plan = loadImagesPlan(absTxt);
  if (!plan) {
    console.error(`✗ no images-plan.json next to ${absTxt}`);
    console.error(`  Run /images-for-videos first to generate a plan.`);
    process.exit(1);
  }

  const inputDir = dirname(absTxt);
  const slug = deriveSlugFromTxtPath(absTxt);
  const outputDir = resolve("output", slug);

  const { missing, orphans } = validatePlan(plan, inputDir);

  if (missing.length > 0) {
    console.error(`✗ ${missing.length} planned image(s) missing in ${inputDir}:\n`);
    for (const m of missing) {
      const scene = plan.scenes.find((s) => s.id === m.id)!;
      console.error(`  • ${m.filename}  (scene: ${m.id}, template: ${scene.template})`);
      if (scene.subjectHint) {
        console.error(`    subject: ${scene.subjectHint}`);
      }
      console.error(`    prompt:  ${scene.prompt}`);
      console.error("");
    }
    console.error(`Generate the missing image(s) on grok.com and save them at the listed filenames, then re-run.`);
    process.exit(1);
  }

  if (orphans.length > 0) {
    console.warn(`⚠ ${orphans.length} image file(s) in ${inputDir} not referenced by the plan:`);
    for (const f of orphans) console.warn(`  • ${f}`);
    console.warn(`  These won't be used. Delete them or update images-plan.json.\n`);
  }

  const written = await stageImagesToOutput(plan, inputDir, outputDir);
  console.log(`✓ staged ${written.length} image(s) → ${join(outputDir, "images")}`);
  for (const rel of written) console.log(`  ${rel}`);
  console.log(`\nslug:      ${slug}`);
  console.log(`outputDir: ${outputDir}`);
}

main().catch((e) => {
  console.error("✗ unexpected:", e);
  process.exit(1);
});
