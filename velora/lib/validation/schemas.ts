import { z } from "zod";

import { CAMERA_MOVEMENT_IDS, STYLE_PRESET_IDS } from "@/lib/prompts/directions";
import { findModel, getModeCapabilities, resolveAspectRatio } from "@/lib/video/catalog";

export const uuidSchema = z.uuid();

export const MAX_USER_PROMPT = 1000;
export const MAX_CUSTOM_STYLE = 120;

const stripControl = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

const promptText = (max: number) =>
  z
    .string()
    .transform(stripControl)
    .pipe(z.string().trim().min(3, "Prompt must be at least 3 characters").max(max, `Prompt must be at most ${max} characters`));

/** Storage path of an uploaded input image: "<uuid>/<uuid>.<ext>". Ownership is checked server-side. */
export const inputImagePathSchema = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Invalid image reference");

export const generateRequestSchema = z
  .object({
    provider: z.string().min(1).max(40),
    model: z.string().min(1).max(80),
    prompt: promptText(MAX_USER_PROMPT),
    enhancedPrompt: promptText(MAX_USER_PROMPT).optional(),
    autoEnhance: z.boolean().optional().default(false),
    duration: z.number().int().positive(),
    aspectRatio: z.string().min(3).max(10),
    style: z.enum([...STYLE_PRESET_IDS, "custom"]).nullable().optional(),
    customStyle: z.string().transform(stripControl).pipe(z.string().trim().max(MAX_CUSTOM_STYLE)).nullable().optional(),
    camera: z.enum(CAMERA_MOVEMENT_IDS).nullable().optional(),
    inputImagePath: inputImagePathSchema.nullable().optional(),
    projectId: uuidSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const model = findModel(value.provider, value.model);
    if (!model) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Unsupported provider or model" });
      return;
    }
    const mode = value.inputImagePath ? "image_to_video" : "text_to_video";
    const caps = getModeCapabilities(value.provider, value.model, mode);
    if (!caps) {
      ctx.addIssue({
        code: "custom",
        path: ["inputImagePath"],
        message: `${model.displayName} does not support ${mode === "image_to_video" ? "image-to-video" : "text-to-video"}`,
      });
      return;
    }
    if (!caps.durations.includes(value.duration)) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: `Supported durations for ${model.displayName}: ${caps.durations.join(", ")} seconds`,
      });
    }
    if (!resolveAspectRatio(value.provider, value.model, mode, value.aspectRatio)) {
      ctx.addIssue({
        code: "custom",
        path: ["aspectRatio"],
        message: `Supported aspect ratios: ${caps.aspectRatios.map((r) => r.label).join(", ")}`,
      });
    }
    if (value.style === "custom" && !value.customStyle) {
      ctx.addIssue({ code: "custom", path: ["customStyle"], message: "Describe your custom style" });
    }
  });

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const enhanceRequestSchema = z
  .object({
    prompt: promptText(MAX_USER_PROMPT),
    provider: z.string().min(1).max(40),
    model: z.string().min(1).max(80),
    style: z.enum([...STYLE_PRESET_IDS, "custom"]).nullable().optional(),
    customStyle: z.string().trim().max(MAX_CUSTOM_STYLE).nullable().optional(),
    camera: z.enum(CAMERA_MOVEMENT_IDS).nullable().optional(),
    hasReferenceImage: z.boolean().optional().default(false),
  })
  .strict();

export type EnhanceRequest = z.infer<typeof enhanceRequestSchema>;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export const IMAGE_EXTENSIONS: Record<AllowedImageType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const uploadRequestSchema = z
  .object({
    purpose: z.enum(["input", "cover"]),
    contentType: z.enum(ALLOWED_IMAGE_TYPES),
    size: z.number().int().positive().max(MAX_IMAGE_BYTES, "Images must be 5 MB or smaller"),
    fileName: z.string().max(200).optional(),
  })
  .strict();

export const projectCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    coverPath: z
      .string()
      .regex(/^[0-9a-f-]{36}\/covers\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
      .nullable()
      .optional(),
  })
  .strict();

export const generationUpdateSchema = z
  .object({
    projectId: uuidSchema.nullable(),
  })
  .strict();

export const LIBRARY_PAGE_SIZE = 24;

export const libraryQuerySchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  status: z.enum(["all", "completed", "failed", "active"]).optional().catch("all").default("all"),
  sort: z.enum(["newest", "oldest"]).optional().catch("newest").default("newest"),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(1).default(1),
});

export type LibraryQuery = z.infer<typeof libraryQuerySchema>;

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();

export function formatZodError(error: z.ZodError): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = error.issues[0];
  return { message: first ? first.message : "Invalid request", fields };
}
