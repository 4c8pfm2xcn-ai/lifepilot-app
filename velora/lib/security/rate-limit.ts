import "server-only";

import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Central rate-limit configuration: [max requests, window seconds]. */
export const RATE_LIMITS = {
  generate: [6, 60],
  generateDaily: [60, 86_400],
  enhance: [15, 60],
  upload: [20, 60],
  status: [90, 60],
  mutate: [60, 60],
  auth: [10, 60],
} as const satisfies Record<string, readonly [number, number]>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Postgres-backed fixed-window rate limiter (works across serverless instances).
 * Throws AppError("rate_limited") when the limit is exceeded. Fails open (with
 * a log) if the database is unreachable, so an outage doesn't lock everyone out;
 * expensive operations are still protected by credits.
 */
export async function enforceRateLimit(name: RateLimitName, subject: string): Promise<void> {
  const [limit, windowSeconds] = RATE_LIMITS[name];
  const { data, error } = await getSupabaseAdmin().rpc("check_rate_limit", {
    p_key: `${name}:${subject}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    logger.error("rate-limit", error, { name });
    return;
  }
  if (data === false) {
    throw new AppError("rate_limited", "Too many requests. Please slow down and try again shortly.", {
      retryAfterSeconds: windowSeconds,
    });
  }
}
