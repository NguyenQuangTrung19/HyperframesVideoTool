// Temp helper: assemble a PRE-MATCH PREVIEW script.json from a hand-written
// _content.json (scene content) + images-plan.json (verbatim imagePrompts).
// Usage: node scripts/_build-preview.mjs <slug>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const slug = process.argv[2];
if (!slug) { console.error("need slug"); process.exit(1); }

const planPath = `video/input/${slug}/images-plan.json`;
const contentPath = `video/output/${slug}/_content.json`;
const outPath = `video/output/${slug}/script.json`;

const plan = JSON.parse(readFileSync(planPath, "utf8"));
const promptById = Object.fromEntries(plan.scenes.map((s) => [s.id, s.prompt]));
const content = JSON.parse(readFileSync(contentPath, "utf8"));

const IMG_TEMPLATES = new Set(["hook", "stat-hero", "callout"]);

const scenes = content.scenes.map((sc) => {
  const out = { id: sc.id, type: sc.type, voiceText: sc.voiceText, templateData: sc.templateData };
  if (IMG_TEMPLATES.has(sc.templateData.template)) {
    const p = promptById[sc.id];
    if (!p) { console.error(`MISSING plan prompt for image scene id=${sc.id}`); process.exit(2); }
    out.imagePrompt = p;
  }
  return out;
});

const script = {
  version: "1.0",
  metadata: {
    title: content.title,
    source: { url: "local", domain: "local", image: null },
    channel: "SportsForAllTV",
  },
  voice: { provider: "ausynclab", voiceId: "1914439", speed: 0.9 },
  scenes,
};

mkdirSync(`video/output/${slug}`, { recursive: true });
writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log(`wrote ${outPath} — ${scenes.length} scenes (img: ${scenes.filter((s) => s.imagePrompt).length})`);
