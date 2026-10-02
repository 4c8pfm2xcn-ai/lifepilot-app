import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function isAIConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
  return client;
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "AIError";
  }
}

type Effort = "low" | "medium" | "high";

/**
 * One structured-output call. The response is constrained to `schema` by the
 * API and parsed/validated by the SDK. Refusals on the primary model are
 * transparently retried on a fallback model server-side (`fallbacks: "default"`).
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[] | string;
  history?: Anthropic.Beta.BetaMessageParam[];
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  try {
    const res = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [...(opts.history ?? []), { role: "user", content: opts.content }],
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    });
    if (res.stop_reason === "refusal") throw new AIError("The AI couldn't help with this request.", 422, false);
    if (res.stop_reason === "max_tokens") throw new AIError("The AI response was cut short. Try a shorter input.", 502, true);
    if (res.parsed_output == null) throw new AIError("The AI returned an unexpected response.", 502, true);
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    throw toAIError(e);
  }
}

export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AIError("AI is misconfigured on the server (check ANTHROPIC_API_KEY).", 500, false);
  if (e instanceof Anthropic.RateLimitError) return new AIError("The AI is busy right now. Please try again in a moment.", 429, true);
  if (e instanceof Anthropic.BadRequestError) return new AIError("The AI couldn't process this input.", 400, false);
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIConnectionError) return new AIError("Couldn't reach the AI service. Check your connection and retry.", 503, true);
  if (e instanceof Anthropic.APIError) return new AIError("The AI service had a problem. Please retry.", 502, true);
  console.error("[ai] unexpected error", e);
  return new AIError("Something went wrong while thinking. Please retry.", 500, true);
}
