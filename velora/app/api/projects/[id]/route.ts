import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { BUCKETS, isOwnedPath, removeObjects, verifyUploadedImage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectUpdateSchema, uuidSchema } from "@/lib/validation/schemas";

async function loadOwnedProject(id: string) {
  if (!uuidSchema.safeParse(id).success) throw new AppError("not_found", "Project not found.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new AppError("internal", "Could not load the project.", { cause: error });
  if (!data) throw new AppError("not_found", "Project not found.");
  return data;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    const project = await loadOwnedProject(id);
    const body = await parseJsonBody(request, projectUpdateSchema);

    const update: { name?: string; description?: string | null; cover_url?: string | null } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description || null;
    if (body.coverPath !== undefined) {
      if (body.coverPath) {
        if (!isOwnedPath(body.coverPath, user.id)) throw new AppError("forbidden", "Invalid cover image.");
        await verifyUploadedImage(BUCKETS.thumbnails, body.coverPath, user.id);
      }
      update.cover_url = body.coverPath;
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("projects").update(update).eq("id", id);
    if (error) throw new AppError("internal", "Could not update the project.", { cause: error });
    if (body.coverPath !== undefined && project.cover_url && project.cover_url !== body.coverPath) {
      await removeObjects(BUCKETS.thumbnails, [project.cover_url]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "api.projects.update");
  }
}

/** Deletes a project. Its generations are kept and simply become unassigned. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    const project = await loadOwnedProject(id);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new AppError("internal", "Could not delete the project.", { cause: error });
    await removeObjects(BUCKETS.thumbnails, [project.cover_url]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "api.projects.delete");
  }
}
