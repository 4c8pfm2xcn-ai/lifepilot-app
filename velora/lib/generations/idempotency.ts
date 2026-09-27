import { AppError } from "@/lib/errors";

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/** Reads the client-supplied Idempotency-Key header (one per user intent, e.g. per Generate click). */
export function readIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key");
  if (!key || !KEY_PATTERN.test(key)) {
    throw new AppError("invalid_request", "Missing or invalid Idempotency-Key header.");
  }
  return key;
}
