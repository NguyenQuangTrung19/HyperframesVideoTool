import axios from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import type { ImageProvider, GenerateImageArgs, GenerateResult } from "./provider.js";

const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 120_000;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export function createGeminiImageProvider(opts: { apiKey: string; model: string }): ImageProvider {
  const { apiKey, model } = opts;

  return {
    name: "gemini",
    async generate({ prompt, outPath, aspect = "9:16" }: GenerateImageArgs): Promise<GenerateResult> {
      if (existsSync(outPath)) {
        return { success: true, path: outPath, cached: true };
      }
      // Aspect ratio is steered via prompt — Gemini has no size parameter.
      // Append an explicit cue unless the prompt already states the orientation.
      const orientation =
        aspect === "16:9"
          ? { keywords: ["16:9", "horizontal", "landscape"], cue: "16:9 horizontal landscape composition" }
          : { keywords: ["9:16", "vertical", "portrait"], cue: "9:16 vertical portrait composition" };
      const promptWithRatio = orientation.keywords.some((k) => prompt.includes(k))
        ? prompt
        : `${prompt}\n\nAspect ratio: ${orientation.cue}.`;
      try {
        const url = `${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
        const resp = await axios.post<GeminiResponse>(
          url,
          {
            contents: [{ parts: [{ text: promptWithRatio }] }],
            generationConfig: {
              responseModalities: ["IMAGE"],
            },
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: TIMEOUT_MS,
            validateStatus: (s) => s < 400,
          },
        );

        const candidate = resp.data.candidates?.[0];
        if (!candidate) {
          const blockReason = resp.data.promptFeedback?.blockReason;
          return {
            success: false,
            reason: blockReason
              ? `Gemini blocked prompt: ${blockReason}`
              : "Gemini response had no candidates",
          };
        }
        const imgPart = candidate.content?.parts?.find((p) => p.inlineData?.data);
        const b64 = imgPart?.inlineData?.data;
        if (!b64) {
          return {
            success: false,
            reason: `Gemini response missing inlineData (finishReason=${candidate.finishReason ?? "unknown"})`,
          };
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
