import { spawn } from "node:child_process";
import { log } from "../utils/logger.js";

export interface RenderArgs {
  compositionDir: string;  // path to composition directory
  outputPath: string;      // path for .mp4
  fps?: number;            // default 30
  quality?: "draft" | "standard" | "high"; // default "standard"
  workers?: number | "auto"; // default "auto" (hyperframes calibrates); fixed number overrides
  gpu?: boolean;             // default false; true → NVENC (needs NVIDIA driver >= 570.0)
}

export async function renderWithHyperframes(args: RenderArgs): Promise<void> {
  const {
    compositionDir,
    outputPath,
    fps = 30,
    quality = "standard",
    workers = "auto",
    gpu = false,
  } = args;

  const spawnArgs = [
    "hyperframes",
    "render",
    compositionDir,
    "--output",
    outputPath,
    "--fps",
    String(fps),
    "--quality",
    quality,
  ];
  if (workers !== "auto") {
    spawnArgs.push("--workers", String(workers));
  }
  if (gpu) {
    spawnArgs.push("--gpu");
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("npx", spawnArgs, {
      stdio: ["ignore", "inherit", "inherit"],
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `hyperframes render failed with exit code ${code}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });

  log.info(`Rendered: ${outputPath}`);
}
