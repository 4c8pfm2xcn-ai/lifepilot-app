import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { loadOwnedGeneration, publicGeneration } from "@/lib/generations/access";
import { createGenerationDeps } from "@/lib/generations/deps";
import { cancelGeneration } from "@/lib/generations/service";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request, ctx: RouteContext<"/api/generation/[id]/cancel">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const { id } = await ctx.params;
    const row = await loadOwnedGeneration(id);
    const updated = await cancelGeneration(row, createGenerationDeps());
    return NextResponse.json(publicGeneration(updated));
  } catch (error) {
    return jsonError(error, "api.generation.cancel");
  }
}
