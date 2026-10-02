import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AIError, isAIConfigured } from "@/lib/ai/anthropic";
import { jsonError, readJson, resolveRequest } from "@/lib/ai/context";
import { aiAssistant } from "@/lib/ai/features";
import { offlineAssistant } from "@/lib/ai/offline-assistant";
import { validateActions } from "@/lib/ai/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) })).max(40).default([]),
});

export async function POST(req: NextRequest) {
  const raw = await readJson(req);
  const parsed = Body.safeParse(raw);
  if (!raw || !parsed.success) return jsonError("Please enter a message (up to 4,000 characters).", 400);
  const ctx = await resolveRequest(req, raw, { needsData: true });
  if (!ctx.ok) return ctx.response;
  const { snapshot, clock } = ctx;
  const useAI = isAIConfigured() && snapshot.preferences.ai_enabled;

  let result: { reply: string; actions: Parameters<typeof validateActions>[0] };
  try {
    result = useAI ? await aiAssistant({ history: parsed.data.history, message: parsed.data.message, snapshot, clock }) : offlineAssistant(parsed.data.message, snapshot, clock);
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError("The assistant had a problem.");
    return jsonError(err.message, err.status, { retryable: err.retryable });
  }

  const { accepted, rejected } = validateActions(result.actions, { tasks: snapshot.tasks, events: snapshot.events, goals: snapshot.goals, tz: clock.timezone, nowIso: clock.now });
  if (rejected.length) console.warn("[assistant] rejected actions", rejected.map((r) => r.reason));
  return NextResponse.json({
    reply: result.reply,
    actions: accepted,
    rejected: rejected.length,
    source: useAI ? "ai" : "offline",
  });
}
