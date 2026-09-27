import type {
  ProviderTaskState,
  VideoGenerationInput,
  VideoGenerationResult,
  VideoProviderDefinition,
} from "./types";

/**
 * Contract every video provider implementation must satisfy.
 *
 * Providers are asynchronous-task based: createGeneration() returns quickly with
 * a task id, and getGenerationStatus() is polled (or a webhook delivers updates).
 */
export interface VideoProvider {
  readonly definition: VideoProviderDefinition;
  createGeneration(input: VideoGenerationInput): Promise<VideoGenerationResult>;
  getGenerationStatus(providerTaskId: string): Promise<ProviderTaskState>;
  cancelGeneration?(providerTaskId: string): Promise<void>;
  /**
   * Optional webhook support. Implementations must verify authenticity before
   * returning a parsed event; return null to reject.
   */
  parseWebhook?(request: {
    headers: Headers;
    rawBody: string;
  }): Promise<{ providerTaskId: string; state: ProviderTaskState } | null>;
}

export type ProviderErrorKind =
  | "not_configured"
  | "authentication"
  | "invalid_request"
  | "rate_limited"
  | "insufficient_provider_credits"
  | "unavailable"
  | "network"
  | "timeout"
  | "not_found"
  | "unknown";

/**
 * Normalized provider error. `message` is for server logs; `publicMessage`
 * is safe to show to end users (never contains provider internals or secrets).
 */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly publicMessage: string;
  readonly retryable: boolean;

  constructor(kind: ProviderErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderError";
    this.kind = kind;
    this.publicMessage = PUBLIC_MESSAGES[kind];
    this.retryable = kind === "rate_limited" || kind === "unavailable" || kind === "network" || kind === "timeout";
  }
}

const PUBLIC_MESSAGES: Record<ProviderErrorKind, string> = {
  not_configured: "This video provider is not configured on the server.",
  authentication: "The video provider rejected the server's credentials. An administrator needs to check the API key.",
  invalid_request: "The video provider rejected this request. Try adjusting your prompt, image, or settings.",
  rate_limited: "The video provider is busy right now. Please try again in a minute.",
  insufficient_provider_credits: "The video provider account is out of credits. Please contact the administrator.",
  unavailable: "The video provider is temporarily unavailable. Please try again shortly.",
  network: "Could not reach the video provider. Please try again.",
  timeout: "The video provider took too long to respond. Please try again.",
  not_found: "The provider could not find this generation task.",
  unknown: "The video provider returned an unexpected error.",
};
