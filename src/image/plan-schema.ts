import { z } from "zod";

const PlannedScene = z.object({
  /** Stable scene ID — must match the sceneId used in script.json. */
  id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  /** Hyperframes template the scene will use. */
  template: z.enum(["hook", "stat-hero", "callout"]),
  /** Filename (with extension) the user must save in the input folder. */
  filename: z
    .string()
    .min(1)
    .regex(/\.(png|jpg|jpeg|webp)$/i, "filename must end in .png/.jpg/.jpeg/.webp"),
  /** Grok / image-gen prompt (English, sports photography style). */
  prompt: z.string().min(20).max(1500),
  /** Free-text hint for the user (Vietnamese OK) — what's in the image. */
  subjectHint: z.string().max(200).optional(),
});

export const ImagesPlanSchema = z.object({
  version: z.literal("1.0"),
  /** Filename of the source .txt this plan was generated from. */
  source: z.string().min(1),
  /** Content type from classify-football-content. */
  contentType: z.string().min(1),
  /** Working title — informational only. */
  title: z.string().min(1),
  /** ISO timestamp when the plan was generated. */
  createdAt: z.string().min(1),
  scenes: z.array(PlannedScene).min(1).max(20),
});

export type PlannedScene = z.infer<typeof PlannedScene>;
export type ImagesPlan = z.infer<typeof ImagesPlanSchema>;
