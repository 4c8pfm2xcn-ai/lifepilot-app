import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "../config";
import { getServerSupabase } from "../supabase/server";
import { DEFAULT_PREFERENCES, type CalendarEvent, type ClientClock, type Goal, type GoalMilestone, type InboxItem, type Preferences, type Task } from "../types";
import { safeTimeZone } from "../time";
import { rateLimit } from "./rate-limit";

export interface UserSnapshot {
  name: string;
  preferences: Preferences;
  tasks: Task[];
  events: CalendarEvent[];
  goals: Goal[];
  milestones: GoalMilestone[];
  inbox: InboxItem[];
}

export const ClockSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  now: z.string(),
  timezone: z.string().max(64),
  utc_offset_minutes: z.number(),
});

// The demo-mode snapshot comes from the user's own browser storage; validate
// its shape loosely and cap sizes so a malformed payload can't blow up prompts.
const SnapshotSchema = z
  .object({
    name: z.string().max(120).default(""),
    preferences: z.record(z.string(), z.unknown()).default({}),
    tasks: z.array(z.record(z.string(), z.unknown())).max(800).default([]),
    events: z.array(z.record(z.string(), z.unknown())).max(800).default([]),
    goals: z.array(z.record(z.string(), z.unknown())).max(200).default([]),
    milestones: z.array(z.record(z.string(), z.unknown())).max(1000).default([]),
    inbox: z.array(z.record(z.string(), z.unknown())).max(200).default([]),
  })
  .partial();

type Resolved = { ok: true; snapshot: UserSnapshot; clock: ClientClock; userKey: string } | { ok: false; response: NextResponse };

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function clientKey(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * Resolves who is asking and what data the AI may see.
 *
 * - Supabase mode: requires a signed-in session and loads data from the
 *   database with the user's own JWT, so row-level security guarantees the AI
 *   only ever sees that user's rows. Any client-sent snapshot is ignored.
 * - Demo mode: data lives in the browser, so the client sends its snapshot.
 */
export async function resolveRequest(req: NextRequest, body: Record<string, unknown>, opts: { needsData?: boolean } = {}): Promise<Resolved> {
  const clockParsed = ClockSchema.safeParse(body.clock);
  if (!clockParsed.success) return { ok: false, response: jsonError("Missing or invalid clock.", 400) };
  const clock = { ...clockParsed.data, timezone: safeTimeZone(clockParsed.data.timezone) };

  if (isSupabaseConfigured) {
    const sb = await getServerSupabase();
    const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
    if (!sb || !data.user) return { ok: false, response: jsonError("Please sign in again.", 401) };
    const limited = rateLimit(`u:${data.user.id}`);
    if (!limited.ok) return { ok: false, response: jsonError("Too many requests. Please wait a moment.", 429, { retryAfter: limited.retryAfter }) };
    if (!opts.needsData) {
      const { data: prof } = await sb.from("profiles").select("full_name, preferences").maybeSingle();
      return { ok: true, clock, userKey: data.user.id, snapshot: { name: prof?.full_name ?? "", preferences: { ...DEFAULT_PREFERENCES, ...(prof?.preferences ?? {}) }, tasks: [], events: [], goals: [], milestones: [], inbox: [] } };
    }
    const since = new Date(Date.now() - 45 * 86400000).toISOString();
    const [prof, tasks, events, goals, milestones, inbox] = await Promise.all([
      sb.from("profiles").select("full_name, preferences").maybeSingle(),
      sb.from("tasks").select("*").or(`status.eq.todo,completed_at.gte.${since}`).limit(800),
      sb.from("events").select("*").gte("end_at", since).limit(800),
      sb.from("goals").select("*").limit(200),
      sb.from("goal_milestones").select("*").limit(1000),
      sb.from("inbox_items").select("id, original_content, content_type, extracted_data, processing_status, resolution, created_at, updated_at, user_id, attachment_url, error").order("created_at", { ascending: false }).limit(100),
    ]);
    const err = [tasks, events, goals, milestones, inbox].find((r) => r.error)?.error;
    if (err) return { ok: false, response: jsonError("Couldn't load your data for the AI.", 500) };
    return {
      ok: true,
      clock,
      userKey: data.user.id,
      snapshot: {
        name: prof.data?.full_name ?? "",
        preferences: { ...DEFAULT_PREFERENCES, ...(prof.data?.preferences ?? {}) },
        tasks: (tasks.data ?? []) as Task[],
        events: (events.data ?? []) as CalendarEvent[],
        goals: (goals.data ?? []) as Goal[],
        milestones: (milestones.data ?? []) as GoalMilestone[],
        inbox: (inbox.data ?? []) as InboxItem[],
      },
    };
  }

  const limited = rateLimit(`ip:${clientKey(req)}`);
  if (!limited.ok) return { ok: false, response: jsonError("Too many requests. Please wait a moment.", 429, { retryAfter: limited.retryAfter }) };
  const snap = SnapshotSchema.safeParse(body.snapshot ?? {});
  if (!snap.success) return { ok: false, response: jsonError("Invalid data snapshot.", 400) };
  const s = snap.data;
  return {
    ok: true,
    clock,
    userKey: clientKey(req),
    snapshot: {
      name: s.name ?? "",
      preferences: { ...DEFAULT_PREFERENCES, ...(s.preferences as Partial<Preferences>) },
      tasks: (s.tasks ?? []) as unknown as Task[],
      events: (s.events ?? []) as unknown as CalendarEvent[],
      goals: (s.goals ?? []) as unknown as Goal[],
      milestones: (s.milestones ?? []) as unknown as GoalMilestone[],
      inbox: (s.inbox ?? []) as unknown as InboxItem[],
    },
  };
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
