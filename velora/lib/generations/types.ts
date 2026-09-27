import type { GenerationRow } from "@/lib/db/types";
import type { PromptEnhancer } from "@/lib/prompts/enhancer";
import type { AllowedImageType } from "@/lib/validation/schemas";
import type { VideoProvider } from "@/lib/video/provider";
import type { GenerationStatus } from "@/lib/video/types";

export interface CreateWithChargeParams {
  userId: string;
  idempotencyKey: string;
  cost: number;
  provider: string;
  model: string;
  mode: GenerationRow["mode"];
  prompt: string;
  enhancedPrompt: string | null;
  finalPrompt: string;
  style: string | null;
  cameraMovement: string | null;
  inputImagePath: string | null;
  duration: number;
  aspectRatio: string;
  projectId: string | null;
}

export type TransitionPatch = Partial<
  Pick<GenerationRow, "status" | "progress" | "output_video_url" | "error_message" | "completed_at" | "provider_task_id">
>;

/** Persistence operations the generation service needs (service-role backed in production). */
export interface GenerationRepository {
  createWithCharge(params: CreateWithChargeParams): Promise<{ generationId: string; created: boolean; balance: number }>;
  getById(id: string): Promise<GenerationRow | null>;
  /** Updates only while the generation is still active (queued/processing). Returns the new row or null. */
  updateIfActive(id: string, patch: TransitionPatch, leaseSecondsFromNow?: number): Promise<GenerationRow | null>;
  claimSync(id: string, leaseSeconds: number): Promise<GenerationRow | null>;
  releaseLease(id: string, secondsFromNow: number): Promise<void>;
  refund(generationId: string, reason: string): Promise<boolean>;
}

export interface GenerationStorage {
  verifyInputImage(path: string, userId: string): Promise<{ bytes: Uint8Array; contentType: AllowedImageType }>;
  providerImageUrl(path: string, verified: { bytes: Uint8Array; contentType: AllowedImageType }): Promise<string>;
  persistVideo(userId: string, generationId: string, sourceUrl: string): Promise<string>;
}

export interface GenerationDeps {
  repo: GenerationRepository;
  storage: GenerationStorage;
  getProvider(providerId: string): VideoProvider;
  getEnhancer(): PromptEnhancer | null;
  now(): Date;
}

export const GENERATION_LIMITS = {
  /** Mark generations failed (and refund) if still not finished after this long. */
  maxRuntimeMinutes: 30,
  /** A generation with no provider task after this long failed to start. */
  startGraceSeconds: 180,
  /** Lease held while one instance syncs a generation. */
  syncLeaseSeconds: 90,
} as const;

export interface SyncResult {
  row: GenerationRow;
  synced: boolean;
}

export type { GenerationStatus };
