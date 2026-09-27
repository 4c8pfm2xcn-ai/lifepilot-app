/**
 * Central Velora credit pricing. This is the ONLY place generation prices are defined.
 *
 * Velora credits are an internal unit and are independent of the provider's own
 * billing units. Adjust these numbers to match your margins.
 */

export interface ModelPricing {
  /** Credits charged per second of requested output. */
  creditsPerSecond: number;
  /** Optional fixed per-duration overrides (seconds -> credits). */
  overrides?: Readonly<Record<number, number>>;
}

export const PRICING: Readonly<Record<string, ModelPricing>> = {
  "runway:gen4.5": { creditsPerSecond: 5 },
  "runway:veo3.1": { creditsPerSecond: 10 },
};

export class PricingNotConfiguredError extends Error {
  constructor(provider: string, model: string) {
    super(`No pricing configured for ${provider}:${model}`);
    this.name = "PricingNotConfiguredError";
  }
}

export function calculateGenerationCost(provider: string, model: string, durationSeconds: number): number {
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError("Duration must be a positive integer number of seconds");
  }
  const pricing = PRICING[`${provider}:${model}`];
  if (!pricing) throw new PricingNotConfiguredError(provider, model);

  const override = pricing.overrides?.[durationSeconds];
  if (override !== undefined) return override;
  return Math.ceil(pricing.creditsPerSecond * durationSeconds);
}

/** Returns a cost table for every duration offered, for display in the UI. */
export function costTable(provider: string, model: string, durations: readonly number[]): Record<number, number> {
  return Object.fromEntries(durations.map((d) => [d, calculateGenerationCost(provider, model, d)]));
}
