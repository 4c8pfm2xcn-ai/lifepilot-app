import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AIError, isAIConfigured } from "@/lib/ai/anthropic";
import { jsonError, readJson, resolveRequest } from "@/lib/ai/context";
import { aiMilestones } from "@/lib/ai/features";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().default(null),
  target_date: z.string().nullable().default(null),
  existing: z.array(z.string().max(200)).max(50).default([]),
});

export async function POST(req: NextRequest) {
  const raw = await readJson(req);
  const parsed = Body.safeParse(raw);
  if (!raw || !parsed.success) return jsonError("Invalid goal.", 400);
  const ctx = await resolveRequest(req, raw);
  if (!ctx.ok) return ctx.response;
  if (!isAIConfigured() || !ctx.snapshot.preferences.ai_enabled) {
    return jsonError(isAIConfigured() ? "AI is turned off in your settings." : "Milestone suggestions need an Anthropic API key on the server.", 503, { retryable: false, offline: true });
  }
  try {
    return NextResponse.json({ milestones: await aiMilestones({ ...parsed.data, clock: ctx.clock }) });
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError("Couldn't suggest milestones.");
    return jsonError(err.message, err.status, { retryable: err.retryable });
  }
}
