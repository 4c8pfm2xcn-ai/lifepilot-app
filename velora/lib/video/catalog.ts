import type {
  AspectRatioOption,
  GenerationMode,
  ModeCapabilities,
  VideoModelDefinition,
  VideoProviderDefinition,
} from "./types";

/**
 * Static capability catalog. Client-safe (no secrets).
 *
 * Runway values are taken from the official Runway API spec as shipped in
 * @runwayml/sdk v4.20.1 (API version 2024-11-06):
 *  - POST /v1/text_to_video, POST /v1/image_to_video, GET/DELETE /v1/tasks/{id}
 *  - gen4.5: duration integer 2-10, promptText <= 1000 UTF-16 units
 *      text_to_video ratio: 1280:720 | 720:1280
 *      image_to_video ratio: 1280:720 | 720:1280 | 1104:832 | 960:960 | 832:1104 | 1584:672
 *  - veo3.1: duration 4 | 6 | 8, ratio 1280:720 | 720:1280 | 1080:1920 | 1920:1080
 *  - Image inputs: HTTPS URL, Runway upload URI, or data URI up to 5MB.
 *  - No webhook support; tasks should not be polled more than once per 5 seconds.
 */

const RUNWAY_IMAGE_INPUT = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

const R16x9: AspectRatioOption = { label: "16:9", providerValue: "1280:720" };
const R9x16: AspectRatioOption = { label: "9:16", providerValue: "720:1280" };

const gen45: VideoModelDefinition = {
  id: "gen4.5",
  displayName: "Gen-4.5",
  description: "Runway's flagship model for cinematic text-to-video and image-to-video.",
  maxPromptLength: 1000,
  modes: {
    text_to_video: {
      aspectRatios: [R16x9, R9x16],
      durations: [5, 10],
    },
    image_to_video: {
      aspectRatios: [
        R16x9,
        R9x16,
        { label: "1:1", providerValue: "960:960" },
        { label: "4:3", providerValue: "1104:832" },
        { label: "3:4", providerValue: "832:1104" },
        { label: "21:9", providerValue: "1584:672" },
      ],
      durations: [5, 10],
    },
  },
  imageInput: RUNWAY_IMAGE_INPUT,
};

const veo31: VideoModelDefinition = {
  id: "veo3.1",
  displayName: "Veo 3.1",
  description: "Google Veo 3.1 served through the Runway API. 1080p output, 4–8 second clips.",
  maxPromptLength: 1000,
  modes: {
    text_to_video: {
      aspectRatios: [
        { label: "16:9", providerValue: "1920:1080" },
        { label: "9:16", providerValue: "1080:1920" },
      ],
      durations: [4, 6, 8],
    },
    image_to_video: {
      aspectRatios: [
        { label: "16:9", providerValue: "1920:1080" },
        { label: "9:16", providerValue: "1080:1920" },
      ],
      durations: [4, 6, 8],
    },
  },
  imageInput: RUNWAY_IMAGE_INPUT,
};

export const PROVIDER_CATALOG: readonly VideoProviderDefinition[] = [
  {
    id: "runway",
    displayName: "Runway",
    requiredEnv: ["RUNWAYML_API_SECRET"],
    docsUrl: "https://docs.dev.runwayml.com/api/",
    supportsWebhooks: false,
    minPollIntervalSeconds: 5,
    models: [gen45, veo31],
  },
];

export function findProviderDefinition(providerId: string): VideoProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === providerId);
}

export function findModel(providerId: string, modelId: string): VideoModelDefinition | undefined {
  return findProviderDefinition(providerId)?.models.find((m) => m.id === modelId);
}

export function getModeCapabilities(
  providerId: string,
  modelId: string,
  mode: GenerationMode,
): ModeCapabilities | undefined {
  return findModel(providerId, modelId)?.modes[mode];
}

export function resolveAspectRatio(
  providerId: string,
  modelId: string,
  mode: GenerationMode,
  label: string,
): AspectRatioOption | undefined {
  return getModeCapabilities(providerId, modelId, mode)?.aspectRatios.find((r) => r.label === label);
}
