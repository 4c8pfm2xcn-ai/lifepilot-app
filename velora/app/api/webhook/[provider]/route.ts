import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { findProviderDefinition } from "@/lib/video/catalog";
import { getProvider } from "@/lib/video/registry";

/**
 * Generic provider webhook endpoint. Only providers that implement verified
 * webhook parsing are accepted. Runway currently has no webhook support, so it
 * uses polling instead and this endpoint returns 404 for it.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/webhook/[provider]">) {
  try {
    const { provider: providerId } = await ctx.params;
    const definition = findProviderDefinition(providerId);
    if (!definition || !definition.supportsWebhooks) throw new AppError("not_found", "Not found.");
    const provider = getProvider(providerId);
    if (!provider.parseWebhook) throw new AppError("not_found", "Not found.");

    const rawBody = await request.text();
    if (rawBody.length > 256 * 1024) throw new AppError("invalid_request", "Payload too large.", { status: 413 });
    const event = await provider.parseWebhook({ headers: request.headers, rawBody });
    if (!event) throw new AppError("unauthorized", "Invalid signature.");

    // When a webhook-capable provider is added, apply `event.state` via the same
    // single-flight transition logic used by syncGeneration().
    logger.info("webhook.received", { provider: providerId, task: event.providerTaskId, status: event.state.status });
    return NextResponse.json({ received: true });
  } catch (error) {
    return jsonError(error, "api.webhook");
  }
}
