/**
 * Prompt enhancement abstraction. Implementations turn a short idea into a
 * detailed, provider-friendly video prompt while preserving the user's subject.
 */
export interface EnhancementContext {
  maxLength: number;
  styleHint?: string | null;
  cameraHint?: string | null;
  hasReferenceImage: boolean;
}

export interface PromptEnhancer {
  readonly id: string;
  enhance(prompt: string, context: EnhancementContext): Promise<string>;
}

export class EnhancementError extends Error {
  readonly publicMessage: string;
  constructor(message: string, publicMessage = "Prompt enhancement failed. You can still generate with your original prompt.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnhancementError";
    this.publicMessage = publicMessage;
  }
}

export const ENHANCER_SYSTEM_PROMPT = `You rewrite short ideas into detailed prompts for an AI text-to-video model.

Rules:
- Preserve the user's subject, action and intent exactly. Never replace, remove or add main subjects.
- Describe, in natural flowing prose: the subject, the environment, the motion over the shot, camera framing and movement, lighting, composition, atmosphere, and realism/cinematic details.
- Describe one continuous shot. No scene cuts, no lists, no headings, no quotation marks, no markdown.
- Do not add on-screen text, logos, real people's names, or brand names the user did not mention.
- If a reference image is used, describe motion and camera rather than re-describing every visual detail.
- If a style or camera hint is given, weave it in naturally.
- Output ONLY the rewritten prompt.`;

export function buildEnhancerUserMessage(prompt: string, context: EnhancementContext): string {
  const lines = [`Idea: ${prompt}`];
  if (context.styleHint) lines.push(`Style hint: ${context.styleHint}`);
  if (context.cameraHint) lines.push(`Camera hint: ${context.cameraHint}`);
  if (context.hasReferenceImage) lines.push("A reference image will be used as the first frame.");
  lines.push(`Keep the result under ${context.maxLength} characters.`);
  return lines.join("\n");
}

/** Cleans model output and enforces the provider limit without cutting mid-sentence where possible. */
export function sanitizeEnhancedPrompt(raw: string, maxLength: number): string {
  let text = raw
    .replace(/```[a-z]*|```/gi, "")
    .replace(/^\s*(prompt|rewritten prompt)\s*:\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    text = lastStop > maxLength * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd();
  }
  return text;
}
