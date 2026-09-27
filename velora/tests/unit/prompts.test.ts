import { describe, expect, it } from "vitest";

import { composeFinalPrompt, directionInstructions } from "@/lib/prompts/directions";
import { buildEnhancerUserMessage, sanitizeEnhancedPrompt } from "@/lib/prompts/enhancer";

describe("prompt directions", () => {
  it("returns the prompt unchanged without directions", () => {
    expect(composeFinalPrompt("  A red fox in snow  ", {})).toBe("A red fox in snow");
  });

  it("appends style and camera instructions while preserving the subject", () => {
    const out = composeFinalPrompt("A Lamborghini driving through the mountains", { style: "cinematic", camera: "tracking" });
    expect(out.startsWith("A Lamborghini driving through the mountains.")).toBe(true);
    expect(out).toContain("Cinematic look");
    expect(out).toContain("tracking shot");
  });

  it("supports custom styles", () => {
    expect(directionInstructions({ style: "custom", customStyle: "  Super 8   film " })).toEqual(["Style: Super 8 film."]);
  });
});

describe("enhancer helpers", () => {
  it("strips wrappers and quotes from model output", () => {
    expect(sanitizeEnhancedPrompt('Prompt: "A slow push-in on a lighthouse."', 200)).toBe("A slow push-in on a lighthouse.");
  });

  it("truncates at a sentence boundary when over the limit", () => {
    const text = "First sentence is here. Second sentence is also here. Third one is long enough to overflow.";
    const out = sanitizeEnhancedPrompt(text, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith(".")).toBe(true);
  });

  it("includes hints and the length budget in the user message", () => {
    const msg = buildEnhancerUserMessage("a fox", { maxLength: 700, styleHint: "Anime", cameraHint: "Orbit", hasReferenceImage: true });
    expect(msg).toContain("Idea: a fox");
    expect(msg).toContain("Anime");
    expect(msg).toContain("700");
    expect(msg).toContain("reference image");
  });
});
