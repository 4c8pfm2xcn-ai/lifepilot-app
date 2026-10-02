import { expect, test } from "@playwright/test";

const clock = { today: "2026-10-05", now: "2026-10-05T13:00:00.000Z", timezone: "America/New_York", utc_offset_minutes: -240 };

test.describe("AI API routes (offline fallback)", () => {
  test("extract: spec example yields two tasks, no invented dates", async ({ request }) => {
    const res = await request.post("/api/ai/extract", { data: { text: "Remember I have chemistry homework due Thursday and need to call the supplier Friday.", contentType: "text", clock } });
    expect(res.ok()).toBeTruthy();
    const { extraction } = await res.json();
    expect(extraction.items.map((i: { title: string }) => i.title)).toEqual(["Chemistry homework", "Call the supplier"]);
    expect(extraction.items[0].date).toBe("2026-10-08");

    const res2 = await request.post("/api/ai/extract", { data: { text: "Buy batteries", contentType: "text", clock } });
    expect((await res2.json()).extraction.items[0].date).toBeNull();
  });

  test("extract: validates input", async ({ request }) => {
    expect((await request.post("/api/ai/extract", { data: { text: "", clock } })).status()).toBe(400);
    expect((await request.post("/api/ai/extract", { data: { text: "hi" } })).status()).toBe(400);
    const bad = await request.post("/api/ai/extract", { data: { text: "", image: { data: "AAAA", media_type: "application/pdf" }, clock } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toContain("Unsupported image");
  });

  test("assistant: refuses to propose actions on ids that don't exist", async ({ request }) => {
    const res = await request.post("/api/ai/assistant", { data: { message: "what's overdue?", clock, snapshot: { tasks: [] } } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.reply).toContain("Nothing is overdue");
    expect(body.actions).toEqual([]);
  });

  test("status reports configuration without leaking secrets", async ({ request }) => {
    const body = await (await request.get("/api/ai/status")).json();
    expect(Object.keys(body).sort()).toEqual(["ai", "backend", "model"]);
  });
});
