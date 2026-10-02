/**
 * Scheduling engine.
 *
 * - `planDay` builds a realistic, conflict-free schedule for one day. It is the
 *   offline planner and the safety net for AI plans.
 * - `validateBlocks` rejects any proposed block that overlaps a fixed
 *   commitment, another block, or falls outside the day — AI output always
 *   passes through it before reaching the user.
 * - `findSlots` proposes free time slots for a single task.
 *
 * Nothing in here mutates data; callers present results for confirmation.
 */
import type { CalendarEvent, DayPlan, PlanBlock, Preferences, Task } from "./types";
import { PRIORITY_RANK } from "./types";
import { addDaysKey, diffDaysKey, fromMinutes, overlaps, toMinutes, zonedParts, zonedTimeToUtc } from "./time";
import { to12h } from "./ai/format";

export interface PlanInput {
  date: string;
  now: string; // ISO
  timeZone: string;
  tasks: Task[];
  events: CalendarEvent[];
  prefs: Pick<Preferences, "work_start" | "work_end" | "daily_focus_minutes">;
}

export interface Busy {
  start: number; // epoch ms
  end: number;
  label: string;
  kind: "event" | "task";
}

const BUFFER_MIN = 10;
const DEFAULT_TASK_MIN = 30;
const MAX_BLOCK_MIN = 180;

export function dayBounds(date: string, timeZone: string) {
  return { start: zonedTimeToUtc(date, "00:00", timeZone).getTime(), end: zonedTimeToUtc(addDaysKey(date, 1), "00:00", timeZone).getTime() };
}

export function busyForRange(rangeStart: number, rangeEnd: number, events: CalendarEvent[], tasks: Task[], excludeTaskIds: Set<string> = new Set()): Busy[] {
  const busy: Busy[] = [];
  for (const e of events) {
    if (e.all_day) continue; // all-day events (holidays, birthdays) don't block time
    const s = Date.parse(e.start_at);
    const en = Date.parse(e.end_at);
    if (overlaps(s, en, rangeStart, rangeEnd)) busy.push({ start: s, end: en, label: e.title, kind: "event" });
  }
  for (const t of tasks) {
    if (excludeTaskIds.has(t.id) || t.status === "done" || !t.scheduled_start || !t.scheduled_end) continue;
    const s = Date.parse(t.scheduled_start);
    const en = Date.parse(t.scheduled_end);
    if (overlaps(s, en, rangeStart, rangeEnd)) busy.push({ start: s, end: en, label: t.title, kind: "task" });
  }
  return busy.sort((a, b) => a.start - b.start);
}

export function findConflicts(start: number, end: number, busy: Busy[]) {
  return busy.filter((b) => overlaps(start, end, b.start, b.end));
}

function roundUp(ms: number, stepMin = 15) {
  const step = stepMin * 60000;
  return Math.ceil(ms / step) * step;
}

function taskReason(t: Task, today: string, timeZone: string) {
  if (t.due_at) {
    const dueKey = zonedParts(new Date(t.due_at), timeZone).key;
    const diff = diffDaysKey(dueKey, today);
    if (diff < 0) return `Overdue by ${-diff} day${diff === -1 ? "" : "s"}`;
    if (diff === 0) return t.due_all_day ? "Due today" : `Due today at ${zonedParts(new Date(t.due_at), timeZone).hhmm}`;
    if (diff === 1) return "Due tomorrow";
    if (diff <= 3) return `Due in ${diff} days`;
  }
  if (t.priority === "urgent") return "Urgent priority";
  if (t.priority === "high") return "High priority";
  return "Fits your open time";
}

/** Tasks worth considering for a given day, most important first. */
export function candidateTasks(tasks: Task[], date: string, timeZone: string) {
  const { start, end } = dayBounds(date, timeZone);
  const horizon = dayBounds(addDaysKey(date, 3), timeZone).end;
  const open = tasks.filter((t) => {
    if (t.status === "done") return false;
    if (t.scheduled_start) {
      const s = Date.parse(t.scheduled_start);
      // already placed on this or a later day → leave it alone
      if (s >= start) return false;
    }
    const due = t.due_at ? Date.parse(t.due_at) : null;
    if (due !== null && due < horizon) return true;
    if (due === null && (t.priority === "urgent" || t.priority === "high")) return true;
    if (due === null && t.scheduled_start && Date.parse(t.scheduled_start) < start) return true; // missed block
    return false;
  });
  return open.sort((a, b) => score(b) - score(a));

  function score(t: Task) {
    let s = PRIORITY_RANK[t.priority] * 10;
    if (t.due_at) {
      const due = Date.parse(t.due_at);
      if (due < start) s += 60;
      else if (due < end) s += 40;
      else s += Math.max(0, 25 - ((due - end) / 86400000) * 8);
    }
    s -= (t.estimated_minutes ?? DEFAULT_TASK_MIN) / 120; // gentle preference for short wins
    return s;
  }
}

export function workWindow(date: string, nowIso: string, timeZone: string, prefs: PlanInput["prefs"]) {
  const ws = zonedTimeToUtc(date, prefs.work_start, timeZone).getTime();
  const we = zonedTimeToUtc(date, prefs.work_end, timeZone).getTime();
  const now = Date.parse(nowIso);
  const start = Math.max(ws, roundUp(now + 5 * 60000));
  return { start, end: we, workStart: ws };
}

export function planDay(input: PlanInput): DayPlan {
  const { date, timeZone, tasks, events, prefs } = input;
  const window = workWindow(date, input.now, timeZone, prefs);
  const candidates = candidateTasks(tasks, date, timeZone);
  const busy = busyForRange(window.start, window.end, events, tasks, new Set(candidates.map((c) => c.id)));
  const blocks: PlanBlock[] = [];
  const unscheduled: DayPlan["unscheduled"] = [];

  if (!candidates.length) {
    return { date, blocks, unscheduled, summary: "Nothing needs scheduling — no tasks are due soon and nothing high-priority is waiting.", source: "heuristic" };
  }
  if (window.end - window.start < 15 * 60000) {
    return {
      date,
      blocks,
      unscheduled: candidates.map((t) => ({ task_id: t.id, reason: "Your working hours for this day have ended" })),
      summary: "Your working hours for this day are over. Plan tomorrow instead, or widen your hours in Settings.",
      source: "heuristic",
    };
  }

  let budget = prefs.daily_focus_minutes;
  const placed: Busy[] = [...busy];

  for (const task of candidates) {
    const minutes = Math.min(task.estimated_minutes ?? DEFAULT_TASK_MIN, MAX_BLOCK_MIN);
    if (minutes > budget) {
      unscheduled.push({ task_id: task.id, reason: "Over your daily focus budget" });
      continue;
    }
    const slot = firstFit(window.start, window.end, minutes, placed);
    if (!slot) {
      unscheduled.push({ task_id: task.id, reason: "No free block long enough today" });
      continue;
    }
    const reason = taskReason(task, zonedParts(new Date(input.now), timeZone).key, timeZone);
    blocks.push({ task_id: task.id, start: new Date(slot.start).toISOString(), end: new Date(slot.end).toISOString(), reason: minutes < (task.estimated_minutes ?? 0) ? `${reason} · first ${minutes} min session` : reason });
    placed.push({ start: slot.start, end: slot.end, label: task.title, kind: "task" });
    placed.sort((a, b) => a.start - b.start);
    budget -= minutes;
  }

  const total = blocks.reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0);
  const fixed = busy.filter((b) => b.kind === "event").length;
  const span = `${to12h(fromMinutes(minutesOfDay(window.start, timeZone)))} and ${to12h(prefs.work_end)}`;
  const summary = blocks.length
    ? `${blocks.length} focus block${blocks.length > 1 ? "s" : ""} (${Math.round(total)} min) between ${span}${fixed ? `, planned around ${fixed} existing commitment${fixed === 1 ? "" : "s"}` : ""}.`
    : "Couldn't fit any tasks into the free time on this day.";
  return { date, blocks, unscheduled, summary, source: "heuristic" };
}

function minutesOfDay(ms: number, timeZone: string) {
  return toMinutes(zonedParts(new Date(ms), timeZone).hhmm);
}

function firstFit(from: number, to: number, minutes: number, busy: Busy[]) {
  const len = minutes * 60000;
  const buf = BUFFER_MIN * 60000;
  let cursor = from;
  for (const b of busy) {
    if (b.end + buf <= cursor) continue;
    if (b.start - buf >= cursor + len && cursor + len <= to) return { start: cursor, end: cursor + len };
    cursor = Math.max(cursor, roundUp(b.end + buf, 5));
  }
  if (cursor + len <= to) return { start: cursor, end: cursor + len };
  return null;
}

/** Validate proposed blocks: in-day, ordered, non-overlapping with fixed commitments and each other. */
export function validateBlocks(
  blocks: PlanBlock[],
  opts: { date: string; timeZone: string; nowIso: string; events: CalendarEvent[]; tasks: Task[] },
) {
  const { start: dayStart, end: dayEnd } = dayBounds(opts.date, opts.timeZone);
  const now = Date.parse(opts.nowIso);
  const taskIds = new Set(opts.tasks.filter((t) => t.status !== "done").map((t) => t.id));
  const planned = new Set(blocks.map((b) => b.task_id));
  const busy = busyForRange(dayStart, dayEnd, opts.events, opts.tasks, planned);
  const accepted: PlanBlock[] = [];
  const rejected: { block: PlanBlock; reason: string }[] = [];
  const seen = new Set<string>();

  for (const b of [...blocks].sort((x, y) => Date.parse(x.start) - Date.parse(y.start))) {
    const s = Date.parse(b.start);
    const e = Date.parse(b.end);
    let reason: string | null = null;
    if (!taskIds.has(b.task_id)) reason = "Unknown or completed task";
    else if (seen.has(b.task_id)) reason = "Task scheduled twice";
    else if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) reason = "Invalid time range";
    else if (s < dayStart || e > dayEnd) reason = "Outside the requested day";
    else if (e - s > MAX_BLOCK_MIN * 60000 + 1) reason = "Block longer than 3 hours";
    else if (s < now - 5 * 60000) reason = "Starts in the past";
    else {
      const clash = findConflicts(s, e, busy).concat(
        accepted.filter((a) => overlaps(s, e, Date.parse(a.start), Date.parse(a.end))).map(() => ({ start: 0, end: 0, label: "another planned block", kind: "task" as const })),
      );
      if (clash.length) reason = `Overlaps ${clash[0].label}`;
    }
    if (reason) rejected.push({ block: b, reason });
    else {
      accepted.push(b);
      seen.add(b.task_id);
    }
  }
  return { accepted, rejected };
}

export interface Slot {
  start: string;
  end: string;
  label: string;
}

/** Free slots for one task within working hours over the next `days` days. */
export function findSlots(opts: {
  task: Task;
  minutes?: number;
  fromDate: string;
  days?: number;
  nowIso: string;
  timeZone: string;
  events: CalendarEvent[];
  tasks: Task[];
  prefs: PlanInput["prefs"];
  limit?: number;
}): Slot[] {
  const minutes = Math.min(opts.minutes ?? opts.task.estimated_minutes ?? DEFAULT_TASK_MIN, MAX_BLOCK_MIN);
  const out: Slot[] = [];
  const days = opts.days ?? 5;
  const deadline = opts.task.due_at ? Date.parse(opts.task.due_at) : Infinity;
  for (let i = 0; i < days && out.length < (opts.limit ?? 4); i++) {
    const date = addDaysKey(opts.fromDate, i);
    const w = workWindow(date, opts.nowIso, opts.timeZone, opts.prefs);
    if (w.end - w.start < minutes * 60000) continue;
    const busy = busyForRange(w.start, w.end, opts.events, opts.tasks, new Set([opts.task.id]));
    const slot = firstFit(w.start, w.end, minutes, busy);
    if (!slot) continue;
    const beforeDeadline = slot.end <= deadline;
    out.push({
      start: new Date(slot.start).toISOString(),
      end: new Date(slot.end).toISOString(),
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : "",
    });
    if (!beforeDeadline) out[out.length - 1].label = `${out[out.length - 1].label} (after deadline)`.trim();
    // also offer an afternoon option on the same day when the first fit is in the morning
    const afternoon = zonedTimeToUtc(date, "13:00", opts.timeZone).getTime();
    if (slot.start < afternoon && out.length < (opts.limit ?? 4)) {
      const pm = firstFit(Math.max(afternoon, w.start), w.end, minutes, busy);
      if (pm) out.push({ start: new Date(pm.start).toISOString(), end: new Date(pm.end).toISOString(), label: i === 0 ? "This afternoon" : "" });
    }
  }
  return out;
}
