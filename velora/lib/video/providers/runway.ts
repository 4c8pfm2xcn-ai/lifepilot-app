import "server-only";

import RunwayML from "@runwayml/sdk";
import type { ImageToVideoCreateParams, TextToVideoCreateParams, TaskRetrieveResponse } from "@runwayml/sdk/resources";

import { findProviderDefinition, resolveAspectRatio } from "../catalog";
import { ProviderError, type VideoProvider } from "../provider";
import type { ProviderTaskState, VideoGenerationInput, VideoGenerationResult, VideoProviderDefinition } from "../types";

/**
 * Runway provider, built on the official @runwayml/sdk.
 *
 * API reference (verified against @runwayml/sdk v4.20.1, API version 2024-11-06):
 *   POST   /v1/text_to_video   -> { id }
 *   POST   /v1/image_to_video  -> { id }
 *   GET    /v1/tasks/{id}      -> PENDING | THROTTLED | RUNNING(progress) | SUCCEEDED(output[]) | FAILED(failure, failureCode) | CANCELLED
 *   DELETE /v1/tasks/{id}      -> cancels running/pending tasks (deletes finished ones)
 * Auth: Bearer RUNWAYML_API_SECRET (the SDK also sends X-Runway-Version).
 */

type RunwayClient = Pick<RunwayML, "textToVideo" | "imageToVideo" | "tasks">;

export class RunwayProvider implements VideoProvider {
  readonly definition: VideoProviderDefinition;
  private readonly client: RunwayClient;

  constructor(options: { apiKey: string } | { client: RunwayClient }) {
    const definition = findProviderDefinition("runway");
    if (!definition) throw new Error("Runway provider definition missing from catalog");
    this.definition = definition;
    this.client =
      "client" in options
        ? options.client
        : new RunwayML({ apiKey: options.apiKey, maxRetries: 2, timeout: 30_000 });
  }

  async createGeneration(input: VideoGenerationInput): Promise<VideoGenerationResult> {
    const model = this.definition.models.find((m) => m.id === input.model);
    if (!model) throw new ProviderError("invalid_request", `Unsupported Runway model: ${input.model}`);

    const caps = model.modes[input.mode];
    if (!caps) throw new ProviderError("invalid_request", `Model ${input.model} does not support ${input.mode}`);
    if (!caps.durations.includes(input.durationSeconds)) {
      throw new ProviderError("invalid_request", `Unsupported duration ${input.durationSeconds}s for ${input.model}`);
    }
    const ratio = resolveAspectRatio("runway", input.model, input.mode, input.aspectRatio);
    if (!ratio) throw new ProviderError("invalid_request", `Unsupported aspect ratio ${input.aspectRatio}`);

    try {
      if (input.mode === "image_to_video") {
        if (!input.imageUrl) throw new ProviderError("invalid_request", "image_to_video requires an image");
        const body = buildImageToVideoBody(input.model, input, ratio.providerValue);
        const task = await this.client.imageToVideo.create(body);
        return { providerTaskId: task.id };
      }
      const body = buildTextToVideoBody(input.model, input, ratio.providerValue);
      const task = await this.client.textToVideo.create(body);
      return { providerTaskId: task.id };
    } catch (error) {
      throw normalizeRunwayError(error);
    }
  }

  async getGenerationStatus(providerTaskId: string): Promise<ProviderTaskState> {
    try {
      const task = await this.client.tasks.retrieve(providerTaskId);
      return mapRunwayTask(task);
    } catch (error) {
      throw normalizeRunwayError(error);
    }
  }

  async cancelGeneration(providerTaskId: string): Promise<void> {
    try {
      await this.client.tasks.delete(providerTaskId);
    } catch (error) {
      const normalized = normalizeRunwayError(error);
      if (normalized.kind === "not_found") return;
      throw normalized;
    }
  }
}

function buildTextToVideoBody(model: string, input: VideoGenerationInput, ratio: string): TextToVideoCreateParams {
  switch (model) {
    case "gen4.5":
      return {
        model: "gen4.5",
        promptText: input.prompt,
        ratio: ratio as TextToVideoCreateParams.Gen4_5["ratio"],
        duration: input.durationSeconds,
      };
    case "veo3.1":
      return {
        model: "veo3.1",
        promptText: input.prompt,
        ratio: ratio as TextToVideoCreateParams.Veo3_1["ratio"],
        duration: input.durationSeconds as NonNullable<TextToVideoCreateParams.Veo3_1["duration"]>,
        // Audio affects pricing; Velora does not expose audio yet, so request silent output explicitly.
        audio: false,
      };
    default:
      throw new ProviderError("invalid_request", `No text_to_video mapping for ${model}`);
  }
}

function buildImageToVideoBody(model: string, input: VideoGenerationInput, ratio: string): ImageToVideoCreateParams {
  const promptImage = input.imageUrl as string;
  switch (model) {
    case "gen4.5":
      return {
        model: "gen4.5",
        promptText: input.prompt,
        promptImage,
        ratio: ratio as ImageToVideoCreateParams.Gen4_5["ratio"],
        duration: input.durationSeconds,
      };
    case "veo3.1":
      return {
        model: "veo3.1",
        promptText: input.prompt,
        promptImage,
        ratio: ratio as ImageToVideoCreateParams.Veo3_1["ratio"],
        duration: input.durationSeconds as NonNullable<ImageToVideoCreateParams.Veo3_1["duration"]>,
        audio: false,
      };
    default:
      throw new ProviderError("invalid_request", `No image_to_video mapping for ${model}`);
  }
}

export function mapRunwayTask(task: TaskRetrieveResponse): ProviderTaskState {
  switch (task.status) {
    case "PENDING":
    case "THROTTLED":
      return { status: "queued" };
    case "RUNNING":
      return {
        status: "processing",
        progress: typeof task.progress === "number" && Number.isFinite(task.progress) ? clamp01(task.progress) : null,
      };
    case "SUCCEEDED":
      return { status: "completed", outputUrls: task.output };
    case "FAILED":
      return { status: "failed", reason: task.failure, code: task.failureCode ?? null };
    case "CANCELLED":
      return { status: "cancelled" };
    default: {
      const unknownStatus: never = task;
      throw new ProviderError("unknown", `Unknown Runway task status: ${JSON.stringify(unknownStatus)}`);
    }
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function normalizeRunwayError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof RunwayML.APIConnectionTimeoutError) {
    return new ProviderError("timeout", "Runway request timed out", { cause: error });
  }
  if (error instanceof RunwayML.APIConnectionError) {
    return new ProviderError("network", "Could not connect to Runway", { cause: error });
  }
  if (error instanceof RunwayML.APIError) {
    const status = error.status;
    const detail = `Runway API error ${status ?? "?"}: ${error.message}`;
    if (status === 401 || status === 403) return new ProviderError("authentication", detail, { cause: error });
    if (status === 404) return new ProviderError("not_found", detail, { cause: error });
    if (status === 429) return new ProviderError("rate_limited", detail, { cause: error });
    if (status === 400 || status === 422) {
      const body = typeof error.error === "object" && error.error !== null ? JSON.stringify(error.error) : "";
      if (/credit/i.test(`${error.message} ${body}`)) {
        return new ProviderError("insufficient_provider_credits", detail, { cause: error });
      }
      return new ProviderError("invalid_request", detail, { cause: error });
    }
    if (status !== undefined && status >= 500) return new ProviderError("unavailable", detail, { cause: error });
    return new ProviderError("unknown", detail, { cause: error });
  }
  return new ProviderError("unknown", error instanceof Error ? error.message : String(error), { cause: error });
}
