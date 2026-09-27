import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createImageUploadUrl } from "@/lib/storage";
import { uploadRequestSchema } from "@/lib/validation/schemas";

/**
 * Issues a one-time signed upload URL for a validated image type/size. The browser
 * uploads directly to Supabase Storage (bypassing serverless body-size limits);
 * the bucket itself enforces MIME type and size, and the file's real type is
 * re-verified from its bytes before it is ever used.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("upload", user.id);
    const body = await parseJsonBody(request, uploadRequestSchema);
    const upload = await createImageUploadUrl(user.id, body.purpose, body.contentType);
    return NextResponse.json(upload, { status: 201 });
  } catch (error) {
    return jsonError(error, "api.uploads");
  }
}
