import "server-only";

import { isSet, serverEnv } from "@/lib/env";

import { PROVIDER_CATALOG, findProviderDefinition } from "./catalog";
import { ProviderError, type VideoProvider } from "./provider";
import { RunwayProvider } from "./providers/runway";
import type { VideoProviderDefinition } from "./types";

/**
 * Provider registry. To add a provider:
 *   1. Add its capability definition to PROVIDER_CATALOG (catalog.ts).
 *   2. Implement VideoProvider in providers/<name>.ts.
 *   3. Register a factory below.
 *   4. Add pricing in lib/credits/pricing.ts.
 * The UI reads availability from listProviderStatus() and needs no changes.
 */
const FACTORIES: Record<string, () => VideoProvider> = {
  runway: () => {
    const apiKey = serverEnv.runwayApiSecret();
    if (!apiKey) throw new ProviderError("not_configured", "RUNWAYML_API_SECRET is not set");
    return new RunwayProvider({ apiKey });
  },
};

const instances = new Map<string, VideoProvider>();

export interface ProviderStatus {
  definition: VideoProviderDefinition;
  configured: boolean;
  missingEnv: string[];
}

export function listProviderStatus(): ProviderStatus[] {
  return PROVIDER_CATALOG.filter((p) => p.id in FACTORIES).map((definition) => {
    const missingEnv = definition.requiredEnv.filter((name) => !isSet(name));
    return { definition, configured: missingEnv.length === 0, missingEnv };
  });
}

export function listAvailableProviders(): VideoProviderDefinition[] {
  return listProviderStatus()
    .filter((s) => s.configured)
    .map((s) => s.definition);
}

export function getProvider(providerId: string): VideoProvider {
  const definition = findProviderDefinition(providerId);
  const factory = FACTORIES[providerId];
  if (!definition || !factory) {
    throw new ProviderError("invalid_request", `Unknown provider: ${providerId}`);
  }
  const missing = definition.requiredEnv.filter((name) => !isSet(name));
  if (missing.length > 0) {
    throw new ProviderError("not_configured", `Provider ${providerId} missing env: ${missing.join(", ")}`);
  }
  let instance = instances.get(providerId);
  if (!instance) {
    instance = factory();
    instances.set(providerId, instance);
  }
  return instance;
}
