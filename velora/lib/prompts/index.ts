import "server-only";

import { serverEnv } from "@/lib/env";

import { AnthropicPromptEnhancer } from "./anthropic";
import type { PromptEnhancer } from "./enhancer";

export interface EnhancerStatus {
  provider: string;
  configured: boolean;
  missingEnv: string[];
}

export function enhancerStatus(): EnhancerStatus {
  const provider = serverEnv.llmProvider();
  const missingEnv = serverEnv.llmApiKey() ? [] : ["LLM_API_KEY"];
  const supported = provider === "anthropic";
  return { provider, configured: supported && missingEnv.length === 0, missingEnv: supported ? missingEnv : ["LLM_PROVIDER (unsupported value)"] };
}

/**
 * Returns the configured enhancer, or null when not configured.
 * Add new LLM backends here (selected by LLM_PROVIDER).
 */
export function getPromptEnhancer(): PromptEnhancer | null {
  const apiKey = serverEnv.llmApiKey();
  if (!apiKey) return null;
  switch (serverEnv.llmProvider()) {
    case "anthropic":
      return new AnthropicPromptEnhancer({ apiKey, model: serverEnv.llmModel() });
    default:
      return null;
  }
}
