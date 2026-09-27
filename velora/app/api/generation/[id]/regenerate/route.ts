import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { loadOwnedGeneration } from "@/lib/generations/access";
import { createGenerationDeps } from "@/lib/generations/deps";
import { readIdempotencyKey } from "@/lib/generations/idempotency";
import { createGeneration, regenerateRequestFrom } from "@/lib/generations/service";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { formatZodError, generateRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

/** Re-runs a generation with identical settings (new task, new charge). */
export async function POST(request: Request, ctx: RouteContext<"/api/generation/[id]/regenerate">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const idempotencyKey = readIdempotencyKey(request);
    await enforceRateLimit("generate", user.id);
    await enforceRateLimit("generateDaily", user.id);
    const { id } = await ctx.params;
    const source = await loadOwnedGeneration(id);

    // Re-validate: model capabilities may have changed since the original generation.
    const parsed = generateRequestSchema.safeParse(regenerateRequestFrom(source));
    if (!parsed.success) {
      const { message } = formatZodError(parsed.error);
      throw new AppError("unsupported_parameter", `These settings are no longer supported: ${message}`);
    }
    const result = await createGeneration(user.id, parsed.data, idempotencyKey, createGenerationDeps());
    return NextResponse.json({ generationId: result.generationId, replayed: result.replayed, balance: result.balance }, { status: 201 });
  } catch (error) {
    return jsonError(error, "api.generation.regenerate");
  }
}
