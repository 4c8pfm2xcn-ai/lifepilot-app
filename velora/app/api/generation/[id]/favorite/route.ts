import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { loadOwnedGeneration } from "@/lib/generations/access";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, ctx: RouteContext<"/api/generation/[id]/favorite">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    await loadOwnedGeneration(id);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("favorites").upsert(
      { user_id: user.id, generation_id: id },
      { onConflict: "user_id,generation_id", ignoreDuplicates: true },
    );
    if (error) throw new AppError("internal", "Could not save favorite.", { cause: error });
    return NextResponse.json({ favorite: true });
  } catch (error) {
    return jsonError(error, "api.favorite.add");
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/generation/[id]/favorite">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("favorites").delete().eq("generation_id", id);
    if (error) throw new AppError("internal", "Could not remove favorite.", { cause: error });
    return NextResponse.json({ favorite: false });
  } catch (error) {
    return jsonError(error, "api.favorite.remove");
  }
}
