/**
 * Server-side validation of assistant-proposed actions.
 *
 * The model never writes to the database. It proposes actions; this module
 * validates their shape, checks that every referenced id belongs to the
 * requesting user's data, attaches conflict warnings, and marks destructive
 * operations. The client then shows each one for explicit confirmation.
 */
import { ProposedActionSchema, type CalendarEvent, type Goal, type ProposedAction, type ProposedActionPayload, type Task } from "../types";
import { uid } from "../id";
import { busyForRange, findConflicts } from "../planner";
import { formatInZone } from "./format";
import { isDateKey, isHHMM, zonedTimeToUtc } from "../time";

export interface RawAction {
  type: string;
  summary?: string | null;
  task_id?: string | null;
  goal_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  estimated_minutes?: number | null;
  /** Local wall-clock "YYYY-MM-DDTHH:MM" in the user's timezone, or ISO. */
  start?: string | null;
  end?: string | null;
  items?: string[] | null;
}

function localToIso(value: string | null | undefined, tz: string): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    if (!isDateKey(m[1]) || !isHHMM(m[2])) return null;
    return zonedTimeToUtc(m[1], m[2], tz).toISOString();
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function clean<T extends Record<string, unknown>>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

export function toPayload(raw: RawAction, tz: string): ProposedActionPayload | null {
  const base = {
    type: raw.type,
    task_id: raw.task_id ?? undefined,
    goal_id: raw.goal_id ?? undefined,
  };
  let candidate: Record<string, unknown>;
  switch (raw.type) {
    case "create_task":
      candidate = { ...base, ...clean({ title: raw.title, description: raw.description, category: raw.category ?? "other", priority: raw.priority ?? "normal", due_date: raw.due_date, due_time: raw.due_time, estimated_minutes: raw.estimated_minutes, goal_id: raw.goal_id }) };
      break;
    case "update_task":
      candidate = { ...base, ...clean({ title: raw.title, priority: raw.priority, category: raw.category, due_date: raw.due_date, due_time: raw.due_time, estimated_minutes: raw.estimated_minutes }) };
      break;
    case "schedule_task":
    case "create_event":
      candidate = { ...base, ...clean({ title: raw.title, description: raw.description }), start: localToIso(raw.start, tz), end: localToIso(raw.end, tz) };
      break;
    case "add_subtasks":
      candidate = { ...base, subtasks: (raw.items ?? []).map((s) => s.trim()).filter(Boolean) };
      break;
    case "add_milestones":
      candidate = { ...base, milestones: (raw.items ?? []).map((s) => s.trim()).filter(Boolean) };
      break;
    default:
      candidate = base;
  }
  if (typeof candidate.estimated_minutes === "number") candidate.estimated_minutes = Math.round(candidate.estimated_minutes as number);
  const parsed = ProposedActionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function describeAction(a: ProposedActionPayload, ctx: { tasks: Task[]; goals: Goal[]; tz: string }): string {
  const task = "task_id" in a ? ctx.tasks.find((t) => t.id === a.task_id) : undefined;
  const goal = "goal_id" in a && a.goal_id ? ctx.goals.find((g) => g.id === a.goal_id) : undefined;
  switch (a.type) {
    case "create_task":
      return `Create task “${a.title}”${a.due_date ? ` due ${a.due_date}${a.due_time ? ` ${a.due_time}` : ""}` : ""}`;
    case "update_task": {
      const changes = [a.title && `rename to “${a.title}”`, a.priority && `priority → ${a.priority}`, a.category && `category → ${a.category}`, a.due_date && `due → ${a.due_date}${a.due_time ? ` ${a.due_time}` : ""}`, a.estimated_minutes && `estimate → ${a.estimated_minutes}m`].filter(Boolean);
      return `Update “${task?.title}”: ${changes.join(", ") || "no changes"}`;
    }
    case "complete_task":
      return `Mark “${task?.title}” as done`;
    case "delete_task":
      return `Delete “${task?.title}”`;
    case "schedule_task":
      return `Schedule “${task?.title}” ${formatInZone(a.start, a.end, ctx.tz)}`;
    case "create_event":
      return `Add event “${a.title}” ${formatInZone(a.start, a.end, ctx.tz)}`;
    case "add_subtasks":
      return `Add ${a.subtasks.length} subtasks to “${task?.title}”`;
    case "add_milestones":
      return `Add ${a.milestones.length} milestones to “${goal?.title}”`;
  }
}

export function validateActions(raws: RawAction[], ctx: { tasks: Task[]; events: CalendarEvent[]; goals: Goal[]; tz: string; nowIso: string }) {
  const accepted: ProposedAction[] = [];
  const rejected: { raw: RawAction; reason: string }[] = [];
  const taskIds = new Set(ctx.tasks.map((t) => t.id));
  const goalIds = new Set(ctx.goals.map((g) => g.id));

  for (const raw of raws.slice(0, 12)) {
    const payload = toPayload(raw, ctx.tz);
    if (!payload) {
      rejected.push({ raw, reason: "Invalid action shape" });
      continue;
    }
    if ("task_id" in payload && !taskIds.has(payload.task_id)) {
      rejected.push({ raw, reason: "Referenced task does not exist" });
      continue;
    }
    if ((payload.type === "add_milestones" || (payload.type === "create_task" && payload.goal_id)) && !goalIds.has(payload.goal_id!)) {
      if (payload.type === "add_milestones") {
        rejected.push({ raw, reason: "Referenced goal does not exist" });
        continue;
      }
      (payload as { goal_id?: string | null }).goal_id = null;
    }
    let warning: string | null = null;
    if (payload.type === "schedule_task" || payload.type === "create_event") {
      const s = Date.parse(payload.start);
      const e = Date.parse(payload.end);
      if (!(e > s)) {
        rejected.push({ raw, reason: "End must be after start" });
        continue;
      }
      if (e - s > 12 * 3600000) {
        rejected.push({ raw, reason: "Block is unreasonably long" });
        continue;
      }
      const exclude = payload.type === "schedule_task" ? new Set([payload.task_id]) : new Set<string>();
      const clashes = findConflicts(s, e, busyForRange(s, e, ctx.events, ctx.tasks, exclude));
      if (clashes.length) warning = `Overlaps ${clashes.map((c) => `“${c.label}”`).join(", ")}`;
      if (s < Date.parse(ctx.nowIso) - 5 * 60000) warning = [warning, "Starts in the past"].filter(Boolean).join(" · ");
    }
    if (payload.type === "complete_task" && ctx.tasks.find((t) => t.id === payload.task_id)?.status === "done") {
      rejected.push({ raw, reason: "Task already completed" });
      continue;
    }
    accepted.push({
      ...payload,
      id: uid(),
      summary: describeAction(payload, ctx),
      destructive: payload.type === "delete_task",
      warning,
      status: "proposed",
    } as ProposedAction);
  }
  return { accepted, rejected };
}
