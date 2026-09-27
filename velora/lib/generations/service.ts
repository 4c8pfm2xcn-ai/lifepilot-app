import { calculateGenerationCost } from "@/lib/credits/pricing";
import type { GenerationRow } from "@/lib/db/types";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { EnhancementError } from "@/lib/prompts/enhancer";
import { CAMERA_MOVEMENTS, STYLE_PRESETS, composeFinalPrompt, type DirectionOptions } from "@/lib/prompts/directions";
import type { GenerateRequest } from "@/lib/validation/schemas";
import { findModel, getModeCapabilities } from "@/lib/video/catalog";
import { ProviderError } from "@/lib/video/provider";
import { isTerminalStatus, type GenerationMode } from "@/lib/video/types";

import { GENERATION_LIMITS, type GenerationDeps, type SyncResult } from "./types";

// ---------------------------------------------------------------------------
// Style encoding (stored in generations.style)
// ---------------------------------------------------------------------------

export function encodeStyle(style: GenerateRequest["style"], customStyle?: string | null): string | null {
  if (!style) return null;
  if (style === "custom") return customStyle ? `custom:${customStyle}` : null;
  return style;
}

export function decodeStyle(stored: string | null): Pick<DirectionOptions, "style" | "customStyle"> {
  if (!stored) return { style: null, customStyle: null };
  if (stored.startsWith("custom:")) return { style: "custom", customStyle: stored.slice("custom:".length) };
  if (stored in STYLE_PRESETS) return { style: stored as keyof typeof STYLE_PRESETS, customStyle: null };
  return { style: null, customStyle: null };
}

export function styleLabel(stored: string | null): string | null {
  const { style, customStyle } = decodeStyle(stored);
  if (style === "custom") return customStyle ?? null;
  return style ? STYLE_PRESETS[style].label : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateGenerationResult {
  generationId: string;
  replayed: boolean;
  balance: number;
}

export async function createGeneration(
  userId: string,
  request: GenerateRequest,
  idempotencyKey: string,
  deps: GenerationDeps,
): Promise<CreateGenerationResult> {
  const model = findModel(request.provider, request.model);
  const mode: GenerationMode = request.inputImagePath ? "image_to_video" : "text_to_video";
  const caps = getModeCapabilities(request.provider, request.model, mode);
  if (!model || !caps) throw new AppError("unsupported_parameter", "That model does not support this kind of generation.");

  // Resolve the provider first: an unconfigured provider must fail before any charge.
  const provider = deps.getProvider(request.provider);

  let imageUrl: string | undefined;
  if (request.inputImagePath) {
    const verified = await deps.storage.verifyInputImage(request.inputImagePath, userId);
    imageUrl = await deps.storage.providerImageUrl(request.inputImagePath, verified);
  }

  const directions: DirectionOptions = {
    style: request.style ?? null,
    customStyle: request.customStyle ?? null,
    camera: request.camera ?? null,
  };

  let enhancedPrompt: string | null = request.enhancedPrompt ?? null;
  if (!enhancedPrompt && request.autoEnhance) {
    const enhancer = deps.getEnhancer();
    if (enhancer) {
      try {
        enhancedPrompt = await enhancer.enhance(request.prompt, {
          maxLength: model.maxPromptLength - 250,
          styleHint: directionsHint(directions).style,
          cameraHint: directionsHint(directions).camera,
          hasReferenceImage: Boolean(imageUrl),
        });
      } catch (error) {
        // Enhancement is best-effort: fall back to the user's own prompt.
        logger.warn("generation.autoEnhance", { message: error instanceof EnhancementError ? error.message : String(error) });
      }
    }
  }

  const finalPrompt = composeFinalPrompt(enhancedPrompt ?? request.prompt, directions);
  if (finalPrompt.length > model.maxPromptLength) {
    throw new AppError(
      "unsupported_parameter",
      `${model.displayName} accepts prompts up to ${model.maxPromptLength} characters including style and camera directions (currently ${finalPrompt.length}). Please shorten your prompt.`,
      { fields: { prompt: "Prompt too long for this model" } },
    );
  }

  const cost = calculateGenerationCost(request.provider, request.model, request.duration);

  const charge = await deps.repo.createWithCharge({
    userId,
    idempotencyKey,
    cost,
    provider: request.provider,
    model: request.model,
    mode,
    prompt: request.prompt,
    enhancedPrompt,
    finalPrompt,
    style: encodeStyle(request.style, request.customStyle),
    cameraMovement: request.camera ?? null,
    inputImagePath: request.inputImagePath ?? null,
    duration: request.duration,
    aspectRatio: request.aspectRatio,
    projectId: request.projectId ?? null,
  });

  if (!charge.created) {
    // Idempotent replay (double-click, retry): never charge or submit twice.
    return { generationId: charge.generationId, replayed: true, balance: charge.balance };
  }

  let providerTaskId: string;
  try {
    ({ providerTaskId } = await provider.createGeneration({
      model: request.model,
      mode,
      prompt: finalPrompt,
      durationSeconds: request.duration,
      aspectRatio: request.aspectRatio,
      imageUrl,
    }));
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : new ProviderError("unknown", String(error), { cause: error });
    logger.error("generation.create.provider", providerError, { generationId: charge.generationId, kind: providerError.kind });
    await deps.repo.updateIfActive(charge.generationId, {
      status: "failed",
      error_message: providerError.publicMessage,
      completed_at: deps.now().toISOString(),
    });
    await deps.repo.refund(charge.generationId, "Refund: provider rejected the generation request");
    throw new AppError("provider_error", `${providerError.publicMessage} Your credits have been refunded.`, {
      cause: providerError,
      status: providerError.kind === "not_configured" ? 503 : 502,
    });
  }

  try {
    await deps.repo.updateIfActive(charge.generationId, { provider_task_id: providerTaskId });
  } catch (error) {
    // The provider accepted the job but we couldn't record it. Stop the job so it
    // isn't billed by the provider, then fail and refund the generation.
    logger.error("generation.create.record", error, { generationId: charge.generationId });
    if (provider.cancelGeneration) {
      await provider.cancelGeneration(providerTaskId).catch((e) => logger.warn("generation.create.cancel", { message: String(e) }));
    }
    await deps.repo
      .updateIfActive(charge.generationId, {
        status: "failed",
        error_message: "The generation could not be started. Your credits have been refunded.",
        completed_at: deps.now().toISOString(),
      })
      .catch((e) => logger.warn("generation.create.markFailed", { message: String(e) }));
    await deps.repo.refund(charge.generationId, "Refund: generation could not be recorded");
    throw new AppError("internal", "The generation could not be started. Your credits have been refunded.", { cause: error });
  }

  return { generationId: charge.generationId, replayed: false, balance: charge.balance };
}

function directionsHint(d: DirectionOptions): { style: string | null; camera: string | null } {
  const style = d.style === "custom" ? (d.customStyle ?? null) : d.style ? STYLE_PRESETS[d.style].label : null;
  const camera = d.camera ? CAMERA_MOVEMENTS[d.camera].label : null;
  return { style, camera };
}

// ---------------------------------------------------------------------------
// Status sync
// ---------------------------------------------------------------------------

const FAILURE_MESSAGES: Record<string, string> = {
  SAFETY: "The provider's content moderation blocked this generation. Try a different prompt or image.",
  INPUT_PREPROCESSING: "The provider could not process the input. Try a different image or prompt.",
  INTERNAL: "The provider hit an internal error while generating this video.",
};

export function publicFailureMessage(code: string | null): string {
  if (code) {
    for (const [prefix, message] of Object.entries(FAILURE_MESSAGES)) {
      if (code.toUpperCase().startsWith(prefix)) return message;
    }
  }
  return "The provider could not generate this video.";
}

/**
 * Brings a generation's status up to date with the provider. Single-flight via a
 * DB lease, rate-limited to the provider's minimum poll interval, idempotent.
 */
export async function syncGeneration(row: GenerationRow, deps: GenerationDeps): Promise<SyncResult> {
  if (isTerminalStatus(row.status)) return { row, synced: false };

  const claimed = await deps.repo.claimSync(row.id, GENERATION_LIMITS.syncLeaseSeconds);
  if (!claimed) return { row, synced: false };

  const provider = deps.getProvider(claimed.provider);
  const minPoll = provider.definition.minPollIntervalSeconds;
  const now = deps.now();
  const ageSeconds = (now.getTime() - new Date(claimed.created_at).getTime()) / 1000;

  const fail = async (message: string, reason: string): Promise<SyncResult> => {
    const updated = await deps.repo.updateIfActive(claimed.id, {
      status: "failed",
      error_message: message,
      completed_at: now.toISOString(),
    });
    if (updated) await deps.repo.refund(claimed.id, reason);
    return { row: updated ?? (await deps.repo.getById(claimed.id)) ?? claimed, synced: true };
  };

  try {
    if (!claimed.provider_task_id) {
      if (ageSeconds > GENERATION_LIMITS.startGraceSeconds) {
        return await fail("The generation could not be started. Your credits have been refunded.", "Refund: generation never started");
      }
      await deps.repo.releaseLease(claimed.id, minPoll);
      return { row: claimed, synced: false };
    }

    if (ageSeconds > GENERATION_LIMITS.maxRuntimeMinutes * 60) {
      if (provider.cancelGeneration) {
        await provider.cancelGeneration(claimed.provider_task_id).catch((e) => logger.warn("generation.timeout.cancel", { message: String(e) }));
      }
      return await fail("The generation timed out. Your credits have been refunded.", "Refund: generation timed out");
    }

    const state = await provider.getGenerationStatus(claimed.provider_task_id);
    switch (state.status) {
      case "queued": {
        const updated = await deps.repo.updateIfActive(claimed.id, { status: "queued" }, minPoll);
        return { row: updated ?? claimed, synced: true };
      }
      case "processing": {
        const updated = await deps.repo.updateIfActive(
          claimed.id,
          { status: "processing", progress: state.progress ?? claimed.progress },
          minPoll,
        );
        return { row: updated ?? claimed, synced: true };
      }
      case "completed": {
        const source = state.outputUrls[0];
        if (!source) return await fail("The provider finished without returning a video.", "Refund: provider returned no output");
        const path = await deps.storage.persistVideo(claimed.user_id, claimed.id, source);
        const updated = await deps.repo.updateIfActive(claimed.id, {
          status: "completed",
          progress: 1,
          output_video_url: path,
          error_message: null,
          completed_at: now.toISOString(),
        });
        return { row: updated ?? (await deps.repo.getById(claimed.id)) ?? claimed, synced: true };
      }
      case "failed": {
        logger.warn("generation.provider.failed", { generationId: claimed.id, code: state.code, reason: state.reason });
        return await fail(`${publicFailureMessage(state.code)} Your credits have been refunded.`, "Refund: provider generation failed");
      }
      case "cancelled": {
        const updated = await deps.repo.updateIfActive(claimed.id, { status: "cancelled", completed_at: now.toISOString() });
        if (updated) await deps.repo.refund(claimed.id, "Refund: generation cancelled");
        return { row: updated ?? claimed, synced: true };
      }
    }
  } catch (error) {
    if (error instanceof ProviderError && error.kind === "not_found") {
      return await fail("The provider no longer has this generation. Your credits have been refunded.", "Refund: provider task missing");
    }
    logger.error("generation.sync", error, { generationId: claimed.id });
    // Back off a little more than usual after an error.
    await deps.repo.releaseLease(claimed.id, minPoll * 3);
    return { row: claimed, synced: false };
  }
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelGeneration(row: GenerationRow, deps: GenerationDeps): Promise<GenerationRow> {
  if (isTerminalStatus(row.status)) {
    throw new AppError("conflict", "This generation has already finished.");
  }
  if (row.provider_task_id) {
    const provider = deps.getProvider(row.provider);
    if (provider.cancelGeneration) await provider.cancelGeneration(row.provider_task_id);
  }
  const updated = await deps.repo.updateIfActive(row.id, { status: "cancelled", completed_at: deps.now().toISOString() });
  if (updated) {
    await deps.repo.refund(row.id, "Refund: cancelled by user");
    return updated;
  }
  // Lost a race with completion — return whatever the row is now.
  return (await deps.repo.getById(row.id)) ?? row;
}

// ---------------------------------------------------------------------------
// Regenerate
// ---------------------------------------------------------------------------

export function regenerateRequestFrom(row: GenerationRow): GenerateRequest {
  const { style, customStyle } = decodeStyle(row.style);
  return {
    provider: row.provider,
    model: row.model,
    prompt: row.prompt,
    enhancedPrompt: row.enhanced_prompt ?? undefined,
    autoEnhance: false,
    duration: row.duration,
    aspectRatio: row.aspect_ratio,
    style: style ?? null,
    customStyle: customStyle ?? null,
    camera: (row.camera_movement as GenerateRequest["camera"]) ?? null,
    inputImagePath: row.input_image_url ?? null,
    projectId: row.project_id ?? null,
  };
}

export function isActive(row: Pick<GenerationRow, "status">): boolean {
  return !isTerminalStatus(row.status);
}
