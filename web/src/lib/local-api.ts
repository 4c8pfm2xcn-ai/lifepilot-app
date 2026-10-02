/**
 * In-browser implementation of the AI routes, used only by the static preview
 * build (NEXT_PUBLIC_STATIC_PREVIEW=1) where no server exists. It runs the
 * same on-device engines the server uses when no ANTHROPIC_API_KEY is set.
 */
import { heuristicExtract } from "./ai/heuristic-extract";
import { offlineAssistant } from "./ai/offline-assistant";
import { validateActions } from "./ai/actions";
import { planDay } from "./planner";
import { computeStats, plainWeeklySummary } from "./insights";
import type { ClientClock } from "./types";
import type { UserSnapshot } from "./ai/context";
import type { SnapshotSource } from "./client-api";

export class LocalApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message);
  }
}

function toSnapshot(src: SnapshotSource | null | undefined): UserSnapshot {
  return {
    name: src?.name ?? "",
    preferences: src!.preferences,
    tasks: src?.tasks ?? [],
    events: src?.events ?? [],
    goals: src?.goals ?? [],
    milestones: src?.goal_milestones ?? [],
    inbox: src?.inbox_items ?? [],
  };
}

export async function localApi(path: string, body: Record<string, unknown>, clock: ClientClock, src?: SnapshotSource | null): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 250)); // keep loading states visible, like a network call
  const snap = toSnapshot(src);
  switch (path) {
    case "/api/ai/extract": {
      const text = String(body.text ?? "");
      if (!text.trim() && !body.image) throw new LocalApiError("Nothing to process.", 400, false);
      if (body.image && !text.trim()) {
        return {
          extraction: { summary: "Image saved. Reading screenshots needs the AI model.", items: [], source: "heuristic", notice: "Screenshot understanding requires an Anthropic API key on the server. Add the details manually below.", processed_at: new Date().toISOString() },
        };
      }
      return { extraction: heuristicExtract(text, { today: clock.today }) };
    }
    case "/api/ai/plan":
      return { plan: planDay({ date: String(body.date), now: clock.now, timeZone: clock.timezone, tasks: snap.tasks, events: snap.events, prefs: snap.preferences }) };
    case "/api/ai/assistant": {
      const res = offlineAssistant(String(body.message ?? ""), snap, clock);
      const { accepted } = validateActions(res.actions, { tasks: snap.tasks, events: snap.events, goals: snap.goals, tz: clock.timezone, nowIso: clock.now });
      return { reply: res.reply, actions: accepted, source: "offline" };
    }
    case "/api/ai/milestones":
      throw new LocalApiError("Milestone suggestions need an Anthropic API key on the server. Add milestones manually for now.", 503, false);
    case "/api/ai/summary": {
      const stats = computeStats(snap.tasks, snap.goals, snap.milestones, clock.now, clock.timezone, snap.preferences.week_starts_on);
      return { headline: "Your week so far", summary: plainWeeklySummary(stats), suggestion: null, source: "computed" };
    }
    default:
      throw new LocalApiError("Not available in the preview.", 404, false);
  }
}
