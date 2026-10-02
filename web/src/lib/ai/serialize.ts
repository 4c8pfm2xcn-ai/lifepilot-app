/** Compact, timezone-aware text rendering of user data for prompts. */
import type { CalendarEvent, Goal, GoalMilestone, InboxItem, Task } from "../types";
import { zonedParts } from "../time";

function when(iso: string, tz: string) {
  const p = zonedParts(new Date(iso), tz);
  return `${p.key} ${p.hhmm}`;
}

export function taskLine(t: Task, tz: string) {
  const parts = [`id=${t.id}`, `"${t.title.replace(/"/g, "'")}"`, t.category, `priority=${t.priority}`, `status=${t.status}`];
  if (t.due_at) parts.push(`due=${t.due_all_day ? zonedParts(new Date(t.due_at), tz).key + " (date only)" : when(t.due_at, tz)}`);
  if (t.estimated_minutes) parts.push(`est=${t.estimated_minutes}m`);
  if (t.scheduled_start && t.scheduled_end) parts.push(`scheduled=${when(t.scheduled_start, tz)}→${zonedParts(new Date(t.scheduled_end), tz).hhmm}`);
  if (t.goal_id) parts.push(`goal=${t.goal_id}`);
  if (t.subtasks?.length) parts.push(`subtasks=${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length} done`);
  if (t.completed_at) parts.push(`completed=${when(t.completed_at, tz)}`);
  if (t.description) parts.push(`notes="${t.description.slice(0, 160).replace(/\s+/g, " ")}"`);
  return `- ${parts.join(" | ")}`;
}

export function eventLine(e: CalendarEvent, tz: string) {
  const span = e.all_day ? `${zonedParts(new Date(e.start_at), tz).key} (all day)` : `${when(e.start_at, tz)}→${zonedParts(new Date(e.end_at), tz).hhmm}`;
  return `- id=${e.id} | "${e.title.replace(/"/g, "'")}" | ${span}${e.location ? ` | at ${e.location}` : ""}`;
}

export function goalLine(g: Goal, milestones: GoalMilestone[], tasks: Task[]) {
  const ms = milestones.filter((m) => m.goal_id === g.id);
  const ts = tasks.filter((t) => t.goal_id === g.id);
  return `- id=${g.id} | "${g.title}" | ${g.category} | status=${g.status}${g.target_date ? ` | target=${g.target_date}` : ""} | milestones ${ms.filter((m) => m.completed).length}/${ms.length} | linked tasks ${ts.filter((t) => t.status === "done").length}/${ts.length}${ms.length ? ` | milestone titles: ${ms.map((m) => `${m.completed ? "✓" : "○"} ${m.title}`).join("; ")}` : ""}`;
}

export function inboxLine(i: InboxItem, tz: string) {
  const text = i.original_content ? i.original_content.slice(0, 200).replace(/\s+/g, " ") : "(image)";
  return `- ${when(i.created_at, tz)} | ${i.content_type} | status=${i.processing_status}${i.resolution ? `/${i.resolution}` : ""} | "${text}"${i.extracted_data?.summary ? ` | understood: ${i.extracted_data.summary}` : ""}`;
}
