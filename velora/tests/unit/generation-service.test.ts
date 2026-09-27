import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { cancelGeneration, createGeneration, regenerateRequestFrom, syncGeneration } from "@/lib/generations/service";
import type { GenerateRequest } from "@/lib/validation/schemas";
import { ProviderError } from "@/lib/video/provider";

import { FakeProvider, makeDeps } from "../support/fakes";

const USER = "11111111-1111-4111-8111-111111111111";
const request: GenerateRequest = {
  provider: "runway",
  model: "gen4.5",
  prompt: "A Lamborghini driving through the mountains",
  autoEnhance: false,
  duration: 5,
  aspectRatio: "16:9",
  style: "cinematic",
  camera: "tracking",
};

function setup(balance = 100) {
  const ctx = makeDeps();
  ctx.repo.balances.set(USER, balance);
  return ctx;
}

describe("createGeneration", () => {
  it("charges credits, stores the generation and submits the task", async () => {
    const { deps, repo, provider } = setup();
    const res = await createGeneration(USER, request, "key-00000001", deps);
    expect(res.replayed).toBe(false);
    expect(repo.balances.get(USER)).toBe(75);
    const row = repo.rows.get(res.generationId)!;
    expect(row.provider_task_id).toBe("task_1");
    expect(row.final_prompt).toContain("A Lamborghini driving through the mountains.");
    expect(row.final_prompt).toContain("Cinematic look");
    expect(provider.created[0]).toMatchObject({ model: "gen4.5", mode: "text_to_video", durationSeconds: 5, aspectRatio: "16:9" });
  });

  it("does not double charge or double submit on replay", async () => {
    const { deps, repo, provider } = setup();
    const a = await createGeneration(USER, request, "key-00000002", deps);
    const b = await createGeneration(USER, request, "key-00000002", deps);
    expect(b.replayed).toBe(true);
    expect(b.generationId).toBe(a.generationId);
    expect(repo.balances.get(USER)).toBe(75);
    expect(provider.created).toHaveLength(1);
  });

  it("rejects when credits are insufficient, without calling the provider", async () => {
    const { deps, provider } = setup(10);
    await expect(createGeneration(USER, request, "key-00000003", deps)).rejects.toMatchObject({ code: "insufficient_credits" });
    expect(provider.created).toHaveLength(0);
  });

  it("refunds and marks failed when the provider rejects the request", async () => {
    const { deps, repo, provider } = setup();
    provider.createError = new ProviderError("invalid_request", "bad");
    const err = await createGeneration(USER, request, "key-00000004", deps).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("provider_error");
    const row = [...repo.rows.values()][0]!;
    expect(row.status).toBe("failed");
    expect(repo.balances.get(USER)).toBe(100);
    expect(repo.refunds.size).toBe(1);
  });

  it("fails before charging when the provider is not configured", async () => {
    const { deps, repo } = setup();
    deps.getProvider = () => {
      throw new ProviderError("not_configured", "RUNWAYML_API_SECRET missing");
    };
    await expect(createGeneration(USER, request, "key-00000005", deps)).rejects.toBeInstanceOf(ProviderError);
    expect(repo.rows.size).toBe(0);
    expect(repo.balances.get(USER)).toBe(100);
  });

  it("rejects prompts that exceed the model limit once directions are added", async () => {
    const { deps, repo } = setup();
    const long = { ...request, prompt: "word ".repeat(199).trim() };
    await expect(createGeneration(USER, long, "key-00000006", deps)).rejects.toMatchObject({ code: "unsupported_parameter" });
    expect(repo.rows.size).toBe(0);
  });

  it("rejects another user's uploaded image", async () => {
    const { deps, repo } = setup();
    const other = "22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png";
    await expect(createGeneration(USER, { ...request, inputImagePath: other }, "key-00000007", deps)).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.rows.size).toBe(0);
  });

  it("passes a fetchable image URL for image-to-video", async () => {
    const { deps, provider } = setup();
    const path = `${USER}/33333333-3333-4333-8333-333333333333.png`;
    await createGeneration(USER, { ...request, inputImagePath: path, aspectRatio: "1:1" }, "key-00000008", deps);
    expect(provider.created[0]).toMatchObject({ mode: "image_to_video", imageUrl: `https://storage.example/${path}?signed` });
  });

  it("uses the enhancer when autoEnhance is on, falling back gracefully on failure", async () => {
    const ok = makeDeps({ enhancer: { id: "t", enhance: async () => "A detailed cinematic prompt about a car" } });
    ok.repo.balances.set(USER, 100);
    const res = await createGeneration(USER, { ...request, style: null, camera: null, autoEnhance: true }, "key-00000009", ok.deps);
    expect(ok.repo.rows.get(res.generationId)!.final_prompt).toBe("A detailed cinematic prompt about a car");

    const bad = makeDeps({ enhancer: { id: "t", enhance: async () => { throw new Error("boom"); } } });
    bad.repo.balances.set(USER, 100);
    const res2 = await createGeneration(USER, { ...request, style: null, camera: null, autoEnhance: true }, "key-00000010", bad.deps);
    expect(bad.repo.rows.get(res2.generationId)!.final_prompt).toBe(request.prompt);
  });
});

describe("syncGeneration", () => {
  async function started() {
    const ctx = setup();
    const { generationId } = await createGeneration(USER, request, "key-sync-0001", ctx.deps);
    return { ...ctx, id: generationId };
  }

  it("records processing progress", async () => {
    const ctx = await started();
    ctx.provider.nextState = { status: "processing", progress: 0.5 };
    const { row } = await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(row.status).toBe("processing");
    expect(row.progress).toBe(0.5);
  });

  it("respects the poll interval via the lease", async () => {
    const ctx = await started();
    ctx.provider.nextState = { status: "processing", progress: 0.1 };
    await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(ctx.provider.statusCalls).toBe(1);
    ctx.advance(6);
    await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(ctx.provider.statusCalls).toBe(2);
  });

  it("persists the output video on completion", async () => {
    const ctx = await started();
    ctx.provider.nextState = { status: "completed", outputUrls: ["https://runway.example/out.mp4"] };
    const { row } = await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(row.status).toBe("completed");
    expect(row.output_video_url).toBe(`${USER}/${ctx.id}.mp4`);
    expect(ctx.persisted[0]?.url).toBe("https://runway.example/out.mp4");
    expect(ctx.repo.refunds.size).toBe(0);
  });

  it("refunds exactly once when the provider reports failure", async () => {
    const ctx = await started();
    ctx.provider.nextState = { status: "failed", reason: "Moderation", code: "SAFETY.INPUT.TEXT" };
    const { row } = await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(row.status).toBe("failed");
    expect(row.error_message).toMatch(/moderation/i);
    expect(ctx.repo.balances.get(USER)).toBe(100);
    ctx.advance(10);
    await syncGeneration(row, ctx.deps);
    expect(ctx.repo.balances.get(USER)).toBe(100);
    expect(ctx.repo.refunds.size).toBe(1);
  });

  it("times out stuck generations and refunds", async () => {
    const ctx = await started();
    ctx.advance(31 * 60);
    const { row } = await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(row.status).toBe("failed");
    expect(ctx.provider.cancelled).toEqual(["task_1"]);
    expect(ctx.repo.balances.get(USER)).toBe(100);
  });

  it("keeps the generation active on transient provider errors", async () => {
    const ctx = await started();
    ctx.provider.statusError = new ProviderError("unavailable", "503");
    const { row } = await syncGeneration(ctx.repo.rows.get(ctx.id)!, ctx.deps);
    expect(row.status).toBe("queued");
    expect(ctx.repo.refunds.size).toBe(0);
  });

  it("never syncs terminal generations", async () => {
    const ctx = await started();
    const row = { ...ctx.repo.rows.get(ctx.id)!, status: "completed" as const };
    const res = await syncGeneration(row, ctx.deps);
    expect(res.synced).toBe(false);
    expect(ctx.provider.statusCalls).toBe(0);
  });
});

describe("cancel and regenerate", () => {
  it("cancels at the provider and refunds", async () => {
    const ctx = setup();
    const { generationId } = await createGeneration(USER, request, "key-cancel-01", ctx.deps);
    const row = await cancelGeneration(ctx.repo.rows.get(generationId)!, ctx.deps);
    expect(row.status).toBe("cancelled");
    expect(ctx.provider.cancelled).toEqual(["task_1"]);
    expect(ctx.repo.balances.get(USER)).toBe(100);
    await expect(cancelGeneration(row, ctx.deps)).rejects.toMatchObject({ code: "conflict" });
  });

  it("rebuilds an equivalent request for regeneration", async () => {
    const ctx = setup();
    const { generationId } = await createGeneration(USER, { ...request, style: "custom", customStyle: "Super 8" }, "key-regen-001", ctx.deps);
    const again = regenerateRequestFrom(ctx.repo.rows.get(generationId)!);
    expect(again).toMatchObject({ provider: "runway", model: "gen4.5", duration: 5, aspectRatio: "16:9", style: "custom", customStyle: "Super 8", camera: "tracking" });
  });

  it("regeneration uses a new charge", async () => {
    const ctx = setup();
    const { generationId } = await createGeneration(USER, request, "key-regen-002", ctx.deps);
    await createGeneration(USER, regenerateRequestFrom(ctx.repo.rows.get(generationId)!), "key-regen-003", ctx.deps);
    expect(ctx.repo.balances.get(USER)).toBe(50);
    expect((ctx.provider as FakeProvider).created).toHaveLength(2);
  });
});
