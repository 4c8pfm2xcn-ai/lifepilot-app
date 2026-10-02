"use client";
import { AlertCircle, CalendarDays, Lock, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { useSnapshotSource } from "@/hooks/use-snapshot";
import { ApiError, postApi } from "@/lib/client-api";
import { addDaysKey, formatDuration, formatTime, localDate, localKey, localTimeZone } from "@/lib/time";
import { dayBounds, validateBlocks } from "@/lib/planner";
import type { DayPlan } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CheckCircle } from "@/components/ui/checkbox";
import { SourceBadge } from "./source-badge";

type Row = { kind: "event" | "fixed" | "block"; id: string; title: string; start: number; end: number; reason?: string };

export function PlanDayDialog() {
  const ui = useUI();
  const { tasks, events, profile, updateTask } = useData();
  const src = useSnapshotSource();
  const { toast } = useToast();
  const today = localKey();
  const [which, setWhich] = useState<"today" | "tomorrow">("today");
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = which === "today" ? today : addDaysKey(today, 1);

  useEffect(() => {
    if (!ui.plan.open) return;
    const pastWork = profile && new Date() > localDate(today, profile.preferences.work_end);
    setWhich(ui.plan.date === addDaysKey(today, 1) || (!ui.plan.date && (pastWork || profile?.preferences.planning_time === "evening")) ? "tomorrow" : "today");
    setPlan(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.plan.open]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await postApi<{ plan: DayPlan }>("/api/ai/plan", { date }, src);
      setPlan(res.plan);
      setSelected(new Set(res.plan.blocks.map((b) => b.task_id)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't generate a plan.");
    } finally {
      setLoading(false);
    }
  }, [date, src]);

  useEffect(() => {
    if (ui.plan.open) generate();
    // regenerate only when the dialog opens or the day changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.plan.open, date]);

  const rows = useMemo<Row[]>(() => {
    if (!plan) return [];
    const { start, end } = dayBounds(date, localTimeZone());
    const planned = new Set(plan.blocks.map((b) => b.task_id));
    const r: Row[] = [
      ...events.filter((e) => !e.all_day && Date.parse(e.end_at) > start && Date.parse(e.start_at) < end).map((e) => ({ kind: "event" as const, id: e.id, title: e.title, start: Date.parse(e.start_at), end: Date.parse(e.end_at) })),
      ...tasks
        .filter((t) => t.status !== "done" && !planned.has(t.id) && t.scheduled_start && t.scheduled_end && Date.parse(t.scheduled_start) < end && Date.parse(t.scheduled_end) > start)
        .map((t) => ({ kind: "fixed" as const, id: t.id, title: t.title, start: Date.parse(t.scheduled_start!), end: Date.parse(t.scheduled_end!) })),
      ...plan.blocks.map((b) => ({ kind: "block" as const, id: b.task_id, title: tasks.find((t) => t.id === b.task_id)?.title ?? "Task", start: Date.parse(b.start), end: Date.parse(b.end), reason: b.reason })),
    ];
    return r.sort((a, b) => a.start - b.start);
  }, [plan, events, tasks, date]);

  const apply = async () => {
    if (!plan) return;
    setApplying(true);
    const chosen = plan.blocks.filter((b) => selected.has(b.task_id));
    // re-validate against the latest data in case anything changed since the plan was generated
    const { accepted, rejected } = validateBlocks(chosen, { date, timeZone: localTimeZone(), nowIso: new Date(Date.now() - 4 * 60000).toISOString(), events, tasks });
    let ok = 0;
    for (const b of accepted) if (await updateTask(b.task_id, { scheduled_start: b.start, scheduled_end: b.end })) ok++;
    setApplying(false);
    toast(`Scheduled ${ok} task${ok === 1 ? "" : "s"}${rejected.length ? ` · skipped ${rejected.length} that now conflict` : ""}`, { tone: ok ? "success" : "default" });
    ui.closePlan();
  };

  const totalMin = plan ? plan.blocks.filter((b) => selected.has(b.task_id)).reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0) : 0;

  return (
    <Dialog
      open={ui.plan.open}
      onClose={ui.closePlan}
      title="Plan my day"
      description="A proposed schedule. Nothing changes until you apply it — existing events are never moved."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={generate} disabled={loading} className="mr-auto">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Regenerate
          </Button>
          <Button variant="ghost" onClick={ui.closePlan}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply} loading={applying} disabled={!plan || selected.size === 0 || loading} data-testid="apply-plan">
            Apply {selected.size || ""} block{selected.size === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            label="Day to plan"
            value={which}
            onChange={setWhich}
            options={[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
            ]}
          />
          {plan && <SourceBadge source={plan.source} />}
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted" role="status">
            <Spinner className="h-5 w-5 text-accent" />
            Looking at your tasks, deadlines and calendar…
          </div>
        )}
        {error && !loading && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-danger" />
            <div className="flex-1">
              <p>{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={generate}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {plan && !loading && (
          <>
            <p className="text-sm text-muted">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-accent" />
              {plan.summary}
            </p>
            {plan.notice && <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">{plan.notice}</p>}

            {rows.length > 0 ? (
              <ol className="relative space-y-1.5" aria-label={`Proposed schedule for ${date}`}>
                {rows.map((r) => {
                  const isBlock = r.kind === "block";
                  const on = isBlock && selected.has(r.id);
                  return (
                    <li key={`${r.kind}-${r.id}`} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", isBlock ? (on ? "border-accent/30 bg-accent/5" : "border-line bg-surface opacity-60") : "border-line bg-surface/50")}>
                      <div className="w-[88px] shrink-0 pt-0.5 text-xs tabular-nums text-muted">
                        {formatTime(new Date(r.start))}
                        <span className="block text-subtle">{formatDuration(Math.round((r.end - r.start) / 60000))}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{isBlock ? r.reason : r.kind === "event" ? "Calendar event · fixed" : "Already scheduled · fixed"}</p>
                      </div>
                      {isBlock ? (
                        <CheckCircle
                          checked={on}
                          label={on ? `Exclude ${r.title}` : `Include ${r.title}`}
                          onChange={() =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (n.has(r.id)) n.delete(r.id);
                              else n.add(r.id);
                              return n;
                            })
                          }
                        />
                      ) : (
                        <Lock className="mt-0.5 h-3.5 w-3.5 text-subtle" aria-label="Fixed" />
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
                <CalendarDays className="h-5 w-5" />
                Nothing to place on this day.
              </div>
            )}

            {plan.unscheduled.length > 0 && (
              <div>
                <h3 className="label mb-1.5">Not scheduled</h3>
                <ul className="space-y-1 text-sm">
                  {plan.unscheduled.map((u) => (
                    <li key={u.task_id} className="flex justify-between gap-3 text-muted">
                      <span className="truncate text-fg/80">{tasks.find((t) => t.id === u.task_id)?.title ?? "Task"}</span>
                      <span className="shrink-0 text-xs">{u.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.blocks.length > 0 && <p className="text-xs text-subtle">{formatDuration(Math.round(totalMin))} of focused work selected.</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}
