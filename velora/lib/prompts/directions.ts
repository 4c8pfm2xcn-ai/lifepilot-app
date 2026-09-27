/**
 * Style and camera "directions". Providers do not expose dedicated style/camera
 * parameters, so these are converted into explicit prompt instructions.
 * Client-safe.
 */

export const STYLE_PRESETS = {
  cinematic: {
    label: "Cinematic",
    instruction: "Cinematic look: filmic color grade, dramatic motivated lighting, shallow depth of field, subtle film grain.",
  },
  realistic: {
    label: "Realistic",
    instruction: "Photorealistic: natural lighting, true-to-life textures and colors, physically plausible motion.",
  },
  commercial: {
    label: "Commercial",
    instruction: "High-end commercial style: clean polished lighting, crisp detail, premium brand aesthetic.",
  },
  anime: {
    label: "Anime",
    instruction: "Anime style: hand-drawn cel shading, expressive linework, vibrant stylized colors.",
  },
  "3d": {
    label: "3D",
    instruction: "Stylized 3D render: smooth physically based materials, global illumination, clean geometry.",
  },
  documentary: {
    label: "Documentary",
    instruction: "Documentary style: observational framing, natural available light, authentic unstaged feel.",
  },
  fashion: {
    label: "Fashion",
    instruction: "Fashion film style: editorial lighting, elegant posing and movement, rich fabric detail.",
  },
  product: {
    label: "Product",
    instruction: "Product showcase: studio lighting, clean background, sharp focus on the product's form and materials.",
  },
} as const;

export type StylePreset = keyof typeof STYLE_PRESETS;
export const STYLE_PRESET_IDS = Object.keys(STYLE_PRESETS) as StylePreset[];

export const CAMERA_MOVEMENTS = {
  static: { label: "Static", instruction: "Camera: locked-off static shot, no camera movement." },
  push_in: { label: "Slow push-in", instruction: "Camera: slow, smooth push-in toward the subject." },
  pull_back: { label: "Pull-back", instruction: "Camera: slow pull-back revealing more of the scene." },
  pan: { label: "Pan", instruction: "Camera: smooth horizontal pan across the scene." },
  tracking: { label: "Tracking", instruction: "Camera: tracking shot that follows the subject's movement." },
  orbit: { label: "Orbit", instruction: "Camera: slow orbit around the subject." },
  handheld: { label: "Handheld", instruction: "Camera: subtle handheld motion with natural sway." },
  aerial: { label: "Aerial / drone", instruction: "Camera: sweeping aerial drone shot from above." },
} as const;

export type CameraMovement = keyof typeof CAMERA_MOVEMENTS;
export const CAMERA_MOVEMENT_IDS = Object.keys(CAMERA_MOVEMENTS) as CameraMovement[];

export interface DirectionOptions {
  style?: StylePreset | "custom" | null;
  customStyle?: string | null;
  camera?: CameraMovement | null;
}

export function directionInstructions(options: DirectionOptions): string[] {
  const parts: string[] = [];
  if (options.style === "custom") {
    const custom = options.customStyle?.trim();
    if (custom) parts.push(`Style: ${custom.replace(/\s+/g, " ")}.`);
  } else if (options.style) {
    parts.push(STYLE_PRESETS[options.style].instruction);
  }
  if (options.camera) parts.push(CAMERA_MOVEMENTS[options.camera].instruction);
  return parts;
}

/** Builds the exact prompt sent to the provider. Deterministic and side-effect free. */
export function composeFinalPrompt(basePrompt: string, options: DirectionOptions): string {
  const base = basePrompt.trim().replace(/\s+$/g, "");
  const extras = directionInstructions(options);
  if (extras.length === 0) return base;
  const terminated = /[.!?]$/.test(base) ? base : `${base}.`;
  return [terminated, ...extras].join(" ");
}

/** Length in UTF-16 code units — the unit Runway uses for its prompt limit. */
export function promptLength(text: string): number {
  return text.length;
}
