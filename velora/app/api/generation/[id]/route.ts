import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { loadOwnedGeneration, publicGeneration } from "@/lib/generations/access";
import { createGenerationDeps } from "@/lib/generations/deps";
import { cancelGeneration, isActive, syncGeneration } from "@/lib/generations/service";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { BUCKETS, createSignedUrl, removeObjects } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generationUpdateSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

/** Status endpoint polled by the client. Syncs with the provider at most once per provider poll interval. */
export async function GET(_request: Request, ctx: RouteContext<"/api/generation/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await enforceRateLimit("status", user.id);
    let row = await loadOwnedGeneration(id);
    if (isActive(row)) {
      row = (await syncGeneration(row, createGenerationDeps())).row;
    }
    const videoUrl =
      row.status === "completed" && row.output_video_url ? await createSignedUrl(BUCKETS.generatedVideos, row.output_video_url) : null;
    return NextResponse.json(publicGeneration(row, { videoUrl }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "api.generation.get");
  }
}

/** Move a generation into (or out of) a project. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/generation/[id]">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    await loadOwnedGeneration(id);
    const body = await parseJsonBody(request, generationUpdateSchema);
    const supabase = await createSupabaseServerClient();
    // RLS + composite FK (project_id, user_id) guarantee the project belongs to this user.
    const { error } = await supabase.from("generations").update({ project_id: body.projectId }).eq("id", id);
    if (error) {
      if (error.code === "23503") throw new AppError("not_found", "Project not found.");
      throw new AppError("internal", "Could not update the generation.", { cause: error });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "api.generation.patch");
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/generation/[id]">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    const row = await loadOwnedGeneration(id);

    if (isActive(row)) {
      // Stop the provider task and refund before deleting.
      await cancelGeneration(row, createGenerationDeps()).catch((e) => logger.warn("generation.delete.cancel", { message: String(e) }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("generations").delete().eq("id", id);
    if (error) throw new AppError("internal", "Could not delete the generation.", { cause: error });

    await removeObjects(BUCKETS.generatedVideos, [row.output_video_url]);
    if (row.input_image_url) {
      // Input images can be shared by regenerations; only remove when unreferenced.
      const { count } = await getSupabaseAdmin()
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("input_image_url", row.input_image_url);
      if (!count) await removeObjects(BUCKETS.inputImages, [row.input_image_url]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "api.generation.delete");
  }
}
