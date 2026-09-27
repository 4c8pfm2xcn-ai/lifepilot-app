import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { AppError, type ApiErrorBody } from "@/lib/errors";
import { formatZodError } from "@/lib/validation/schemas";
import { ProviderError } from "@/lib/video/provider";
import { logger } from "@/lib/logger";

export function jsonError(error: unknown, context: string): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    if (error.status >= 500) logger.error(context, error);
    const res = NextResponse.json<ApiErrorBody>(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status },
    );
    if (error.retryAfterSeconds) res.headers.set("Retry-After", String(error.retryAfterSeconds));
    return res;
  }
  if (error instanceof ProviderError) {
    logger.error(context, error);
    const code = error.kind === "not_configured" ? "not_configured" : "provider_error";
    return NextResponse.json<ApiErrorBody>(
      { error: { code, message: error.publicMessage } },
      { status: error.kind === "not_configured" ? 503 : 502 },
    );
  }
  logger.error(context, error);
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "internal", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

const MAX_JSON_BYTES = 32 * 1024;

/** Parses and validates a JSON body with a size cap. Throws AppError on failure. */
export async function parseJsonBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AppError("invalid_request", "Expected a JSON request body.", { status: 415 });
  }
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new AppError("invalid_request", "Request body too large.", { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError("invalid_request", "Malformed JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const { message, fields } = formatZodError(result.error);
    throw new AppError("invalid_request", message, { fields });
  }
  return result.data;
}

/**
 * Rejects cross-site state-changing requests. Browsers always send Origin on
 * POST/PATCH/DELETE fetches; it must match the Host we are served from.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser clients (no ambient cookies) — auth still required.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (host && new URL(origin).host === host) return;
  } catch {
    // fall through
  }
  throw new AppError("forbidden", "Cross-origin request rejected.");
}
