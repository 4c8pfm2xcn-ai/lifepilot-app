"use client";
import { AnimatePresence } from "framer-motion";
import { CheckSquare, CornerDownLeft, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { CATEGORY_META, PRIORITY_LABEL } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { TaskRow } from "@/components/app/task-row";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { isOverdue, isTodayTask, sortTasks, type SortKey } from "@/lib/task-utils";
import { addDaysKey, diffDaysKey, dueFromParts, localKey } from "@/lib/time";
import { heuristicExtract } from "@/lib/ai/heuristic-extract";
import { CATEGORIES, PRIORITIES, type Category, type Priority, type Task } from "@/lib/types";
import { cn } from "@/lib/cn";

type View = "today" | "upcoming" | "all" | "overdue" | "completed";
const VIEWS: View[] = ["today", "upcoming", "all", "overdue", "completed"];

function groupLabel(t: Task, today: string): string {
  if (isOverdue(t)) return "Overdue";
  if (!t.due_at) return t.scheduled_start ? "Scheduled" : "No date";
  const d = diffDaysKey(localKey(new Date(t.due_at)), today);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 7) return "This week";
  if (d < 14) return "Next week";
  return "Later";
}
const GROUP_ORDER = ["Overdue", "Today", "Tomorrow", "This week", "Next week", "Later", "Scheduled", "No date"];

function completedLabel(t: Task, today: string) {
  const d = diffDaysKey(today, localKey(new Date(t.completed_at ?? t.updated_at)));
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "This week" : "Earlier";
}

export function TasksScreen() {
  const { tasks, goals, toggleTask, deleteTask, createTask } = useData();
  const ui = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const initialView = (params.get("view") as View) ?? "all";
  const [view, setView] = useState<View>(VIEWS.includes(initialView) ? initialView : "all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [sort, setSort] = useState<SortKey>("smart");
  const [showFilters, setShowFilters] = useState(false);
  const [quick, setQuick] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const today = localKey();
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  useEffect(() => {
    const v = params.get("view") as View | null;
    if (v && VIEWS.includes(v)) setView(v);
  }, [params]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || document.querySelector('[role="dialog"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeView = (v: View) => {
    setView(v);
    router.replace(`/tasks?view=${v}`, { scroll: false });
  };

  const counts = useMemo(
    () => ({
      today: tasks.filter((t) => t.status !== "done" && isTodayTask(t)).length,
      upcoming: tasks.filter((t) => t.status !== "done" && t.due_at && localKey(new Date(t.due_at)) > today).length,
      all: tasks.filter((t) => t.status !== "done").length,
      overdue: tasks.filter((t) => isOverdue(t)).length,
      completed: 0,
    }),
    [tasks, today],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tasks.filter((t) => {
      switch (view) {
        case "today":
          return t.status !== "done" && isTodayTask(t);
        case "upcoming":
          return t.status !== "done" && !!t.due_at && localKey(new Date(t.due_at)) > today;
        case "overdue":
          return isOverdue(t);
        case "completed":
          return t.status === "done";
        default:
          return t.status !== "done";
      }
    });
    if (category) list = list.filter((t) => t.category === category);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.subtasks.some((s) => s.title.toLowerCase().includes(q)));
    if (view === "completed") return list.sort((a, b) => Date.parse(b.completed_at ?? b.updated_at) - Date.parse(a.completed_at ?? a.updated_at));
    return sortTasks(list, view === "upcoming" && sort === "smart" ? "due" : sort);
  }, [tasks, view, category, priority, query, sort, today]);

  const groups = useMemo(() => {
    if (view === "today" || view === "overdue" || sort !== "smart" && view !== "completed") return [{ label: "", items: filtered }];
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const label = view === "completed" ? completedLabel(t, today) : groupLabel(t, today);
      map.set(label, [...(map.get(label) ?? []), t]);
    }
    const order = view === "completed" ? ["Today", "Yesterday", "This week", "Earlier"] : GROUP_ORDER;
    return order.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }));
  }, [filtered, view, sort, today]);

  // Natural-language quick add: "Call supplier Friday 3pm !high"
  const quickParsed = useMemo(() => {
    if (!quick.trim()) return null;
    const ex = heuristicExtract(quick, { today }).items[0];
    return ex ?? null;
  }, [quick, today]);

  const addQuick = async () => {
    const text = quick.trim();
    if (!text) return;
    const ex = quickParsed;
    const due = ex?.date ? dueFromParts(ex.date, ex.time) : view === "today" ? dueFromParts(today, null) : { due_at: null, due_all_day: false };
    const task = await createTask({
      title: ex?.title || text,
      category: category || ex?.category || "other",
      priority: priority || ex?.priority || "normal",
      estimated_minutes: ex?.estimated_minutes ?? null,
      ...due,
    });
    if (task) setQuick("");
    quickRef.current?.focus();
  };

  const activeFilters = (category ? 1 : 0) + (priority ? 1 : 0) + (sort !== "smart" ? 1 : 0);
  const emptyCopy: Record<View, { title: string; description: string }> = {
    today: { title: "Nothing due today", description: "Tasks due or scheduled today show up here. Enjoy the room to think." },
    upcoming: { title: "No upcoming deadlines", description: "Tasks with future due dates will appear here, grouped by when they're due." },
    all: { title: "No open tasks", description: "Add one above, or capture anything and let DAYZERO turn it into tasks." },
    overdue: { title: "Nothing overdue", description: "Everything with a deadline is on track." },
    completed: { title: "No completed tasks yet", description: "Finished tasks are kept here so you can see what you've done — and reopen anything." },
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${counts.all} open${counts.overdue ? ` · ${counts.overdue} overdue` : ""}`}
        actions={
          <Button variant="primary" onClick={() => ui.openTask(view === "today" ? { ...dueFromParts(today, null) } : undefined)} data-testid="new-task">
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          label="Task view"
          value={view}
          onChange={changeView}
          options={[
            { value: "today", label: "Today", count: counts.today },
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "all", label: "All", count: counts.all },
            { value: "overdue", label: "Overdue", count: counts.overdue },
            { value: "completed", label: "Completed" },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="field h-9 pl-8 pr-8" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant={showFilters || activeFilters ? "secondary" : "outline"} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-controls="task-filters">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {activeFilters > 0 && <span className="rounded bg-accent/20 px-1 text-2xs font-semibold text-accent">{activeFilters}</span>}
          </Button>
        </div>
      </div>

      {showFilters && (
        <div id="task-filters" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value as Category | "")} className="h-8 w-auto text-xs">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} className="h-8 w-auto text-xs">
            <option value="">Any priority</option>
            {[...PRIORITIES].reverse().map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort tasks" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8 w-auto text-xs" disabled={view === "completed"}>
            <option value="smart">Sort: Smart</option>
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Newest</option>
            <option value="title">Sort: A–Z</option>
          </Select>
          {activeFilters > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCategory("");
                setPriority("");
                setSort("smart");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      )}

      {view !== "completed" && view !== "overdue" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addQuick();
          }}
          className="mb-3"
        >
          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
            <Plus className="h-4 w-4 shrink-0 text-subtle" />
            <input ref={quickRef} value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Add a task — try “Submit essay Friday 5pm, urgent”" aria-label="Quick add task" className="h-11 min-w-0 flex-1 bg-transparent text-sm placeholder:text-subtle focus:outline-none" data-testid="quick-add" />
            {quick && (
              <button type="submit" className="flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-2xs font-semibold text-accent-fg">
                Add <CornerDownLeft className="h-3 w-3" />
              </button>
            )}
          </div>
          {quickParsed && (quickParsed.date || quickParsed.priority !== "normal" || quickParsed.category !== "other") && (
            <p className="mt-1.5 px-1 text-2xs text-subtle" aria-live="polite">
              Will add <span className="text-fg">“{quickParsed.title}”</span>
              {quickParsed.date && <> · due {quickParsed.date === today ? "today" : quickParsed.date === addDaysKey(today, 1) ? "tomorrow" : new Date(`${quickParsed.date}T12:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{quickParsed.time && ` ${quickParsed.time}`}</>}
              {quickParsed.priority !== "normal" && <> · {quickParsed.priority}</>}
              {quickParsed.category !== "other" && <> · {CATEGORY_META[quickParsed.category].label}</>}
            </p>
          )}
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CheckSquare}
            title={query || category || priority ? "No tasks match" : emptyCopy[view].title}
            description={query || category || priority ? "Try a different search or clear your filters." : emptyCopy[view].description}
            action={!query && view !== "completed" && view !== "overdue" ? <Button onClick={() => ui.openCapture()}>Capture something</Button> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label || "all"} aria-label={g.label || "Tasks"}>
              {g.label && (
                <h2 className={cn("mb-1 flex items-center gap-2 px-3 text-xs font-semibold", g.label === "Overdue" ? "text-danger" : "text-muted")}>
                  {g.label}
                  <span className="font-normal text-subtle">{g.items.length}</span>
                </h2>
              )}
              <ul className="card divide-y divide-line p-1">
                <AnimatePresence initial={false}>
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} goal={t.goal_id ? goalById.get(t.goal_id) : null} onToggle={toggleTask} onOpen={ui.openTask} onDelete={deleteTask} onFindTime={ui.openFindTime} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
