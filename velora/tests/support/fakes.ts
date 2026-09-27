import type { GenerationRow } from "@/lib/db/types";
import type { CreateWithChargeParams, GenerationDeps, GenerationRepository, TransitionPatch } from "@/lib/generations/types";
import type { PromptEnhancer } from "@/lib/prompts/enhancer";
import { findProviderDefinition } from "@/lib/video/catalog";
import type { VideoProvider } from "@/lib/video/provider";
import type { ProviderTaskState, VideoGenerationInput } from "@/lib/video/types";

/** In-memory repository mirroring the SQL functions' semantics (for service unit tests). */
export class MemoryRepo implements GenerationRepository {
  rows = new Map<string, GenerationRow>();
  balances = new Map<string, number>();
  charges = new Map<string, number>();
  refunds = new Map<string, string>();
  leases = new Map<string, number>();
  private seq = 0;

  constructor(private readonly clock: () => Date) {}

  async createWithCharge(p: CreateWithChargeParams) {
    const existing = [...this.rows.values()].find((r) => r.user_id === p.userId && r.idempotency_key === p.idempotencyKey);
    const balance = this.balances.get(p.userId) ?? 0;
    if (existing) return { generationId: existing.id, created: false, balance };
    if (balance < p.cost) {
      const { AppError } = await import("@/lib/errors");
      throw new AppError("insufficient_credits", "Not enough credits");
    }
    this.seq += 1;
    const id = `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
    const now = this.clock().toISOString();
    this.rows.set(id, {
      id,
      user_id: p.userId,
      project_id: p.projectId,
      provider: p.provider,
      model: p.model,
      mode: p.mode,
      prompt: p.prompt,
      enhanced_prompt: p.enhancedPrompt,
      final_prompt: p.finalPrompt,
      style: p.style,
      camera_movement: p.cameraMovement,
      input_image_url: p.inputImagePath,
      output_video_url: null,
      thumbnail_url: null,
      duration: p.duration,
      aspect_ratio: p.aspectRatio,
      status: "queued",
      progress: null,
      provider_task_id: null,
      error_message: null,
      credits_charged: p.cost,
      idempotency_key: p.idempotencyKey,
      sync_lease_until: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    });
    this.balances.set(p.userId, balance - p.cost);
    this.charges.set(id, p.cost);
    return { generationId: id, created: true, balance: balance - p.cost };
  }

  async getById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async updateIfActive(id: string, patch: TransitionPatch, leaseSecondsFromNow?: number) {
    const row = this.rows.get(id);
    if (!row || !["queued", "processing"].includes(row.status)) return null;
    // Mirrors the Supabase repository: set the lease, or clear it when omitted.
    if (leaseSecondsFromNow !== undefined) this.leases.set(id, this.clock().getTime() + leaseSecondsFromNow * 1000);
    else this.leases.delete(id);
    const next = { ...row, ...patch };
    this.rows.set(id, next);
    return next;
  }

  async claimSync(id: string) {
    const row = this.rows.get(id);
    if (!row || !["queued", "processing"].includes(row.status)) return null;
    const until = this.leases.get(id) ?? 0;
    if (until > this.clock().getTime()) return null;
    this.leases.set(id, this.clock().getTime() + 90_000);
    return row;
  }

  async releaseLease(id: string, seconds: number) {
    this.leases.set(id, this.clock().getTime() + seconds * 1000);
  }

  async refund(id: string, reason: string) {
    if (this.refunds.has(id)) return false;
    const row = this.rows.get(id);
    const charged = this.charges.get(id);
    if (!row || !charged) return false;
    this.refunds.set(id, reason);
    this.balances.set(row.user_id, (this.balances.get(row.user_id) ?? 0) + charged);
    return true;
  }
}

export class FakeProvider implements VideoProvider {
  readonly definition = findProviderDefinition("runway")!;
  created: VideoGenerationInput[] = [];
  cancelled: string[] = [];
  statusCalls = 0;
  nextState: ProviderTaskState = { status: "queued" };
  createError: Error | null = null;
  statusError: Error | null = null;

  async createGeneration(input: VideoGenerationInput) {
    if (this.createError) throw this.createError;
    this.created.push(input);
    return { providerTaskId: `task_${this.created.length}` };
  }

  async getGenerationStatus() {
    this.statusCalls += 1;
    if (this.statusError) throw this.statusError;
    return this.nextState;
  }

  async cancelGeneration(id: string) {
    this.cancelled.push(id);
  }
}

export function makeDeps(overrides: Partial<{ provider: VideoProvider; enhancer: PromptEnhancer | null; now: Date }> = {}) {
  let now = overrides.now ?? new Date("2026-09-27T12:00:00Z");
  const clock = () => now;
  const repo = new MemoryRepo(clock);
  const provider = (overrides.provider as FakeProvider | undefined) ?? new FakeProvider();
  const persisted: { userId: string; generationId: string; url: string }[] = [];
  const deps: GenerationDeps = {
    repo,
    storage: {
      async verifyInputImage(path, userId) {
        if (!path.startsWith(`${userId}/`)) {
          const { AppError } = await import("@/lib/errors");
          throw new AppError("forbidden", "not yours");
        }
        return { bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" };
      },
      async providerImageUrl(path) {
        return `https://storage.example/${path}?signed`;
      },
      async persistVideo(userId, generationId, url) {
        persisted.push({ userId, generationId, url });
        return `${userId}/${generationId}.mp4`;
      },
    },
    getProvider: () => provider,
    getEnhancer: () => overrides.enhancer ?? null,
    now: clock,
  };
  return {
    deps,
    repo,
    provider: provider as FakeProvider,
    persisted,
    advance(seconds: number) {
      now = new Date(now.getTime() + seconds * 1000);
    },
  };
}
