import "server-only";

import { AppError } from "@/lib/errors";
import { getPromptEnhancer } from "@/lib/prompts";
import {
  BUCKETS,
  persistGeneratedVideo,
  providerFetchableImageUrl,
  verifyUploadedImage,
} from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/video/registry";

import type { GenerationDeps, GenerationRepository } from "./types";

/** Service-role repository. Callers must have verified ownership first. */
export function createSupabaseGenerationRepository(): GenerationRepository {
  const db = () => getSupabaseAdmin();

  return {
    async createWithCharge(p) {
      const { data, error } = await db().rpc("create_generation_with_charge", {
        p_user_id: p.userId,
        p_idempotency_key: p.idempotencyKey,
        p_cost: p.cost,
        p_provider: p.provider,
        p_model: p.model,
        p_mode: p.mode,
        p_prompt: p.prompt,
        p_enhanced_prompt: p.enhancedPrompt,
        p_final_prompt: p.finalPrompt,
        p_style: p.style,
        p_camera_movement: p.cameraMovement,
        p_input_image_url: p.inputImagePath,
        p_thumbnail_url: null,
        p_duration: p.duration,
        p_aspect_ratio: p.aspectRatio,
        p_project_id: p.projectId,
      });
      if (error) {
        if (error.code === "VL402") {
          throw new AppError("insufficient_credits", "You don't have enough credits for this generation.");
        }
        if (error.code === "VL404") throw new AppError("not_found", "Project not found.");
        throw new AppError("internal", "Could not create the generation.", { cause: error });
      }
      const row = data?.[0];
      if (!row) throw new AppError("internal", "Could not create the generation.");
      return { generationId: row.generation_id, created: row.created, balance: row.balance };
    },

    async getById(id) {
      const { data, error } = await db().from("generations").select("*").eq("id", id).maybeSingle();
      if (error) throw new AppError("internal", "Could not load the generation.", { cause: error });
      return data;
    },

    async updateIfActive(id, patch, leaseSecondsFromNow) {
      const update = {
        ...patch,
        ...(leaseSecondsFromNow !== undefined
          ? { sync_lease_until: new Date(Date.now() + leaseSecondsFromNow * 1000).toISOString() }
          : { sync_lease_until: null }),
      };
      const { data, error } = await db()
        .from("generations")
        .update(update)
        .eq("id", id)
        .in("status", ["queued", "processing"])
        .select("*")
        .maybeSingle();
      if (error) throw new AppError("internal", "Could not update the generation.", { cause: error });
      return data;
    },

    async claimSync(id, leaseSeconds) {
      const { data, error } = await db().rpc("claim_generation_sync", {
        p_generation_id: id,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new AppError("internal", "Could not sync the generation.", { cause: error });
      return data?.[0] ?? null;
    },

    async releaseLease(id, secondsFromNow) {
      const { error } = await db()
        .from("generations")
        .update({ sync_lease_until: new Date(Date.now() + secondsFromNow * 1000).toISOString() })
        .eq("id", id);
      if (error) throw new AppError("internal", "Could not update the generation.", { cause: error });
    },

    async refund(generationId, reason) {
      const { data, error } = await db().rpc("refund_generation", { p_generation_id: generationId, p_reason: reason });
      if (error) throw new AppError("internal", "Could not refund credits.", { cause: error });
      return data === true;
    },
  };
}

export function createGenerationDeps(): GenerationDeps {
  return {
    repo: createSupabaseGenerationRepository(),
    storage: {
      verifyInputImage: (path, userId) => verifyUploadedImage(BUCKETS.inputImages, path, userId),
      providerImageUrl: (path, verified) => providerFetchableImageUrl(path, verified),
      persistVideo: (userId, generationId, url) => persistGeneratedVideo(userId, generationId, url),
    },
    getProvider,
    getEnhancer: getPromptEnhancer,
    now: () => new Date(),
  };
}
