/**
 * Minimal structured server logger. Never log secrets or full signed URLs.
 */
function serialize(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.cause ? { cause: error.cause instanceof Error ? error.cause.message : String(error.cause) } : {}),
    };
  }
  return { value: String(error) };
}

export const logger = {
  info(context: string, data?: Record<string, unknown>) {
    console.info(JSON.stringify({ level: "info", context, ...data }));
  },
  warn(context: string, data?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: "warn", context, ...data }));
  },
  error(context: string, error: unknown, data?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: "error", context, error: serialize(error), ...data }));
  },
};
