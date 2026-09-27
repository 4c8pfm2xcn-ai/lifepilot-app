import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { createGenerationDeps } from "@/lib/generations/deps";
import { readIdempotencyKey } from "@/lib/generations/idempotency";
import { createGeneration } from "@/lib/generations/service";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { generateRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const idempotencyKey = readIdempotencyKey(request);
    await enforceRateLimit("generate", user.id);
    await enforceRateLimit("generateDaily", user.id);
    const body = await parseJsonBody(request, generateRequestSchema);

    const result = await createGeneration(user.id, body, idempotencyKey, createGenerationDeps());
    return NextResponse.json(
      { generationId: result.generationId, replayed: result.replayed, balance: result.balance },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    return jsonError(error, "api.generate");
  }
}
