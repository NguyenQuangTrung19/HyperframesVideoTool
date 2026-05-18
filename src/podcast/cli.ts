#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });

import { runPodcastPipeline } from "./pipeline.js";
import { log } from "../utils/logger.js";

async function main() {
  const txtPath = process.argv[2];
  const musicArg = process.argv[3];
  if (!txtPath) {
    console.error("Usage: npm run podcast -- <path/to/source.txt> [music-file]");
    console.error("  - Place one or more sibling video files next to the .txt: <slug>.{mp4,mov,webm,mkv,m4v}.");
    console.error("    Files are concatenated in natural order; the chain loops if TTS is still longer.");
    console.error("  - Optional music-file overrides assets/beat/input.{m4a,mp3,wav,mp4}.");
    console.error("    Bare filenames resolve against assets/beat/; paths with separators are taken as-is.");
    process.exit(2);
  }
  try {
    await runPodcastPipeline(txtPath, { musicOverride: musicArg });
  } catch (e) {
    log.error("Podcast pipeline failed", e);
    process.exit(1);
  }
}

main();
