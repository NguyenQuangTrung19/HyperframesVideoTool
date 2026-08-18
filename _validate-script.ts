// Pre-flight validate script.json against ScriptSchema before burning TTS quota.
// PHẢI nằm ở repo root: tsx resolve import tương đối theo vị trí file .ts, không theo cwd.
import { readFileSync } from "node:fs";
import { ScriptSchema } from "./src/render/script-schema";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: npx tsx _validate-script.ts <script.json> [...]");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    failed = true;
    console.log(`FAIL ${file}\n  invalid JSON: ${(err as Error).message}`);
    continue;
  }
  const res = ScriptSchema.safeParse(parsed);
  if (res.success) {
    console.log(`OK ${file}`);
  } else {
    failed = true;
    console.log(`FAIL ${file}`);
    for (const issue of res.error.issues) {
      console.log(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
