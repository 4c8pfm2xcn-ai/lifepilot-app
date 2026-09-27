import { describe, expect, it } from "vitest";

import { generateRequestSchema, libraryQuerySchema, uploadRequestSchema } from "@/lib/validation/schemas";

const USER = "11111111-1111-4111-8111-111111111111";
const valid = {
  provider: "runway",
  model: "gen4.5",
  prompt: "A Lamborghini driving through the mountains",
  duration: 5,
  aspectRatio: "16:9",
};

describe("generateRequestSchema", () => {
  it("accepts a valid text-to-video request", () => {
    expect(generateRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects 15 seconds (not supported by gen4.5)", () => {
    const r = generateRequestSchema.safeParse({ ...valid, duration: 15 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["duration"]);
  });

  it("rejects 1:1 for text-to-video but accepts it for image-to-video on gen4.5", () => {
    expect(generateRequestSchema.safeParse({ ...valid, aspectRatio: "1:1" }).success).toBe(false);
    const withImage = { ...valid, aspectRatio: "1:1", inputImagePath: `${USER}/22222222-2222-4222-8222-222222222222.png` };
    expect(generateRequestSchema.safeParse(withImage).success).toBe(true);
  });

  it("uses veo3.1's own durations", () => {
    expect(generateRequestSchema.safeParse({ ...valid, model: "veo3.1", duration: 5 }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...valid, model: "veo3.1", duration: 8 }).success).toBe(true);
  });

  it("rejects unknown providers and models", () => {
    expect(generateRequestSchema.safeParse({ ...valid, provider: "nope" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...valid, model: "gen99" }).success).toBe(false);
  });

  it("rejects prompts that are too short or too long", () => {
    expect(generateRequestSchema.safeParse({ ...valid, prompt: "a" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...valid, prompt: "x".repeat(1001) }).success).toBe(false);
  });

  it("rejects unexpected fields such as a client-supplied userId", () => {
    expect(generateRequestSchema.safeParse({ ...valid, userId: USER }).success).toBe(false);
  });

  it("rejects path traversal / foreign-looking image paths", () => {
    for (const inputImagePath of ["../etc/passwd", `${USER}/../x.png`, `${USER}/a.gif`, "https://evil.example/x.png"]) {
      expect(generateRequestSchema.safeParse({ ...valid, inputImagePath }).success).toBe(false);
    }
  });

  it("requires text for a custom style", () => {
    expect(generateRequestSchema.safeParse({ ...valid, style: "custom" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...valid, style: "custom", customStyle: "Super 8" }).success).toBe(true);
  });

  it("rejects invalid project ids", () => {
    expect(generateRequestSchema.safeParse({ ...valid, projectId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("uploadRequestSchema", () => {
  it("accepts supported image types under 5 MB", () => {
    expect(uploadRequestSchema.safeParse({ purpose: "input", contentType: "image/webp", size: 1024 }).success).toBe(true);
  });
  it("rejects other types and oversized files", () => {
    expect(uploadRequestSchema.safeParse({ purpose: "input", contentType: "image/gif", size: 1024 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ purpose: "input", contentType: "image/png", size: 6 * 1024 * 1024 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ purpose: "input", contentType: "text/html", size: 10 }).success).toBe(false);
  });
});

describe("libraryQuerySchema", () => {
  it("falls back to safe defaults for garbage input", () => {
    expect(libraryQuerySchema.parse({ status: "evil", sort: "drop", page: "-4" })).toEqual({ q: undefined, status: "all", sort: "newest", page: 1 });
  });
});
