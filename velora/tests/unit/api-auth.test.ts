import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route handlers must reject unauthenticated requests before doing any work.
 * The session lookup is mocked to "no user"; everything else is real.
 */
vi.mock("@/lib/auth", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    getSessionUser: vi.fn(async () => null),
    requireUser: vi.fn(async () => {
      throw new AppError("unauthorized", "You need to sign in to do that.");
    }),
  };
});

const GEN_ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: GEN_ID }) } as never;

function post(url: string, body: unknown = {}) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "idempotency-key": "abcdefgh1234" },
    body: JSON.stringify(body),
  });
}

describe("unauthenticated API access", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("POST /api/generate -> 401", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const res = await POST(post("/api/generate", { provider: "runway" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("GET /api/generation/[id] -> 401", async () => {
    const { GET } = await import("@/app/api/generation/[id]/route");
    const res = await GET(new Request(`http://localhost/api/generation/${GEN_ID}`), ctx);
    expect(res.status).toBe(401);
  });

  it("DELETE /api/generation/[id] -> 401", async () => {
    const { DELETE } = await import("@/app/api/generation/[id]/route");
    const res = await DELETE(new Request(`http://localhost/api/generation/${GEN_ID}`, { method: "DELETE", headers: { host: "localhost" } }), ctx);
    expect(res.status).toBe(401);
  });

  it("POST /api/uploads -> 401", async () => {
    const { POST } = await import("@/app/api/uploads/route");
    const res = await POST(post("/api/uploads", { purpose: "input", contentType: "image/png", size: 10 }));
    expect(res.status).toBe(401);
  });

  it("POST /api/enhance -> 401", async () => {
    const { POST } = await import("@/app/api/enhance/route");
    const res = await POST(post("/api/enhance", { prompt: "a fox" }));
    expect(res.status).toBe(401);
  });

  it("GET /api/generation/[id]/download -> 401", async () => {
    const { GET } = await import("@/app/api/generation/[id]/download/route");
    const res = await GET(new Request(`http://localhost/api/generation/${GEN_ID}/download`), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects cross-origin state changes even before auth", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost", origin: "https://evil.example" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("cron sync requires the CRON_SECRET bearer token", async () => {
    process.env.CRON_SECRET = "test-secret-value";
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://localhost/api/cron/sync", { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("webhook endpoint rejects providers without webhook support", async () => {
    const { POST } = await import("@/app/api/webhook/[provider]/route");
    const res = await POST(new Request("http://localhost/api/webhook/runway", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ provider: "runway" }),
    } as never);
    expect(res.status).toBe(404);
  });
});
