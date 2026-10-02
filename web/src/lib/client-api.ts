"use client";
import { isSupabaseConfigured } from "./config";
import { clientClock } from "./time";
import { LocalApiError, localApi } from "./local-api";
import type { CalendarEvent, Goal, GoalMilestone, InboxItem, Preferences, Task } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface SnapshotSource {
  name: string;
  preferences: Preferences;
  tasks: Task[];
  events: CalendarEvent[];
  goals: Goal[];
  goal_milestones: GoalMilestone[];
  inbox_items: InboxItem[];
}

/** In demo mode the server can't read browser storage, so the relevant slice of data is sent along. */
function snapshot(src: SnapshotSource) {
  const cutoff = Date.now() - 45 * 86400000;
  return {
    name: src.name,
    preferences: src.preferences,
    tasks: src.tasks.filter((t) => t.status === "todo" || (t.completed_at && Date.parse(t.completed_at) > cutoff)).slice(-800),
    events: src.events.filter((e) => Date.parse(e.end_at) > cutoff).slice(-800),
    goals: src.goals,
    milestones: src.goal_milestones,
    inbox: src.inbox_items
      .slice(-100)
      .map((i) => ({ ...i, attachment_url: null })),
  };
}

export const isStaticPreview = process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1";

export async function postApi<T>(path: string, body: Record<string, unknown>, src?: SnapshotSource | null): Promise<T> {
  if (isStaticPreview) {
    try {
      return (await localApi(path, body, clientClock(), src)) as T;
    } catch (e) {
      if (e instanceof LocalApiError) throw new ApiError(e.message, e.status, e.retryable);
      throw e;
    }
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // In Supabase mode the server loads data itself under RLS, so no snapshot is sent.
      body: JSON.stringify({ ...body, clock: clientClock(), ...(src && !isSupabaseConfigured ? { snapshot: snapshot(src) } : {}) }),
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0, true);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError((data.error as string) ?? `Request failed (${res.status})`, res.status, (data.retryable as boolean) ?? res.status >= 500, data);
  return data as T;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(binary);
}
