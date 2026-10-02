"use client";
import dynamic from "next/dynamic";
import { AlarmClock, BarChart3, CalendarRange, CheckCircle2, ListTodo, RefreshCw, Sparkles, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/spinner";
import { PageHeader } from "@/components/app/page-header";
import { SourceBadge } from "@/components/app/source-badge";
import { useData } from "@/providers/data-provider";
import { useSnapshotSource } from "@/hooks/use-snapshot";
import { computeStats } from "@/lib/insights";
import { ApiError, postApi } from "@/lib/client-api";
import { formatDuration, localTimeZone } from "@/lib/time";
import { cn } from "@/lib/cn";

const BarChartCard = dynamic(() => import("./insights-chart").then((m) => m.SimpleBarChart), { ssr: false, loading: () => <Skeleton className="h-[180px] w-full" /> });

interface Summary {
  headline: string;
  summary: string;
  suggestion: string | null;
  source: "ai" | "computed";
  notice?: string;
}

export function InsightsScreen() {
  const { tasks, goals, goal_milestones, profile } = useData();
  const src = useSnapshotSource();
  const [asTable, setAsTable] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const stats = useMemo(() => computeStats(tasks, goals, goal_milestones, new Date().toISOString(), localTimeZone(), profile?.preferences.week_starts_on ?? 1), [tasks, goals, goal_milestones, profile]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      setSummary(await postApi<Summary>("/api/ai/summary", {}, src));
    } catch (e) {
      setSummaryError(e instanceof ApiError ? e.message : "Couldn't generate a summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (tasks.length) loadSummary();
    // generate once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tasks.length === 0) {
    return (
      <div>
        <PageHeader title="Insights" />
        <div className="card">
          <EmptyState icon={BarChart3} title="Nothing to measure yet" description="Insights are calculated from your real tasks and goals. Add and complete a few tasks and patterns will appear here." />
        </div>
      </div>
    );
  }

  const diff = stats.completedThisWeek - stats.completedLastWeek;
  const maxCat = Math.max(1, ...stats.categories.map((c) => c.open + c.done));

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="A look at how your week is going — calculated from your own records."
        actions={
          <Button variant="outline" size="sm" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />} {asTable ? "Show charts" : "Show as tables"}
          </Button>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <Stat icon={CheckCircle2} label="Completed this week" value={stats.completedThisWeek} hint={stats.completedLastWeek || diff ? `${diff === 0 ? "Same as" : diff > 0 ? `${diff} more than` : `${-diff} fewer than`} last week` : "First week of data"} />
        <Stat icon={AlarmClock} label="Overdue" value={stats.overdueCount} hint={stats.overdueCount ? "Worth a look" : "All on track"} tone={stats.overdueCount ? "warning" : undefined} />
        <Stat icon={CalendarRange} label="Due next 7 days" value={stats.dueNext7} hint={stats.minutesDueNext7 ? `~${formatDuration(stats.minutesDueNext7)} estimated` : "No estimates yet"} />
        <Stat icon={ListTodo} label="Open tasks" value={stats.openCount} hint={`${tasks.filter((t) => t.status === "done").length} completed all-time`} />
      </section>

      <section className="card mb-5 p-5" aria-labelledby="summary-h">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 id="summary-h" className="text-sm font-semibold">
            Weekly summary
          </h2>
          {summary && <SourceBadge source={summary.source} />}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={loadSummary} disabled={loadingSummary} aria-label="Regenerate summary">
            <RefreshCw className={cn("h-3.5 w-3.5", loadingSummary && "animate-spin")} />
          </Button>
        </div>
        {loadingSummary && !summary ? (
          <div className="space-y-2" role="status" aria-label="Generating summary">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : summaryError ? (
          <p role="alert" className="text-sm text-danger">
            {summaryError}
          </p>
        ) : summary ? (
          <div>
            {summary.source === "ai" && <p className="text-[15px] font-medium">{summary.headline}</p>}
            <p className="mt-1 text-sm leading-relaxed text-muted">{summary.summary}</p>
            {summary.suggestion && (
              <p className="mt-3 rounded-lg bg-accent/[0.07] px-3 py-2 text-sm">
                <span className="font-medium text-accent">Next step: </span>
                {summary.suggestion}
              </p>
            )}
            {summary.notice && <p className="mt-2 text-2xs text-subtle">{summary.notice}</p>}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Completed per week" subtitle="Last 8 weeks">
          {asTable ? (
            <DataTable cols={["Week of", "Completed"]} rows={stats.weeklyTrend.map((w) => [w.label, w.completed])} />
          ) : (
            <BarChartCard data={stats.weeklyTrend.map((w) => ({ label: w.label, value: w.completed }))} valueLabel="completed" highlightLast />
          )}
        </ChartCard>
        <ChartCard title="This week, day by day" subtitle="Tasks completed each day">
          {asTable ? (
            <DataTable cols={["Day", "Completed", "Created"]} rows={stats.dailyThisWeek.map((d) => [d.label, d.completed, d.created])} />
          ) : (
            <BarChartCard data={stats.dailyThisWeek.map((d) => ({ label: d.label, value: d.completed }))} valueLabel="completed" />
          )}
        </ChartCard>
        <ChartCard title="Upcoming workload" subtitle="Open tasks due over the next 7 days">
          {asTable ? (
            <DataTable cols={["Day", "Tasks due", "Estimated"]} rows={stats.upcoming.map((d) => [d.label, d.due, d.minutes ? formatDuration(d.minutes) : "—"])} />
          ) : (
            <BarChartCard data={stats.upcoming.map((d) => ({ label: d.label, value: d.due, extra: d.minutes ? `~${formatDuration(d.minutes)} estimated` : undefined }))} valueLabel="due" />
          )}
        </ChartCard>
        <ChartCard title="By category" subtitle="Open tasks · completed this week">
          {stats.categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No categorized tasks yet.</p>
          ) : asTable ? (
            <DataTable cols={["Category", "Open", "Done this week"]} rows={stats.categories.map((c) => [CATEGORY_META[c.category].label, c.open, c.done])} />
          ) : (
            <ul className="space-y-3 pt-1">
              {stats.categories.map((c) => (
                <li key={c.category} className="grid grid-cols-[84px_1fr_72px] items-center gap-3 text-sm">
                  <span className="truncate text-muted">{CATEGORY_META[c.category].label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-elevated" title={`${c.open} open, ${c.done} done this week`}>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(c.open / maxCat) * 100}%` }} />
                  </span>
                  <span className="text-right text-xs tabular-nums text-muted">
                    <span className="font-medium text-fg">{c.open}</span> open{c.done ? ` · ${c.done} ✓` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <section className="card mt-5 p-5" aria-labelledby="goals-h">
        <h2 id="goals-h" className="mb-4 text-sm font-semibold">
          Goal progress
        </h2>
        {stats.goals.length ? (
          <ul className="space-y-4">
            {stats.goals.map((g) => (
              <li key={g.goal.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{g.goal.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {g.total ? `${g.done}/${g.total} · ` : ""}
                    <span className="font-semibold text-fg">{Math.round(g.ratio * 100)}%</span>
                  </span>
                </div>
                <ProgressBar value={g.ratio} tone={g.goal.status === "completed" ? "success" : "accent"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No goals yet. Progress is calculated from each goal&apos;s milestones and linked tasks.</p>
        )}
      </section>
      <p className="mt-6 text-center text-2xs text-subtle">Numbers describe your workload, not your worth. Rest days count too.</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof CheckCircle2; label: string; value: number; hint: string; tone?: "warning" }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className={cn("h-3.5 w-3.5", tone === "warning" ? "text-warning" : "text-subtle")} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-2xs text-subtle">{hint}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-subtle">{subtitle}</p>
      {children}
    </section>
  );
}

function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-subtle">
          {cols.map((c, i) => (
            <th key={c} scope="col" className={cn("pb-2 font-medium", i > 0 && "text-right")}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {r.map((v, j) => (
              <td key={j} className={cn("py-1.5", j > 0 ? "text-right tabular-nums" : "text-muted")}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
