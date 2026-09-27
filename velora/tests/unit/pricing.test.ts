import { describe, expect, it } from "vitest";

import { PRICING, PricingNotConfiguredError, calculateGenerationCost, costTable } from "@/lib/credits/pricing";
import { PROVIDER_CATALOG } from "@/lib/video/catalog";

describe("credit pricing", () => {
  it("charges per second for gen4.5", () => {
    expect(calculateGenerationCost("runway", "gen4.5", 5)).toBe(25);
    expect(calculateGenerationCost("runway", "gen4.5", 10)).toBe(50);
  });

  it("charges per second for veo3.1", () => {
    expect(calculateGenerationCost("runway", "veo3.1", 8)).toBe(80);
  });

  it("builds a cost table for display", () => {
    expect(costTable("runway", "gen4.5", [5, 10])).toEqual({ 5: 25, 10: 50 });
  });

  it("rejects unknown models", () => {
    expect(() => calculateGenerationCost("runway", "made-up", 5)).toThrow(PricingNotConfiguredError);
  });

  it("rejects invalid durations", () => {
    expect(() => calculateGenerationCost("runway", "gen4.5", 0)).toThrow(RangeError);
    expect(() => calculateGenerationCost("runway", "gen4.5", 2.5)).toThrow(RangeError);
  });

  it("has pricing for every catalog model", () => {
    for (const provider of PROVIDER_CATALOG) {
      for (const model of provider.models) {
        expect(PRICING[`${provider.id}:${model.id}`], `${provider.id}:${model.id}`).toBeDefined();
      }
    }
  });
});
