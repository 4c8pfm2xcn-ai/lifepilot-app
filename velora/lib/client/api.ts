"use client";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;
  constructor(message: string, code: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/** JSON fetch wrapper that surfaces the server's user-safe error messages. */
export async function apiFetch<T>(input: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(input, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiRequestError("Network error. Check your connection and try again.", "network", 0);
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const err = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    throw new ApiRequestError(err?.message ?? `Request failed (${response.status})`, err?.code ?? "unknown", response.status, err?.fields);
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
