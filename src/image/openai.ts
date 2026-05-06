import axios from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import type { ImageProvider, GenerateImageArgs, GenerateResult } from "./provider.js";

const ENDPOINT = "https://api.openai.com/v1/images/generations";
const SIZE_VERTICAL_9_16 = "1024x1536";
const TIMEOUT_MS = 120_000;

interface OpenAIResponse {
  created: number;
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
}

export function createOpenAIImageProvider(opts: { apiKey: string; model: string }): ImageProvider {
  const { apiKey, model } = opts;

  return {
    name: "openai",
    async generate({ prompt, outPath, quality }: GenerateImageArgs): Promise<GenerateResult> {
      if (existsSync(outPath)) {
        return { success: true, path: outPath, cached: true };
      }
      try {
        const resp = await axios.post<OpenAIResponse>(
          ENDPOINT,
          {
            model,
            prompt,
            n: 1,
            size: SIZE_VERTICAL_9_16,
            quality,
            output_format: "png",
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
          return { success: false, reason: "OpenAI response missing b64_json" };
        }
        const buf = Buffer.from(b64, "base64");
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, buf);
        return { success: true, path: outPath, cached: false };
      } catch (e: any) {
        const status = e.response?.status;
        const apiError = e.response?.data?.error?.message;
        const reason = apiError
          ? `http ${status}: ${apiError}`
          : status
            ? `http ${status}`
            : String(e.message ?? e);
        return { success: false, reason };
      }
    },
  };
}
