import type { Task } from "./types";
import { PRIORITY_RANK } from "./types";
import { endOfLocalDay, localKey, startOfLocalDay } from "./time";

export function isOverdue(t: Task, now: Date = new Date()) {
  if (t.status === "done" || !t.due_at) return false;
  if (t.due_all_day) return localKey(new Date(t.due_at)) < localKey(now);
  return Date.parse(t.due_at) < now.getTime();
}

export function isDueToday(t: Task, now: Date = new Date()) {
  return !!t.due_at && localKey(new Date(t.due_at)) === localKey(now);
}

export function isScheduledToday(t: Task, now: Date = new Date()) {
  if (!t.scheduled_start) return false;
  const s = Date.parse(t.scheduled_start);
  return s >= startOfLocalDay(now).getTime() && s <= endOfLocalDay(now).getTime();
}

/** Tasks that belong on today's list: overdue, due today, or scheduled today. */
export function isTodayTask(t: Task, now: Date = new Date()) {
  return isOverdue(t, now) || isDueToday(t, now) || isScheduledToday(t, now);
}

export function completedToday(t: Task, now: Date = new Date()) {
  return t.status === "done" && !!t.completed_at && localKey(new Date(t.completed_at)) === localKey(now);
}

/** Importance score used for "Today's Focus" ordering. */
export function focusScore(t: Task, now: Date = new Date()) {
  let s = PRIORITY_RANK[t.priority] * 10;
  if (isOverdue(t, now)) s += 25;
  else if (isDueToday(t, now)) s += 20;
  if (isScheduledToday(t, now)) s += 8;
  if (t.due_at) s += Math.max(0, 10 - (Date.parse(t.due_at) - now.getTime()) / 3600000 / 12);
  return s;
}

export type SortKey = "smart" | "due" | "priority" | "created" | "title";

export function sortTasks(tasks: Task[], key: SortKey, now: Date = new Date()) {
  const arr = [...tasks];
  const due = (t: Task) => (t.due_at ? Date.parse(t.due_at) : Number.POSITIVE_INFINITY);
  switch (key) {
    case "due":
      return arr.sort((a, b) => due(a) - due(b) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
    case "priority":
      return arr.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || due(a) - due(b));
    case "created":
      return arr.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr.sort((a, b) => focusScore(b, now) - focusScore(a, now) || due(a) - due(b));
  }
}
