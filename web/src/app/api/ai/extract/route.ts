import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AIError, isAIConfigured } from "@/lib/ai/anthropic";
import { jsonError, readJson, resolveRequest } from "@/lib/ai/context";
import { aiExtract } from "@/lib/ai/features";
import { heuristicExtract } from "@/lib/ai/heuristic-extract";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/config";
import { CONTENT_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().max(20000).default(""),
  contentType: z.enum(CONTENT_TYPES).default("text"),
  image: z
    .object({ data: z.string().max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 16), media_type: z.enum(ACCEPTED_IMAGE_TYPES) })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const raw = await readJson(req);
  if (!raw) return jsonError("Invalid JSON body.", 400);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const imgIssue = parsed.error.issues.some((i) => i.path[0] === "image");
    return jsonError(imgIssue ? "Unsupported image. Use PNG, JPEG, WebP or GIF up to 5 MB." : "Invalid capture.", 400);
  }
  const { text, contentType, image } = parsed.data;
  if (!text.trim() && !image) return jsonError("Nothing to process.", 400);

  const ctx = await resolveRequest(req, raw);
  if (!ctx.ok) return ctx.response;
  const useAI = isAIConfigured() && ctx.snapshot.preferences.ai_enabled;

  if (!useAI) {
    if (image && !text.trim()) {
      return NextResponse.json({
        extraction: {
          summary: "Image saved. Reading screenshots needs the AI model.",
          items: [],
          source: "heuristic",
          notice: isAIConfigured() ? "AI is turned off in your settings, so images can't be read. Add the details manually." : "Screenshot understanding requires an Anthropic API key on the server. Add the details manually below.",
          processed_at: new Date().toISOString(),
        },
      });
    }
    return NextResponse.json({ extraction: heuristicExtract(text, { today: ctx.clock.today }) });
  }

  try {
    const extraction = await aiExtract({ text, image: image ?? null, contentType, clock: ctx.clock });
    return NextResponse.json({ extraction });
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError("AI processing failed.");
    if (!image && text.trim()) {
      const fallback = heuristicExtract(text, { today: ctx.clock.today });
      fallback.notice = `AI unavailable (${err.message}) — organized on-device instead.`;
      return NextResponse.json({ extraction: fallback });
    }
    return jsonError(err.message, err.status, { retryable: err.retryable });
  }
}
