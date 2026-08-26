/**
 * CLI wrapper cho render-fidelity check (logic ở src/render/render-check.ts).
 * Pipeline + rerender đã tự chạy check này sau mỗi lần render — wrapper này
 * chỉ dùng khi muốn check lại thủ công một output cũ.
 *
 * Usage: npm run render:check video/output/<slug>
 */
import { resolve } from "node:path";
import { checkRenderFidelity, printFidelityReport } from "../src/render/render-check.js";

const outputDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("Usage: npm run render:check <outputDir>  (cần index.html + video.mp4)");
  process.exit(2);
}

const results = await checkRenderFidelity(outputDir);
printFidelityReport(outputDir, results);
console.log(`\nẢnh ghép preview|render: ${outputDir}\\render-check\\compare-<scene>.png`);
