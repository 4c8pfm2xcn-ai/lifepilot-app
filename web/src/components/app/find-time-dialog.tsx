"use client";
import { CalendarCheck, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { busyForRange, findConflicts, findSlots } from "@/lib/planner";
import { formatDuration, formatTimeRange, localDate, localKey, localTimeZone } from "@/lib/time";
import { describeConflicts } from "./event-editor";
import { cn } from "@/lib/cn";

/** Suggests conflict-free slots for a task, or lets the user pick one manually with conflict explanation. */
export function FindTimeDialog() {
  const ui = useUI();
  const { tasks, events, profile, updateTask } = useData();
  const task = ui.findTime.taskId ? tasks.find((t) => t.id === ui.findTime.taskId) : null;
  const [minutes, setMinutes] = useState<number | null>(null);
  const [manual, setManual] = useState({ date: "", time: "" });
  const [forceConflict, setForceConflict] = useState(false);
  const duration = minutes ?? task?.estimated_minutes ?? 30;

  const slots = useMemo(() => {
    if (!task || !profile || !ui.findTime.open) return [];
    return findSlots({ task, minutes: duration, fromDate: localKey(), days: 7, nowIso: new Date().toISOString(), timeZone: localTimeZone(), events, tasks, prefs: profile.preferences, limit: 6 });
  }, [task, profile, events, tasks, duration, ui.findTime.open]);

  const manualRange = manual.date && manual.time ? { start: localDate(manual.date, manual.time), end: new Date(localDate(manual.date, manual.time).getTime() + duration * 60000) } : null;
  const manualConflicts = manualRange && task ? findConflicts(manualRange.start.getTime(), manualRange.end.getTime(), busyForRange(manualRange.start.getTime(), manualRange.end.getTime(), events, tasks, new Set([task.id]))) : [];

  const close = () => {
    ui.closeFindTime();
    setMinutes(null);
    setManual({ date: "", time: "" });
    setForceConflict(false);
  };

  const schedule = async (start: string, end: string) => {
    if (!task) return;
    const ok = await updateTask(task.id, { scheduled_start: start, scheduled_end: end, estimated_minutes: task.estimated_minutes ?? duration });
    if (ok) close();
  };

  return (
    <Dialog open={ui.findTime.open && !!task} onClose={close} title={task?.scheduled_start ? "Reschedule task" : "Find a time"} description={task ? <span className="text-fg/90">{task.title}</span> : null}>
      {task && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <label htmlFor="ft-duration" className="text-xs font-medium text-muted">
              Duration
            </label>
            <Select id="ft-duration" value={duration} onChange={(e) => setMinutes(Number(e.target.value))} className="h-8 w-32 text-xs">
              {[15, 30, 45, 60, 90, 120, 180].concat(task.estimated_minutes && ![15, 30, 45, 60, 90, 120, 180].includes(task.estimated_minutes) ? [Math.min(180, task.estimated_minutes)] : []).map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </Select>
          </div>

          <section aria-labelledby="ft-suggested">
            <h3 id="ft-suggested" className="label mb-2">
              Suggested times · within your working hours, no conflicts
            </h3>
            {slots.length ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {slots.map((s) => (
                  <li key={s.start}>
                    <button type="button" onClick={() => schedule(s.start, s.end)} className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-accent/5">
                      <CalendarCheck className="h-4 w-4 shrink-0 text-accent" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{new Date(s.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                        <span className="block text-xs text-muted">
                          {formatTimeRange(s.start, s.end)} {s.label && <span className={cn(s.label.includes("deadline") && "text-warning")}>· {s.label}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-line bg-surface px-3 py-3 text-sm text-muted">No free block of {formatDuration(duration)} in your working hours this week. Pick a time manually below or shorten the duration.</p>
            )}
          </section>

          <section aria-labelledby="ft-manual" className="space-y-2">
            <h3 id="ft-manual" className="label">
              Or choose a time
            </h3>
            <div className="flex flex-wrap gap-2">
              <Input type="date" aria-label="Date" value={manual.date} onChange={(e) => (setManual((m) => ({ ...m, date: e.target.value })), setForceConflict(false))} className="w-40" />
              <Input type="time" aria-label="Start time" value={manual.time} onChange={(e) => (setManual((m) => ({ ...m, time: e.target.value })), setForceConflict(false))} className="w-32" />
              <Button
                variant={manualConflicts.length && !forceConflict ? "outline" : "primary"}
                disabled={!manualRange}
                onClick={() => {
                  if (!manualRange) return;
                  if (manualConflicts.length && !forceConflict) {
                    setForceConflict(true);
                    return;
                  }
                  schedule(manualRange.start.toISOString(), manualRange.end.toISOString());
                }}
              >
                <Clock className="h-3.5 w-3.5" /> {manualConflicts.length && forceConflict ? "Schedule anyway" : "Schedule"}
              </Button>
            </div>
            {manualConflicts.length > 0 && (
              <p role="alert" className="text-xs text-warning">
                Conflict: this overlaps {describeConflicts(manualConflicts)}.{forceConflict ? " Press “Schedule anyway” to double-book." : ""}
              </p>
            )}
          </section>

          {task.scheduled_start && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (await updateTask(task.id, { scheduled_start: null, scheduled_end: null })) close();
              }}
            >
              Remove from calendar
            </Button>
          )}
        </div>
      )}
    </Dialog>
  );
}
