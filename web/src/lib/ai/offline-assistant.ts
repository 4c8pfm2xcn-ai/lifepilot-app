/**
 * Rule-based assistant used when no AI key is configured. It answers common
 * read-only questions directly from the user's data and can propose a small
 * set of actions (create tasks, plan a day) — always through the same
 * confirmation flow as the AI assistant.
 */
import type { UserSnapshot } from "./context";
import type { ClientClock, Task } from "../types";
import { addDaysKey, zonedParts, zonedTimeToUtc } from "../time";
import { heuristicExtract } from "./heuristic-extract";
import { planDay } from "../planner";
import type { RawAction } from "./actions";
import { computeStats, plainWeeklySummary } from "../insights";

const fmtTask = (t: Task, tz: string) => {
  const due = t.due_at ? ` — due ${t.due_all_day ? zonedParts(new Date(t.due_at), tz).key : `${zonedParts(new Date(t.due_at), tz).key} ${zonedParts(new Date(t.due_at), tz).hhmm}`}` : "";
  return `• ${t.title}${t.priority === "urgent" || t.priority === "high" ? ` (${t.priority})` : ""}${due}`;
};

export function offlineAssistant(message: string, snap: UserSnapshot, clock: ClientClock): { reply: string; actions: RawAction[] } {
  const q = message.toLowerCase();
  const tz = clock.timezone;
  const today = clock.today;
  const keyOf = (iso: string) => zonedParts(new Date(iso), tz).key;
  const open = snap.tasks.filter((t) => t.status !== "done");
  const now = Date.parse(clock.now);

  const list = (tasks: Task[], empty: string, heading: string) => (tasks.length ? `${heading}\n${tasks.slice(0, 15).map((t) => fmtTask(t, tz)).join("\n")}${tasks.length > 15 ? `\n…and ${tasks.length - 15} more` : ""}` : empty);

  if (/^(add|create|new|remind me|remember|i need to|todo)/.test(q.trim())) {
    const extraction = heuristicExtract(message.trim().replace(/^(?:please\s+)?(?:add|create|new)\s+(?:an?\s+)?(?:(?:task|todo|reminder)s?\s*(?:to\s+|:\s*)?)?/i, ""), { today });
    const actions: RawAction[] = extraction.items
      .filter((i) => i.kind === "task" || i.kind === "note")
      .map((i) => ({ type: "create_task", title: i.title, category: i.category, priority: i.priority, due_date: i.date, due_time: i.time, estimated_minutes: i.estimated_minutes }));
    return { reply: actions.length ? "I can add these — confirm below." : "I couldn't find a task in that. Try “Add call the dentist tomorrow”.", actions };
  }

  if (/overdue|late|behind|missed/.test(q)) {
    const overdue = open.filter((t) => t.due_at && (t.due_all_day ? keyOf(t.due_at) < today : Date.parse(t.due_at) < now));
    return { reply: list(overdue, "Nothing is overdue. 👌", `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}:`), actions: [] };
  }

  if (/(plan|organi[sz]e|schedule).*(day|today|afternoon|morning|tomorrow)/.test(q)) {
    const date = /tomorrow/.test(q) ? addDaysKey(today, 1) : today;
    let nowIso = clock.now;
    if (/afternoon/.test(q)) nowIso = new Date(Math.max(now, zonedTimeToUtc(date, "12:30", tz).getTime())).toISOString();
    const plan = planDay({ date, now: nowIso, timeZone: tz, tasks: snap.tasks, events: snap.events, prefs: snap.preferences });
    const actions: RawAction[] = plan.blocks.map((b) => ({ type: "schedule_task", task_id: b.task_id, start: b.start, end: b.end }));
    return { reply: plan.blocks.length ? `Here's a proposed plan for ${date === today ? "today" : "tomorrow"}. ${plan.summary} Review each block and confirm the ones you want.` : plan.summary, actions };
  }

  if (/this week|week/.test(q) && /(finish|do|due|need)/.test(q)) {
    const end = addDaysKey(today, 7 - ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    const due = open.filter((t) => t.due_at && keyOf(t.due_at) < end).sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
    return { reply: list(due, "Nothing has a deadline for the rest of this week.", `Due by the end of the week (${due.length}):`), actions: [] };
  }

  if (/tomorrow/.test(q)) {
    const tmr = addDaysKey(today, 1);
    const due = open.filter((t) => t.due_at && keyOf(t.due_at) === tmr);
    const events = snap.events.filter((e) => keyOf(e.start_at) === tmr);
    return { reply: `${list(due, "No tasks are due tomorrow.", `Due tomorrow (${due.length}):`)}${events.length ? `\n\nEvents tomorrow:\n${events.map((e) => `• ${e.title} at ${zonedParts(new Date(e.start_at), tz).hhmm}`).join("\n")}` : ""}`, actions: [] };
  }

  if (/today|focus|priorit/.test(q) && !/captur/.test(q)) {
    const due = open.filter((t) => t.due_at && keyOf(t.due_at) <= today);
    const events = snap.events.filter((e) => keyOf(e.start_at) === today);
    return { reply: `${list(due, "Nothing is due today.", `Due today or earlier (${due.length}):`)}${events.length ? `\n\nOn your calendar today:\n${events.map((e) => `• ${e.title} at ${zonedParts(new Date(e.start_at), tz).hhmm}`).join("\n")}` : ""}`, actions: [] };
  }

  if (/captur|inbox/.test(q)) {
    const items = snap.inbox.filter((i) => keyOf(i.created_at) === today);
    return { reply: items.length ? `You captured ${items.length} item${items.length === 1 ? "" : "s"} today:\n${items.map((i) => `• ${i.extracted_data?.summary ? i.extracted_data.summary : i.original_content.slice(0, 90) || "(image)"}`).join("\n")}` : "You haven't captured anything today.", actions: [] };
  }

  if (/summar|how am i doing|progress|insight/.test(q)) {
    const stats = computeStats(snap.tasks, snap.goals, snap.milestones, clock.now, tz, snap.preferences.week_starts_on);
    return { reply: plainWeeklySummary(stats), actions: [] };
  }

  if (/break|smaller steps|subtask/.test(q)) {
    return { reply: "Breaking projects into steps needs the AI model, which isn't configured on this server. You can add subtasks manually from any task's detail view.", actions: [] };
  }

  return {
    reply:
      "I'm running in offline mode (no AI key configured), so I understand a limited set of requests:\n• “What's overdue?”\n• “What do I need to finish this week?”\n• “Plan my day” / “Help me plan my afternoon”\n• “What's due tomorrow?”\n• “Summarize everything I captured today”\n• “Add call the supplier Friday”",
    actions: [],
  };
}
