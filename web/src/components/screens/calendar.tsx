"use client";
import dynamic from "next/dynamic";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Clock, GripVertical, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/checkbox";
import { PriorityFlag } from "@/components/ui/badge";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { formatDue, formatDuration, formatTimeRange } from "@/lib/time";
import { sortTasks } from "@/lib/task-utils";
import { busyForRange, findConflicts } from "@/lib/planner";
import { describeConflicts } from "@/components/app/event-editor";
import type { CalendarHandle, CalView, PendingMove } from "./calendar-view";

const CalendarView = dynamic(() => import("./calendar-view").then((m) => m.CalendarView), {
  ssr: false,
  loading: () => <Skeleton className="h-[640px] w-full" />,
});

export function CalendarScreen() {
  const { tasks, events, updateEvent, updateTask } = useData();
  const ui = useUI();
  const calRef = useRef<CalendarHandle>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [view, setView] = useState<CalView>("timeGridWeek");
  const [title, setTitle] = useState("");
  const [showDeadlines, setShowDeadlines] = useState(true);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);

  useEffect(() => {
    // Agenda is the natural default on phones.
    if (window.matchMedia("(max-width: 767px)").matches) setView("listWeek");
  }, []);

  const unscheduled = useMemo(() => sortTasks(tasks.filter((t) => t.status !== "done" && !t.scheduled_start), "smart").slice(0, 30), [tasks]);
  const openTasks = useMemo(() => sortTasks(tasks.filter((t) => t.status !== "done"), "smart"), [tasks]);

  const selConflicts = useMemo(() => (selection && !selection.allDay ? findConflicts(selection.start.getTime(), selection.end.getTime(), busyForRange(selection.start.getTime(), selection.end.getTime(), events, tasks)) : []), [selection, events, tasks]);

  const confirmMove = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    const ok = p.kind === "event" ? await updateEvent(p.id, { start_at: p.start.toISOString(), end_at: p.end.toISOString(), all_day: false }) : await updateTask(p.id, { scheduled_start: p.start.toISOString(), scheduled_end: p.end.toISOString() });
    if (!ok) p.revert();
  };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Calendar</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => ui.openPlan()}>
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Plan my day</span>
            <span className="sm:hidden">Plan</span>
          </Button>
          <Button variant="primary" onClick={() => ui.openEvent()} data-testid="new-event">
            <CalendarPlus className="h-4 w-4" /> New event
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => calRef.current?.prev()} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => calRef.current?.today()}>
            Today
          </Button>
          <Button size="icon" variant="ghost" onClick={() => calRef.current?.next()} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-sm font-semibold sm:text-base" aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="hidden items-center gap-2 text-xs text-muted sm:flex">
            <Toggle label="Show deadlines" checked={showDeadlines} onChange={setShowDeadlines} />
            Deadlines
          </label>
          <Segmented
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: "dayGridMonth", label: "Month" },
              { value: "timeGridWeek", label: "Week" },
              { value: "timeGridDay", label: "Day" },
              { value: "listWeek", label: "Agenda" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card min-w-0 overflow-hidden p-1 sm:p-2">
          <CalendarView ref={calRef} view={view} showDeadlines={showDeadlines} onTitle={setTitle} onConflict={setPending} onSelectRange={(start, end, allDay) => setSelection({ start, end, allDay })} externalRef={listRef} />
        </div>

        <aside className="card h-fit p-4" aria-labelledby="unsched-h">
          <h2 id="unsched-h" className="text-sm font-semibold">
            Unscheduled tasks
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            <span className="hidden xl:inline">Drag onto the calendar or </span>
            <span className="xl:hidden">Tap </span>use “Find time”.
          </p>
          <ul ref={listRef} className="max-h-[520px] space-y-1.5 overflow-y-auto">
            {unscheduled.length === 0 && <li className="text-xs text-subtle">Every open task has a time. Nice.</li>}
            {unscheduled.map((t) => (
              <li key={t.id} data-drag-task={t.id} className="group flex cursor-grab items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 active:cursor-grabbing">
                <GripVertical className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-subtle xl:block" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <button onClick={() => ui.openTask(t.id)} className="block w-full truncate text-left text-xs font-medium" title={t.title}>
                    {t.title}
                  </button>
                  <div className="mt-1 flex items-center gap-2 text-2xs text-subtle">
                    <span>{t.estimated_minutes ? formatDuration(t.estimated_minutes) : "30m"}</span>
                    {t.due_at && <span className="truncate">due {formatDue(t.due_at, t.due_all_day)}</span>}
                    <PriorityFlag priority={t.priority} />
                    <button onClick={() => ui.openFindTime(t.id)} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 font-medium text-muted hover:bg-elevated hover:text-fg">
                      <Clock className="h-3 w-3" /> Find time
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <Dialog
        open={!!pending}
        onClose={() => {
          pending?.revert();
          setPending(null);
        }}
        title="Scheduling conflict"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                pending?.revert();
                setPending(null);
              }}
            >
              Keep original time
            </Button>
            <Button variant="primary" onClick={confirmMove}>
              Move anyway
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex gap-3 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="text-muted">
              Moving <span className="font-medium text-fg">“{pending.title}”</span> to {pending.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, {formatTimeRange(pending.start.toISOString(), pending.end.toISOString())} would overlap {describeConflicts(pending.conflicts)}. Nothing else will be moved.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog open={!!selection} onClose={() => setSelection(null)} title="Add to calendar" size="sm" description={selection ? `${selection.start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}${selection.allDay ? "" : ` · ${formatTimeRange(selection.start.toISOString(), selection.end.toISOString())}`}` : ""}>
        {selection && (
          <div className="space-y-4">
            {selConflicts.length > 0 && (
              <p role="alert" className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> This time overlaps {describeConflicts(selConflicts)}.
              </p>
            )}
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                const s = selection;
                setSelection(null);
                ui.openEvent({ start_at: s.start.toISOString(), end_at: s.end.toISOString(), all_day: s.allDay });
              }}
            >
              <CalendarPlus className="h-4 w-4" /> New event here
            </Button>
            {!selection.allDay && openTasks.length > 0 && (
              <div>
                <p className="label mb-2">Or block time for a task</p>
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {openTasks.slice(0, 20).map((t) => (
                    <li key={t.id}>
                      <button
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-elevated"
                        onClick={async () => {
                          const s = selection;
                          setSelection(null);
                          await updateTask(t.id, { scheduled_start: s.start.toISOString(), scheduled_end: s.end.toISOString() });
                        }}
                      >
                        <span className="truncate">{t.title}</span>
                        {t.scheduled_start && <span className="shrink-0 text-2xs text-subtle">moves block</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
