import "server-only";

import type { ModelOption } from "@/components/generation/create-form";
import { costTable } from "@/lib/credits/pricing";

import { listProviderStatus } from "./registry";
import type { GenerationMode } from "./types";

/**
 * Model options for the Create page. When no provider is configured the catalog is
 * still returned (so the UI can be developed), flagged as not ready.
 */
export function createPageModelOptions(): { models: ModelOption[]; ready: boolean; missingEnv: string[] } {
  const statuses = listProviderStatus();
  const configured = statuses.filter((s) => s.configured);
  const source = configured.length > 0 ? configured : statuses;
  const models: ModelOption[] = source.flatMap(({ definition }) =>
    definition.models.map((m) => ({
      provider: definition.id,
      providerName: definition.displayName,
      id: m.id,
      displayName: m.displayName,
      description: m.description,
      maxPromptLength: m.maxPromptLength,
      modes: Object.fromEntries(
        (Object.entries(m.modes) as [GenerationMode, NonNullable<(typeof m.modes)[GenerationMode]>][]).map(([mode, caps]) => [
          mode,
          {
            aspectRatios: caps.aspectRatios.map((r) => r.label),
            durations: [...caps.durations],
            costs: costTable(definition.id, m.id, caps.durations),
          },
        ]),
      ),
    })),
  );
  return {
    models,
    ready: configured.length > 0,
    missingEnv: configured.length > 0 ? [] : [...new Set(statuses.flatMap((s) => s.missingEnv))],
  };
}
