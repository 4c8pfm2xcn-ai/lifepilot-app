import "server-only";

/**
 * Best-effort in-memory sliding-window limiter. On serverless platforms each
 * instance keeps its own window, which is still useful to stop runaway loops;
 * put a shared limiter (e.g. Upstash) in front for strict global limits.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}
