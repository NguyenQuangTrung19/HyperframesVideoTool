import axios from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import type { ImageProvider, GenerateImageArgs, GenerateResult } from "./provider.js";

const ENDPOINT = "https://api.x.ai/v1/images/generations";
const TIMEOUT_MS = 120_000;

interface XAIResponse {
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
}

export function createXAIImageProvider(opts: {
  apiKey: string;
  model: string;
  resolution: "1k" | "2k";
}): ImageProvider {
  const { apiKey, model, resolution } = opts;

  return {
    name: "xai",
    async generate({ prompt, outPath, aspect = "9:16" }: GenerateImageArgs): Promise<GenerateResult> {
      if (existsSync(outPath)) {
        return { success: true, path: outPath, cached: true };
      }
      try {
        const resp = await axios.post<XAIResponse>(
          ENDPOINT,
          {
            model,
            prompt,
            n: 1,
            aspect_ratio: aspect,
            resolution,
            response_format: "b64_json",
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: TIMEOUT_MS,
            validateStatus: (s) => s < 400,
          },
        );

        const b64 = resp.data.data?.[0]?.b64_json;
        if (!b64) {
          return { success: false, reason: "xAI response missing b64_json" };
        }
        const buf = Buffer.from(b64, "base64");
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, buf);
        return { success: true, path: outPath, cached: false };
      } catch (e: any) {
        const status = e.response?.status;
        const apiError = e.response?.data?.error?.message ?? e.response?.data?.error;
        const reason = apiError
          ? `http ${status}: ${typeof apiError === "string" ? apiError : JSON.stringify(apiError)}`
          : status
            ? `http ${status}`
            : String(e.message ?? e);
        return { success: false, reason };
      }
    },
  };
}
