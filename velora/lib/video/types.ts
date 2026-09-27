/**
 * Provider-agnostic video generation types.
 *
 * These are safe to import from client components: they contain no secrets and
 * describe only capabilities. Provider implementations live in ./providers and
 * are server-only.
 */

export type GenerationMode = "text_to_video" | "image_to_video";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export const TERMINAL_STATUSES: readonly GenerationStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export function isTerminalStatus(status: GenerationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** User-facing aspect ratio label, e.g. "16:9". */
export type AspectRatio = string;

export interface AspectRatioOption {
  /** Label shown in the UI and stored in the database. */
  label: AspectRatio;
  /** Value sent to the provider API (e.g. Runway expects "1280:720"). */
  providerValue: string;
}

export interface ModeCapabilities {
  aspectRatios: readonly AspectRatioOption[];
  /** Durations in seconds that Velora offers for this mode (must be provider-supported). */
  durations: readonly number[];
}

export interface VideoModelDefinition {
  /** Provider-specific model identifier, sent verbatim to the API. */
  id: string;
  displayName: string;
  description: string;
  /** Maximum prompt length the provider accepts (UTF-16 code units). */
  maxPromptLength: number;
  modes: Partial<Record<GenerationMode, ModeCapabilities>>;
  /** Image upload constraints the provider accepts for image-to-video. */
  imageInput?: {
    maxBytes: number;
    mimeTypes: readonly string[];
  };
}

export interface VideoProviderDefinition {
  id: string;
  displayName: string;
  /** Environment variables that must be set for this provider to be available. */
  requiredEnv: readonly string[];
  docsUrl: string;
  supportsWebhooks: boolean;
  /** Minimum seconds between status checks for one task (provider guidance). */
  minPollIntervalSeconds: number;
  models: readonly VideoModelDefinition[];
}

export interface VideoGenerationInput {
  model: string;
  mode: GenerationMode;
  prompt: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  /** HTTPS URL or data URI the provider can fetch for image-to-video. */
  imageUrl?: string;
}

export interface VideoGenerationResult {
  providerTaskId: string;
}

export type ProviderTaskState =
  | { status: "queued" }
  | { status: "processing"; progress: number | null }
  | { status: "completed"; outputUrls: string[] }
  | { status: "failed"; reason: string; code: string | null }
  | { status: "cancelled" };
