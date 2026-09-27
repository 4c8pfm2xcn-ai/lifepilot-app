import RunwayML from "@runwayml/sdk";
import { describe, expect, it, vi } from "vitest";

import { ProviderError } from "@/lib/video/provider";
import { RunwayProvider, mapRunwayTask, normalizeRunwayError } from "@/lib/video/providers/runway";

function fakeClient() {
  return {
    textToVideo: { create: vi.fn(async () => ({ id: "t2v_1", estimatedCost: { credits: 60 } })) },
    imageToVideo: { create: vi.fn(async () => ({ id: "i2v_1", estimatedCost: { credits: 60 } })) },
    tasks: { retrieve: vi.fn(), delete: vi.fn(async () => undefined) },
  };
}

describe("RunwayProvider.createGeneration", () => {
  it("sends a gen4.5 text_to_video request with Runway's ratio format", async () => {
    const client = fakeClient();
    const provider = new RunwayProvider({ client: client as never });
    const res = await provider.createGeneration({
      model: "gen4.5",
      mode: "text_to_video",
      prompt: "A fox",
      durationSeconds: 5,
      aspectRatio: "9:16",
    });
    expect(res.providerTaskId).toBe("t2v_1");
    expect(client.textToVideo.create).toHaveBeenCalledWith({ model: "gen4.5", promptText: "A fox", ratio: "720:1280", duration: 5 });
  });

  it("sends image_to_video with promptImage and extended ratios", async () => {
    const client = fakeClient();
    const provider = new RunwayProvider({ client: client as never });
    await provider.createGeneration({
      model: "gen4.5",
      mode: "image_to_video",
      prompt: "Slow push-in",
      durationSeconds: 10,
      aspectRatio: "1:1",
      imageUrl: "https://example.com/a.png",
    });
    expect(client.imageToVideo.create).toHaveBeenCalledWith({
      model: "gen4.5",
      promptText: "Slow push-in",
      promptImage: "https://example.com/a.png",
      ratio: "960:960",
      duration: 10,
    });
  });

  it("requests silent veo3.1 output with 1080p ratios", async () => {
    const client = fakeClient();
    const provider = new RunwayProvider({ client: client as never });
    await provider.createGeneration({ model: "veo3.1", mode: "text_to_video", prompt: "Rain", durationSeconds: 8, aspectRatio: "16:9" });
    expect(client.textToVideo.create).toHaveBeenCalledWith({ model: "veo3.1", promptText: "Rain", ratio: "1920:1080", duration: 8, audio: false });
  });

  it("refuses unsupported parameters without calling the API", async () => {
    const client = fakeClient();
    const provider = new RunwayProvider({ client: client as never });
    await expect(
      provider.createGeneration({ model: "gen4.5", mode: "text_to_video", prompt: "x", durationSeconds: 15, aspectRatio: "16:9" }),
    ).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(
      provider.createGeneration({ model: "gen4.5", mode: "text_to_video", prompt: "x", durationSeconds: 5, aspectRatio: "1:1" }),
    ).rejects.toMatchObject({ kind: "invalid_request" });
    expect(client.textToVideo.create).not.toHaveBeenCalled();
  });

  it("normalizes API errors into safe provider errors", async () => {
    const client = fakeClient();
    client.textToVideo.create.mockRejectedValueOnce(new RunwayML.AuthenticationError(401, {}, "Invalid API key sk-secret", new Headers()));
    const provider = new RunwayProvider({ client: client as never });
    const err = await provider
      .createGeneration({ model: "gen4.5", mode: "text_to_video", prompt: "x x x", durationSeconds: 5, aspectRatio: "16:9" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe("authentication");
    expect((err as ProviderError).publicMessage).not.toContain("sk-secret");
  });
});

describe("Runway error normalization", () => {
  it.each([
    [new RunwayML.RateLimitError(429, {}, "slow down", new Headers()), "rate_limited", true],
    [new RunwayML.BadRequestError(400, {}, "bad ratio", new Headers()), "invalid_request", false],
    [new RunwayML.BadRequestError(400, { error: "You do not have enough credits to run this task." }, undefined, new Headers()), "insufficient_provider_credits", false],
    [new RunwayML.NotFoundError(404, {}, "missing", new Headers()), "not_found", false],
    [new RunwayML.InternalServerError(503, {}, "down", new Headers()), "unavailable", true],
    [new RunwayML.APIConnectionTimeoutError(), "timeout", true],
    [new RunwayML.APIConnectionError({ message: "ECONNRESET" }), "network", true],
  ])("%s -> %s", (error, kind, retryable) => {
    const n = normalizeRunwayError(error);
    expect(n.kind).toBe(kind);
    expect(n.retryable).toBe(retryable);
  });
});

describe("mapRunwayTask", () => {
  const base = { id: "t", createdAt: "2026-01-01T00:00:00Z" };
  it("maps every Runway status", () => {
    expect(mapRunwayTask({ ...base, status: "PENDING", estimatedCost: { credits: 1 } })).toEqual({ status: "queued" });
    expect(mapRunwayTask({ ...base, status: "THROTTLED", estimatedCost: { credits: 1 } })).toEqual({ status: "queued" });
    expect(mapRunwayTask({ ...base, status: "RUNNING", progress: 0.42, estimatedCost: { credits: 1 } })).toEqual({ status: "processing", progress: 0.42 });
    expect(mapRunwayTask({ ...base, status: "SUCCEEDED", output: ["https://out/1.mp4"], cost: { credits: 1 } })).toEqual({
      status: "completed",
      outputUrls: ["https://out/1.mp4"],
    });
    expect(mapRunwayTask({ ...base, status: "FAILED", failure: "Blocked", failureCode: "SAFETY.INPUT.TEXT", cost: { credits: 0 } })).toEqual({
      status: "failed",
      reason: "Blocked",
      code: "SAFETY.INPUT.TEXT",
    });
    expect(mapRunwayTask({ ...base, status: "CANCELLED", cost: { credits: 0 } })).toEqual({ status: "cancelled" });
  });
});
