/**
 * Productivity statistics computed purely from stored records.
 * Shared by the Insights screen and the weekly-summary API route.
 */
import type { Category, Goal, GoalMilestone, Task } from "./types";
import { CATEGORIES } from "./types";
import { addDaysKey, weekdayOfKey, zonedParts, zonedTimeToUtc } from "./time";

export interface GoalProgress {
  goal: Goal;
  done: number;
  total: number;
  ratio: number;
}

export function goalProgress(goal: Goal, milestones: GoalMilestone[], tasks: Task[]): GoalProgress {
  const ms = milestones.filter((m) => m.goal_id === goal.id);
  const ts = tasks.filter((t) => t.goal_id === goal.id);
  const total = ms.length + ts.length;
  const done = ms.filter((m) => m.completed).length + ts.filter((t) => t.status === "done").length;
  const ratio = goal.status === "completed" ? 1 : total ? done / total : 0;
  return { goal, done, total, ratio };
}

export function weekStartKey(todayKey: string, weekStartsOn: 0 | 1) {
  const wd = weekdayOfKey(todayKey);
  const back = (wd - weekStartsOn + 7) % 7;
  return addDaysKey(todayKey, -back);
}

export interface Stats {
  weekStart: string;
  completedThisWeek: number;
  completedLastWeek: number;
  minutesCompletedThisWeek: number;
  openCount: number;
  overdueCount: number;
  dueNext7: number;
  minutesDueNext7: number;
  weeklyTrend: { weekStart: string; label: string; completed: number }[];
  dailyThisWeek: { date: string; label: string; completed: number; created: number }[];
  upcoming: { date: string; label: string; due: number; minutes: number }[];
  categories: { category: Category; open: number; done: number }[];
  goals: GoalProgress[];
  topCompleted: Task[];
}

export function computeStats(tasks: Task[], goals: Goal[], milestones: GoalMilestone[], nowIso: string, tz: string, weekStartsOn: 0 | 1): Stats {
  const now = new Date(nowIso);
  const today = zonedParts(now, tz).key;
  const ws = weekStartKey(today, weekStartsOn);
  const keyOf = (iso: string) => zonedParts(new Date(iso), tz).key;
  const startOfToday = zonedTimeToUtc(today, "00:00", tz).getTime();

  const done = tasks.filter((t) => t.status === "done" && t.completed_at);
  const open = tasks.filter((t) => t.status !== "done");
  const inRange = (k: string, from: string, toExcl: string) => k >= from && k < toExcl;

  const thisWeek = done.filter((t) => inRange(keyOf(t.completed_at!), ws, addDaysKey(ws, 7)));
  const lastWeek = done.filter((t) => inRange(keyOf(t.completed_at!), addDaysKey(ws, -7), ws));

  const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
    const start = addDaysKey(ws, -7 * (7 - i));
    const end = addDaysKey(start, 7);
    const d = new Date(`${start}T12:00:00Z`);
    return { weekStart: start, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), completed: done.filter((t) => inRange(keyOf(t.completed_at!), start, end)).length };
  });

  const dailyThisWeek = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(ws, i);
    return {
      date,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      completed: done.filter((t) => keyOf(t.completed_at!) === date).length,
      created: tasks.filter((t) => keyOf(t.created_at) === date).length,
    };
  });

  const upcoming = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(today, i);
    const due = open.filter((t) => t.due_at && keyOf(t.due_at) === date);
    return {
      date,
      label: i === 0 ? "Today" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      due: due.length,
      minutes: due.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0),
    };
  });

  const overdue = open.filter((t) => t.due_at && (t.due_all_day ? keyOf(t.due_at) < today : Date.parse(t.due_at) < now.getTime()));
  const next7End = addDaysKey(today, 7);
  const dueSoon = open.filter((t) => t.due_at && Date.parse(t.due_at) >= startOfToday && keyOf(t.due_at) < next7End);

  return {
    weekStart: ws,
    completedThisWeek: thisWeek.length,
    completedLastWeek: lastWeek.length,
    minutesCompletedThisWeek: thisWeek.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0),
    openCount: open.length,
    overdueCount: overdue.length,
    dueNext7: dueSoon.length,
    minutesDueNext7: dueSoon.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0),
    weeklyTrend,
    dailyThisWeek,
    upcoming,
    categories: CATEGORIES.map((c) => ({ category: c, open: open.filter((t) => t.category === c).length, done: thisWeek.filter((t) => t.category === c).length })).filter((c) => c.open || c.done),
    goals: goals.filter((g) => g.status !== "archived").map((g) => goalProgress(g, milestones, tasks)),
    topCompleted: thisWeek.sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!)).slice(0, 12),
  };
}

/** Deterministic weekly summary used when AI is unavailable. Built only from real numbers. */
export function plainWeeklySummary(s: Stats) {
  const lines: string[] = [];
  if (s.completedThisWeek === 0) lines.push("No tasks completed yet this week.");
  else {
    const diff = s.completedThisWeek - s.completedLastWeek;
    lines.push(`You completed ${s.completedThisWeek} task${s.completedThisWeek === 1 ? "" : "s"} this week${s.minutesCompletedThisWeek ? ` (about ${Math.round(s.minutesCompletedThisWeek / 6) / 10}h of estimated work)` : ""}${s.completedLastWeek || diff ? `, ${diff === 0 ? "the same as" : diff > 0 ? `${diff} more than` : `${-diff} fewer than`} last week` : ""}.`);
  }
  const topCat = [...s.categories].sort((a, b) => b.done - a.done)[0];
  if (topCat?.done) lines.push(`Most of your finished work was ${topCat.category}.`);
  if (s.overdueCount) lines.push(`${s.overdueCount} task${s.overdueCount === 1 ? " is" : "s are"} past due — worth rescheduling or letting go.`);
  if (s.dueNext7) lines.push(`${s.dueNext7} task${s.dueNext7 === 1 ? " is" : "s are"} due in the next 7 days${s.minutesDueNext7 ? ` (~${Math.round(s.minutesDueNext7 / 6) / 10}h estimated)` : ""}.`);
  const busiest = [...s.upcoming].sort((a, b) => b.minutes - a.minutes || b.due - a.due)[0];
  if (busiest?.due > 1) lines.push(`${busiest.label} looks like your heaviest day ahead.`);
  const active = s.goals.filter((g) => g.goal.status === "active");
  if (active.length) lines.push(`${active.length} active goal${active.length === 1 ? "" : "s"}, averaging ${Math.round((active.reduce((a, g) => a + g.ratio, 0) / active.length) * 100)}% progress.`);
  return lines.join(" ");
}
