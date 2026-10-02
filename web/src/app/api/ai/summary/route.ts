import { NextResponse, type NextRequest } from "next/server";
import { AIError, isAIConfigured } from "@/lib/ai/anthropic";
import { jsonError, readJson, resolveRequest } from "@/lib/ai/context";
import { aiWeeklySummary } from "@/lib/ai/features";
import { computeStats, plainWeeklySummary } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const raw = await readJson(req);
  if (!raw) return jsonError("Invalid request.", 400);
  const ctx = await resolveRequest(req, raw, { needsData: true });
  if (!ctx.ok) return ctx.response;
  const { snapshot, clock } = ctx;
  const stats = computeStats(snapshot.tasks, snapshot.goals, snapshot.milestones, clock.now, clock.timezone, snapshot.preferences.week_starts_on);
  const plain = { headline: "Your week so far", summary: plainWeeklySummary(stats), suggestion: null as string | null, source: "computed" as const };
  if (!isAIConfigured() || !snapshot.preferences.ai_enabled) return NextResponse.json(plain);
  try {
    const out = await aiWeeklySummary({ stats, completedTitles: stats.topCompleted.map((t) => t.title), clock, tone: snapshot.preferences.ai_tone });
    return NextResponse.json({ ...out, source: "ai" });
  } catch (e) {
    return NextResponse.json({ ...plain, notice: e instanceof AIError ? e.message : "AI unavailable" });
  }
}
