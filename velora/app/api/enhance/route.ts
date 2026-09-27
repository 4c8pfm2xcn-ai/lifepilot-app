import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getPromptEnhancer } from "@/lib/prompts";
import { CAMERA_MOVEMENTS, STYLE_PRESETS } from "@/lib/prompts/directions";
import { EnhancementError } from "@/lib/prompts/enhancer";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { enhanceRequestSchema } from "@/lib/validation/schemas";
import { findModel } from "@/lib/video/catalog";

export const maxDuration = 60;

/** Room reserved for style/camera instructions appended after enhancement. */
const DIRECTIONS_RESERVE = 250;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("enhance", user.id);
    const body = await parseJsonBody(request, enhanceRequestSchema);

    const enhancer = getPromptEnhancer();
    if (!enhancer) throw new AppError("not_configured", "Prompt enhancement is not configured. Set LLM_API_KEY on the server.");
    const model = findModel(body.provider, body.model);
    if (!model) throw new AppError("unsupported_parameter", "Unsupported model.");

    const styleHint =
      body.style === "custom" ? (body.customStyle ?? null) : body.style ? STYLE_PRESETS[body.style].label : null;
    const cameraHint = body.camera ? CAMERA_MOVEMENTS[body.camera].label : null;

    try {
      const enhancedPrompt = await enhancer.enhance(body.prompt, {
        maxLength: model.maxPromptLength - DIRECTIONS_RESERVE,
        styleHint,
        cameraHint,
        hasReferenceImage: body.hasReferenceImage,
      });
      return NextResponse.json({ enhancedPrompt });
    } catch (error) {
      if (error instanceof EnhancementError) {
        logger.warn("api.enhance", { message: error.message });
        throw new AppError("provider_error", error.publicMessage, { cause: error });
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error, "api.enhance");
  }
}
