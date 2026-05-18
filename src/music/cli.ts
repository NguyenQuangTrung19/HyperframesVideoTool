#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });

import { runMusicPipeline } from "./pipeline.js";
import { log } from "../utils/logger.js";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run music -- <path/to/input/slug-dir>");
    console.error("");
    console.error("Expects this layout (sibling files):");
    console.error("  input/<slug>/<slug>.mp4   ← background video");
    console.error("  input/<slug>/<slug>.mp3   ← song audio");
    console.error("  input/<slug>/<slug>.txt   ← OPTIONAL lyrics (improves alignment)");
    console.error("");
    console.error("You can pass either the directory or any sibling file.");
    process.exit(2);
  }
  try {
    await runMusicPipeline(arg);
  } catch (e) {
    log.error("Music pipeline failed", e);
    process.exit(1);
  }
}

main();
