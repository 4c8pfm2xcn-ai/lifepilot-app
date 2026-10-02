"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlarmClock, ArrowRight, CalendarClock, CalendarDays, ChevronDown, Clock, Inbox, Lightbulb, Plus, Sparkles, Sun, Target, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityFlag } from "@/components/ui/badge";
import { CheckCircle } from "@/components/ui/checkbox";
import { TaskRow } from "@/components/app/task-row";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { completedToday, focusScore, isOverdue, isTodayTask } from "@/lib/task-utils";
import { addDaysKey, endOfLocalDay, formatDue, formatDuration, formatTime, greeting, localDate, localKey, localTimeZone } from "@/lib/time";
import { busyForRange, candidateTasks } from "@/lib/planner";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/cn";

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface Suggestion {
  id: string;
  icon: typeof Lightbulb;
  tone: "accent" | "warning" | "danger" | "neutral";
  title: string;
  detail: string;
  action: { label: string; run: () => void };
}

export function TodayScreen() {
  const { tasks, events, goals, goal_milestones, inbox_items, profile, toggleTask, deleteTask } = useData();
  const ui = useUI();
  const router = useRouter();
  const now = useNow();
  const [showRest, setShowRest] = useState(false);
  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const todayOpen = useMemo(() => tasks.filter((t) => t.status !== "done" && isTodayTask(t, now)).sort((a, b) => focusScore(b, now) - focusScore(a, now)), [tasks, now]);
  const doneToday = useMemo(() => tasks.filter((t) => completedToday(t, now)), [tasks, now]);

  // Focus: top 3 for today; if today is light, fill with the most important upcoming work.
  const focus = useMemo(() => {
    const picks: Task[] = todayOpen.slice(0, 3);
    if (picks.length < 3) {
      const extra = tasks
        .filter((t) => t.status !== "done" && !picks.includes(t) && (t.priority === "urgent" || t.priority === "high" || (t.due_at && Date.parse(t.due_at) < now.getTime() + 3 * 86400000)))
        .sort((a, b) => focusScore(b, now) - focusScore(a, now));
      picks.push(...extra.slice(0, 3 - picks.length));
    }
    return picks;
  }, [todayOpen, tasks, now]);
  const rest = todayOpen.filter((t) => !focus.includes(t));
  const focusDone = doneToday.filter((t) => isTodayTask({ ...t, status: "todo" }, now)).slice(0, 3);

  const total = todayOpen.length + doneToday.length;
  const progress = total ? doneToday.length / total : 0;
  const minutesDone = doneToday.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0);
  const minutesLeft = todayOpen.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0);

  const upcoming = useMemo(() => {
    const until = endOfLocalDay(localDate(addDaysKey(localKey(now), 1))).getTime();
    const items = [
      ...events.filter((e) => Date.parse(e.end_at) > now.getTime() && Date.parse(e.start_at) < until).map((e) => ({ id: e.id, kind: "event" as const, title: e.title, start: Date.parse(e.start_at), end: Date.parse(e.end_at), allDay: e.all_day })),
      ...tasks.filter((t) => t.status !== "done" && t.scheduled_start && t.scheduled_end && Date.parse(t.scheduled_end) > now.getTime() && Date.parse(t.scheduled_start) < until).map((t) => ({ id: t.id, kind: "task" as const, title: t.title, start: Date.parse(t.scheduled_start!), end: Date.parse(t.scheduled_end!), allDay: false })),
    ];
    return items.sort((a, b) => a.start - b.start).slice(0, 6);
  }, [events, tasks, now]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const overdue = tasks.filter((t) => isOverdue(t, now));
    if (overdue.length) {
      out.push({ id: "overdue", icon: AlarmClock, tone: "danger", title: `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}`, detail: overdue.length === 1 ? `“${overdue[0].title}” slipped past its deadline. Reschedule it or let it go.` : "Pick a new date, schedule them, or let some go — whatever's realistic.", action: { label: "Review", run: () => router.push("/tasks?view=overdue") } });
    }
    const soon = tasks
      .filter((t) => t.status !== "done" && !t.scheduled_start && t.due_at && Date.parse(t.due_at) > now.getTime() && Date.parse(t.due_at) < now.getTime() + 48 * 3600000)
      .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))[0];
    if (soon) out.push({ id: `soon-${soon.id}`, icon: CalendarClock, tone: "warning", title: `“${soon.title}” is due ${formatDue(soon.due_at!, soon.due_all_day, now).replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}`, detail: "It isn't on your calendar yet. Block time so it doesn't sneak up on you.", action: { label: "Find time", run: () => ui.openFindTime(soon.id) } });
    if (profile) {
      const { work_end } = profile.preferences;
      const winStart = Math.max(now.getTime(), localDate(localKey(now), profile.preferences.work_start).getTime());
      const winEnd = localDate(localKey(now), work_end).getTime();
      if (winEnd - winStart > 45 * 60000) {
        const busy = busyForRange(winStart, winEnd, events, tasks);
        let cursor = winStart;
        let best = { start: 0, len: 0 };
        for (const b of busy) {
          if (b.start - cursor > best.len) best = { start: cursor, len: b.start - cursor };
          cursor = Math.max(cursor, b.end);
        }
        if (winEnd - cursor > best.len) best = { start: cursor, len: winEnd - cursor };
        const cands = candidateTasks(tasks, localKey(now), localTimeZone()).filter((t) => !t.scheduled_start);
        if (best.len >= 45 * 60000 && cands.length) {
          out.push({ id: "free", icon: Wand2, tone: "accent", title: `${formatDuration(Math.floor(best.len / 60000 / 15) * 15)} free from ${formatTime(new Date(Math.ceil(best.start / 300000) * 300000))}`, detail: `${cands.length} task${cands.length > 1 ? "s" : ""} could use that time. Let DAYZERO propose a plan.`, action: { label: "Plan my day", run: () => ui.openPlan() } });
        }
      }
    }
    const review = inbox_items.filter((i) => i.processing_status === "needs_review" || i.processing_status === "failed" || i.processing_status === "pending").length;
    if (review) out.push({ id: "inbox", icon: Inbox, tone: "neutral", title: `${review} capture${review > 1 ? "s" : ""} waiting for review`, detail: "Confirm what DAYZERO found so nothing gets lost.", action: { label: "Review", run: () => router.push("/inbox") } });
    const noDeadline = tasks.find((t) => t.status !== "done" && !t.due_at && (t.priority === "urgent" || t.priority === "high"));
    if (noDeadline) out.push({ id: `nodl-${noDeadline.id}`, icon: Lightbulb, tone: "neutral", title: `“${noDeadline.title}” has no date`, detail: "It's marked important. A date — even a rough one — makes it easier to plan.", action: { label: "Set a date", run: () => ui.openTask(noDeadline.id) } });
    const bareGoal = goals.find((g) => g.status === "active" && !goal_milestones.some((m) => m.goal_id === g.id) && !tasks.some((t) => t.goal_id === g.id));
    if (bareGoal) out.push({ id: `goal-${bareGoal.id}`, icon: Target, tone: "neutral", title: `Break down “${bareGoal.title}”`, detail: "Goals move faster with a few concrete milestones.", action: { label: "Open goal", run: () => router.push(`/goals?goal=${bareGoal.id}`) } });
    return out.slice(0, 4);
  }, [tasks, events, goals, goal_milestones, inbox_items, profile, now, router, ui]);

  const nextEvent = upcoming.find((u) => u.kind === "event" && !u.allDay && u.start > now.getTime() && u.start < endOfLocalDay(now).getTime());
  const dueTodayCount = tasks.filter((t) => t.status !== "done" && t.due_at && localKey(new Date(t.due_at)) === localKey(now)).length;
  const subtitle = (() => {
    const parts: string[] = [];
    if (dueTodayCount) parts.push(`${dueTodayCount} thing${dueTodayCount > 1 ? "s" : ""} due today`);
    if (nextEvent) parts.push(`next up: ${nextEvent.title} at ${formatTime(new Date(nextEvent.start))}`);
    if (!parts.length && todayOpen.length) parts.push(`${todayOpen.length} task${todayOpen.length > 1 ? "s" : ""} on your plate`);
    if (!parts.length) return tasks.some((t) => t.status !== "done") ? "Nothing due today — a good day to get ahead." : "A clean slate. Capture what's on your mind.";
    const s = parts.join(" · ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  })();

  const isEmpty = tasks.length === 0 && events.length === 0;

  return (
    <div>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-subtle" suppressHydrationWarning>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]" suppressHydrationWarning>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => ui.openCapture()} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" /> Capture
          </Button>
          <Button variant="primary" onClick={() => ui.openPlan()} data-testid="plan-my-day">
            <Sparkles className="h-4 w-4" /> Plan my day
          </Button>
        </div>
      </header>

      {isEmpty ? (
        <div className="card overflow-hidden">
          <EmptyState
            icon={Sun}
            title="Your day starts here"
            description="Type, paste, snap or say anything that's on your mind — homework, a text from a client, a dentist reminder. DAYZERO will turn it into tasks and plans."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => ui.openCapture()} data-testid="empty-capture">
                  <Plus className="h-4 w-4" /> Capture something
                </Button>
                <Button variant="secondary" onClick={() => ui.openTask()}>
                  Add a task
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="card p-1.5" aria-labelledby="focus-h">
              <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
                <h2 id="focus-h" className="text-sm font-semibold">
                  Today&apos;s focus
                </h2>
                <Link href="/tasks?view=today" className="text-xs text-muted hover:text-fg">
                  All tasks →
                </Link>
              </div>
              {focus.length === 0 && focusDone.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  Nothing pressing today.{" "}
                  <button className="text-accent hover:underline" onClick={() => ui.openTask()}>
                    Add a task
                  </button>{" "}
                  or enjoy the space.
                </div>
              ) : (
                <ol className="space-y-1 p-1.5">
                  <AnimatePresence initial={false}>
                    {focus.map((t, i) => (
                      <FocusCard key={t.id} task={t} index={i} onToggle={toggleTask} onOpen={ui.openTask} todayTask={isTodayTask(t, now)} />
                    ))}
                  </AnimatePresence>
                  {focus.length < 3 &&
                    focusDone.slice(0, 3 - focus.length).map((t, i) => <FocusCard key={t.id} task={t} index={focus.length + i} onToggle={toggleTask} onOpen={ui.openTask} todayTask />)}
                </ol>
              )}
              {rest.length > 0 && (
                <div className="border-t border-line px-1.5 pt-1">
                  <button onClick={() => setShowRest((s) => !s)} className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-fg" aria-expanded={showRest}>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showRest && "rotate-180")} />
                    {rest.length} more for today
                  </button>
                  {showRest && (
                    <ul className="pb-1.5">
                      <AnimatePresence initial={false}>
                        {rest.map((t) => (
                          <TaskRow key={t.id} task={t} goal={t.goal_id ? goalById.get(t.goal_id) : null} onToggle={toggleTask} onOpen={ui.openTask} onDelete={deleteTask} onFindTime={ui.openFindTime} compact />
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="card p-5" aria-labelledby="sugg-h">
              <div className="mb-3 flex items-center gap-2">
                <h2 id="sugg-h" className="text-sm font-semibold">
                  Suggestions
                </h2>
                <span className="text-2xs text-subtle">based on your tasks, deadlines and calendar</span>
              </div>
              {suggestions.length ? (
                <ul className="divide-y divide-line">
                  {suggestions.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", { accent: "bg-accent/10 text-accent", warning: "bg-warning/10 text-warning", danger: "bg-danger/10 text-danger", neutral: "bg-elevated text-muted" }[s.tone])}>
                        <s.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{s.detail}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={s.action.run} className="shrink-0">
                        {s.action.label}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">You&apos;re on top of things. Nothing needs attention right now.</p>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="card flex items-center gap-5 p-5" aria-labelledby="progress-h">
              <ProgressRing value={progress} size={76} stroke={7}>
                <span className="text-lg font-semibold tabular-nums">{Math.round(progress * 100)}%</span>
              </ProgressRing>
              <div className="min-w-0">
                <h2 id="progress-h" className="text-sm font-semibold">
                  Daily progress
                </h2>
                <p className="mt-0.5 text-sm text-muted">{total ? `${doneToday.length} of ${total} done` : "No tasks for today yet"}</p>
                {(minutesDone > 0 || minutesLeft > 0) && (
                  <p className="mt-1 text-xs text-subtle">
                    {minutesDone ? `${formatDuration(minutesDone)} done` : ""}
                    {minutesDone && minutesLeft ? " · " : ""}
                    {minutesLeft ? `${formatDuration(minutesLeft)} left` : ""}
                  </p>
                )}
              </div>
            </section>

            <section className="card p-5" aria-labelledby="upcoming-h">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="upcoming-h" className="text-sm font-semibold">
                  Upcoming
                </h2>
                <Link href="/calendar" className="text-xs text-muted hover:text-fg">
                  Calendar →
                </Link>
              </div>
              {upcoming.length ? (
                <ol className="space-y-3">
                  {upcoming.map((u) => {
                    const live = u.start <= now.getTime() && u.end > now.getTime();
                    const tomorrow = localKey(new Date(u.start)) !== localKey(now);
                    return (
                      <li key={`${u.kind}-${u.id}`}>
                        <button onClick={() => (u.kind === "event" ? ui.openEvent(u.id) : ui.openTask(u.id))} className="flex w-full items-start gap-3 text-left">
                          <span className={cn("mt-1 h-8 w-[3px] shrink-0 rounded-full", u.kind === "task" ? "bg-accent" : "bg-muted/60")} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{u.title}</span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {live ? <span className="font-medium text-accent">Now · </span> : tomorrow ? "Tomorrow · " : ""}
                              {u.allDay ? "All day" : `${formatTime(new Date(u.start))} – ${formatTime(new Date(u.end))}`}
                              {u.kind === "task" && " · focus block"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="flex flex-col items-start gap-2 text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Nothing scheduled through tomorrow.
                  </span>
                  <button onClick={() => ui.openEvent()} className="text-xs text-accent hover:underline">
                    Add an event
                  </button>
                </div>
              )}
            </section>

            <button onClick={() => ui.openCapture()} className="card group flex w-full items-center gap-3 p-4 text-left transition hover:border-line-strong">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent">
                <Plus className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">Quick capture</span>
                <span className="block text-xs text-muted">Text, screenshot or voice — sorted for you</span>
              </span>
              <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-fg" />
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

function FocusCard({ task, index, onToggle, onOpen, todayTask }: { task: Task; index: number; onToggle: (id: string) => void; onOpen: (id: string) => void; todayTask: boolean }) {
  const done = task.status === "done";
  const overdue = isOverdue(task);
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, delay: index * 0.03 }} className={cn("flex items-center gap-3.5 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-line hover:bg-elevated/50", done && "opacity-60")} data-testid="focus-task">
      <span className="w-4 text-center text-xs font-semibold tabular-nums text-subtle">{index + 1}</span>
      <CheckCircle checked={done} onChange={() => onToggle(task.id)} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} size={22} />
      <button onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[15px] font-medium", done && "text-muted line-through")}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {task.due_at && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}>
              <CalendarClock className="h-3 w-3" />
              {overdue ? "Overdue · " : ""}
              {formatDue(task.due_at, task.due_all_day)}
            </span>
          )}
          {task.scheduled_start && !done && (
            <span className="inline-flex items-center gap-1 text-accent">
              <Clock className="h-3 w-3" />
              {formatTime(task.scheduled_start)}
            </span>
          )}
          {task.estimated_minutes ? <span>{formatDuration(task.estimated_minutes)}</span> : null}
          {!todayTask && <span className="text-subtle">Up next</span>}
        </span>
      </button>
      <PriorityFlag priority={task.priority} showLabel={task.priority !== "normal"} />
    </motion.li>
  );
}
