import { z } from "zod";

const PlannedScene = z.object({
  /** Stable scene ID — must match the sceneId used in script.json. */
  id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  /** Hyperframes template the scene will use. feature-list added 2026-07-04 —
   *  it takes an OPTIONAL supporting image (laid out by aspect). */
  template: z.enum(["hook", "stat-hero", "callout", "feature-list"]),
  /** Filename (with extension) the user must save in the input folder. */
  filename: z
    .string()
    .min(1)
    .regex(/\.(png|jpg|jpeg|webp)$/i, "filename must end in .png/.jpg/.jpeg/.webp"),
  /**
   * Optional legacy Grok / image-gen prompt (English). No longer authored by
   * /images-for-videos — image descriptions now live only in subjectHint +
   * anh-can-tao.md, and the user generates images freehand from those. Kept
   * optional so older plans that still carry a prompt continue to validate.
   */
  prompt: z.string().min(20).max(1500).optional(),
  /** Hint for the user (Vietnamese OK) — who/what is in the image. The sole
   *  description now: names subject + key trait/rating; used in anh-can-tao.md. */
  subjectHint: z.string().max(200).optional(),
  /**
   * 16:9 roundup only. Literal corner chip for this scene ("TIN 3/7"), copied
   * to `scene.marker`. Every scene belonging to the same news item carries the
   * same marker, which is why the auto N/total counter can't do this job.
   */
  marker: z.string().min(1).max(16).optional(),
});

export const ImagesPlanSchema = z.object({
  version: z.literal("1.0"),
  /**
   * Canvas the video will be rendered at, and therefore the orientation the
   * planned images must be generated in. This is how `/create-video` learns to
   * emit `metadata.aspect: "16:9"` — the plan is the contract between the
   * planning skill and the scripting skill. Omitted → "9:16".
   */
  aspect: z.enum(["9:16", "16:9"]).default("9:16"),
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
