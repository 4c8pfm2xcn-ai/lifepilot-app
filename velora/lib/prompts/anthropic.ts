import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  ENHANCER_SYSTEM_PROMPT,
  EnhancementError,
  buildEnhancerUserMessage,
  sanitizeEnhancedPrompt,
  type EnhancementContext,
  type PromptEnhancer,
} from "./enhancer";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";

/** Prompt enhancer backed by the Claude API (official @anthropic-ai/sdk). */
export class AnthropicPromptEnhancer implements PromptEnhancer {
  readonly id = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 45_000 });
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
  }

  async enhance(prompt: string, context: EnhancementContext): Promise<string> {
    let response;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 4000,
        // A short rewrite does not need deep reasoning; keep latency low.
        output_config: { effort: "low" },
        // Server-side fallback: if the primary model declines, the API retries on a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: ENHANCER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildEnhancerUserMessage(prompt, context) }],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new EnhancementError("LLM authentication failed", "Prompt enhancement is misconfigured on the server.", { cause: error });
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new EnhancementError("LLM rate limited", "Prompt enhancement is busy. Try again in a moment.", { cause: error });
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new EnhancementError("LLM connection error", undefined, { cause: error });
      }
      throw new EnhancementError(error instanceof Error ? error.message : "LLM request failed", undefined, { cause: error });
    }

    if (response.stop_reason === "refusal") {
      throw new EnhancementError("LLM declined the request", "This prompt could not be enhanced. Try rephrasing it.");
    }
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    const cleaned = sanitizeEnhancedPrompt(text, context.maxLength);
    if (cleaned.length < 3) throw new EnhancementError("LLM returned an empty prompt");
    return cleaned;
  }
}
