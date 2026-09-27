/**
 * Application error with a user-safe message. Anything not wrapped in AppError
 * is reported to users as a generic error and logged server-side.
 */
export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "invalid_upload"
  | "unsupported_parameter"
  | "insufficient_credits"
  | "rate_limited"
  | "not_configured"
  | "provider_error"
  | "conflict"
  | "internal";

const STATUS: Record<AppErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  invalid_upload: 400,
  unsupported_parameter: 400,
  insufficient_credits: 402,
  rate_limited: 429,
  not_configured: 503,
  provider_error: 502,
  conflict: 409,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { fields?: Record<string, string>; retryAfterSeconds?: number; cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? STATUS[code];
    this.fields = options?.fields;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export interface ApiErrorBody {
  error: { code: AppErrorCode; message: string; fields?: Record<string, string> };
}
