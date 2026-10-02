import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AIError, isAIConfigured } from "@/lib/ai/anthropic";
import { jsonError, readJson, resolveRequest } from "@/lib/ai/context";
import { aiPlan } from "@/lib/ai/features";
import { planDay } from "@/lib/planner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(req: NextRequest) {
  const raw = await readJson(req);
  const parsed = Body.safeParse(raw);
  if (!raw || !parsed.success) return jsonError("Invalid request.", 400);
  const ctx = await resolveRequest(req, raw, { needsData: true });
  if (!ctx.ok) return ctx.response;
  const { snapshot, clock } = ctx;
  const heuristic = () => planDay({ date: parsed.data.date, now: clock.now, timeZone: clock.timezone, tasks: snapshot.tasks, events: snapshot.events, prefs: snapshot.preferences });

  if (!isAIConfigured() || !snapshot.preferences.ai_enabled) return NextResponse.json({ plan: heuristic() });
  try {
    return NextResponse.json({ plan: await aiPlan({ date: parsed.data.date, snapshot, clock }) });
  } catch (e) {
    const plan = heuristic();
    plan.notice = `AI planning unavailable (${e instanceof AIError ? e.message : "error"}) — this plan was built on-device.`;
    return NextResponse.json({ plan });
  }
}
