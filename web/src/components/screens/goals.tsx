"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "framer-motion";
import { Archive, CalendarDays, CheckCircle2, Link2, Pencil, Plus, RotateCcw, Sparkles, Target, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CategoryTag, CATEGORY_META, Badge } from "@/components/ui/badge";
import { CheckCircle } from "@/components/ui/checkbox";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/app/page-header";
import { TaskRow } from "@/components/app/task-row";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { useSnapshotSource } from "@/hooks/use-snapshot";
import { goalProgress } from "@/lib/insights";
import { ApiError, postApi } from "@/lib/client-api";
import { diffDaysKey, formatDateKey, localKey } from "@/lib/time";
import { CATEGORIES, type Goal } from "@/lib/types";
import { cn } from "@/lib/cn";

const schema = z.object({
  title: z.string().trim().min(1, "Name your goal").max(200),
  description: z.string().max(4000).optional(),
  category: z.enum(CATEGORIES),
  target_date: z.string().optional(),
});
type GoalForm = z.infer<typeof schema>;

export function GoalsScreen() {
  const { goals, goal_milestones, tasks } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "completed" | "archived">("active");
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const openId = params.get("goal");
  const openGoal = openId ? goals.find((g) => g.id === openId) ?? null : null;

  const list = useMemo(() => goals.filter((g) => g.status === tab).sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999") || a.created_at.localeCompare(b.created_at)), [goals, tab]);
  const counts = { active: goals.filter((g) => g.status === "active").length, completed: goals.filter((g) => g.status === "completed").length, archived: goals.filter((g) => g.status === "archived").length };

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="The bigger things you're working toward — broken into steps you can actually take."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")} data-testid="new-goal">
            <Plus className="h-4 w-4" /> New goal
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented
          label="Goal status"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Active", count: counts.active },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "archived", label: "Archived", count: counts.archived },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Target}
            title={tab === "active" ? "No active goals" : `No ${tab} goals`}
            description={tab === "active" ? "Finish a project, learn a skill, launch an idea. Add a goal and DAYZERO helps you break it into milestones." : undefined}
            action={tab === "active" ? <Button onClick={() => setEditing("new")}>Create a goal</Button> : undefined}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((g) => {
            const p = goalProgress(g, goal_milestones, tasks);
            const daysLeft = g.target_date ? diffDaysKey(g.target_date, localKey()) : null;
            return (
              <li key={g.id}>
                <button onClick={() => router.push(`/goals?goal=${g.id}`, { scroll: false })} className="card group flex h-full w-full flex-col p-5 text-left transition hover:border-line-strong" data-testid="goal-card">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[15px] font-semibold leading-snug">{g.title}</h2>
                    <CategoryTag category={g.category} className="shrink-0 pt-1" />
                  </div>
                  {g.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{g.description}</p>}
                  <div className="mt-auto pt-5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted">{p.total ? `${p.done} of ${p.total} steps` : "No steps yet"}</span>
                      <span className="font-semibold tabular-nums">{Math.round(p.ratio * 100)}%</span>
                    </div>
                    <ProgressBar value={p.ratio} tone={g.status === "completed" ? "success" : "accent"} />
                    {g.target_date && (
                      <p className={cn("mt-2.5 flex items-center gap-1.5 text-2xs", daysLeft !== null && daysLeft < 0 && g.status === "active" ? "text-warning" : "text-subtle")}>
                        <CalendarDays className="h-3 w-3" />
                        {formatDateKey(g.target_date, { month: "short", day: "numeric", year: "numeric" })}
                        {g.status === "active" && daysLeft !== null && (daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : " · target date passed")}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <GoalFormDialog goal={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} onCreated={(id) => router.push(`/goals?goal=${id}`, { scroll: false })} />
      <GoalDetail goal={openGoal} onClose={() => router.push("/goals", { scroll: false })} onEdit={(g) => setEditing(g)} />
    </div>
  );
}

function GoalFormDialog({ goal, open, onClose, onCreated }: { goal: Goal | null; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { createGoal, updateGoal } = useData();
  const { register, handleSubmit, reset, formState } = useForm<GoalForm>({ resolver: zodResolver(schema) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) reset({ title: goal?.title ?? "", description: goal?.description ?? "", category: goal?.category ?? "personal", target_date: goal?.target_date ?? "" });
  }, [open, goal, reset]);

  const submit = handleSubmit(async (v) => {
    setSaving(true);
    const payload = { title: v.title.trim(), description: v.description?.trim() || null, category: v.category, target_date: v.target_date || null };
    if (goal) {
      if (await updateGoal(goal.id, payload)) onClose();
    } else {
      const g = await createGoal(payload);
      if (g) {
        onClose();
        onCreated(g.id);
      }
    }
    setSaving(false);
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} data-testid="save-goal">
            {goal ? "Save" : "Create goal"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Goal" error={formState.errors.title?.message}>
          {(p) => <Input {...p} data-autofocus {...register("title")} placeholder="e.g. Launch my Etsy shop" className="h-10 text-[15px]" />}
        </Field>
        <Field label="Why it matters / details">
          {(p) => <Textarea {...p} {...register("description")} rows={3} placeholder="Optional" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            {(p) => (
              <Select {...p} {...register("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Target date">
            {(p) => <Input {...p} type="date" {...register("target_date")} />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

function GoalDetail({ goal, onClose, onEdit }: { goal: Goal | null; onClose: () => void; onEdit: (g: Goal) => void }) {
  const { goal_milestones, tasks, createMilestone, updateMilestone, deleteMilestone, updateGoal, deleteGoal, toggleTask, updateTask, deleteTask } = useData();
  const ui = useUI();
  const src = useSnapshotSource();
  const { toast } = useToast();
  const [newMs, setNewMs] = useState("");
  const [linking, setLinking] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; why: string; picked: boolean }[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setSuggestions(null);
    setNewMs("");
  }, [goal?.id]);

  if (!goal) return <Dialog open={false} onClose={onClose} title="" side="right">{null}</Dialog>;
  const milestones = goal_milestones.filter((m) => m.goal_id === goal.id).sort((a, b) => a.position - b.position);
  const linked = tasks.filter((t) => t.goal_id === goal.id);
  const linkable = tasks.filter((t) => t.status !== "done" && t.goal_id !== goal.id);
  const p = goalProgress(goal, goal_milestones, tasks);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await postApi<{ milestones: { title: string; why: string }[] }>("/api/ai/milestones", { title: goal.title, description: goal.description, target_date: goal.target_date, existing: milestones.map((m) => m.title) }, src);
      setSuggestions(res.milestones.map((m) => ({ ...m, picked: true })));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't get suggestions.", { tone: "error" });
    } finally {
      setSuggesting(false);
    }
  };

  const addPicked = async () => {
    const picked = suggestions?.filter((s) => s.picked) ?? [];
    for (const s of picked) await createMilestone(goal.id, s.title);
    setSuggestions(null);
    if (picked.length) toast(`Added ${picked.length} milestone${picked.length === 1 ? "" : "s"}`, { tone: "success" });
  };

  return (
    <Dialog open={!!goal} onClose={onClose} title={goal.title} side="right" description={<CategoryTag category={goal.category} />}>
      <div className="space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">Progress</span>
            <span className="font-semibold tabular-nums">{Math.round(p.ratio * 100)}%</span>
          </div>
          <ProgressBar value={p.ratio} tone={goal.status === "completed" ? "success" : "accent"} />
          <p className="mt-2 text-xs text-subtle">
            Calculated from {milestones.length} milestone{milestones.length === 1 ? "" : "s"} and {linked.length} linked task{linked.length === 1 ? "" : "s"}.
            {goal.target_date && ` Target: ${formatDateKey(goal.target_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}.`}
          </p>
          {goal.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{goal.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => onEdit(goal)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {goal.status === "active" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => updateGoal(goal.id, { status: "completed" })}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => updateGoal(goal.id, { status: "archived" })}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => updateGoal(goal.id, { status: "active" })}>
                <RotateCcw className="h-3.5 w-3.5" /> Reactivate
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </section>

        <section aria-labelledby="ms-h">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="ms-h" className="text-sm font-semibold">
              Milestones
            </h3>
            <Button size="sm" variant="ghost" onClick={suggest} disabled={suggesting} data-testid="suggest-milestones">
              {suggesting ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />} Suggest
            </Button>
          </div>

          {suggestions && (
            <div className="mb-3 rounded-lg border border-accent/25 bg-accent/5 p-3">
              <p className="mb-2 text-xs font-medium">
                <Sparkles className="mr-1 inline h-3 w-3 text-accent" />
                Suggested milestones — pick the ones you want
              </p>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={18} checked={s.picked} label={s.picked ? `Exclude ${s.title}` : `Include ${s.title}`} onChange={() => setSuggestions((all) => all!.map((x, j) => (j === i ? { ...x, picked: !x.picked } : x)))} />
                    <span className="min-w-0">
                      <span className="block text-sm">{s.title}</span>
                      <span className="block text-2xs text-muted">{s.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" onClick={addPicked} disabled={!suggestions.some((s) => s.picked)}>
                  Add {suggestions.filter((s) => s.picked).length} selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>
                  Discard
                </Button>
              </div>
            </div>
          )}

          {milestones.length > 0 && (
            <ul className="mb-2 space-y-0.5">
              {milestones.map((m) => (
                <li key={m.id} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-elevated/50">
                  <CheckCircle size={18} checked={m.completed} label={m.completed ? `Mark ${m.title} not done` : `Complete ${m.title}`} onChange={() => updateMilestone(m.id, { completed: !m.completed })} />
                  <span className={cn("min-w-0 flex-1 text-sm", m.completed && "text-subtle line-through")}>{m.title}</span>
                  <button onClick={() => deleteMilestone(m.id)} className="text-subtle opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100" aria-label={`Delete milestone ${m.title}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newMs.trim()) return;
              if (await createMilestone(goal.id, newMs)) setNewMs("");
            }}
            className="flex gap-2"
          >
            <Input value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Add a milestone" aria-label="New milestone" className="h-8 text-xs" maxLength={200} />
            <Button type="submit" size="sm" variant="outline" disabled={!newMs.trim()}>
              Add
            </Button>
          </form>
        </section>

        <section aria-labelledby="lt-h">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="lt-h" className="text-sm font-semibold">
              Linked tasks
            </h3>
            <Button size="sm" variant="ghost" onClick={() => ui.openTask({ goal_id: goal.id, category: goal.category })}>
              <Plus className="h-3.5 w-3.5" /> New task
            </Button>
          </div>
          {linked.length > 0 ? (
            <ul className="-mx-2 mb-2">
              <AnimatePresence initial={false}>
                {linked.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggleTask} onOpen={ui.openTask} onDelete={deleteTask} compact showCategory={false} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="mb-2 text-xs text-subtle">No tasks linked yet.</p>
          )}
          {linkable.length > 0 && (
            <div className="flex gap-2">
              <Select value={linking} onChange={(e) => setLinking(e.target.value)} aria-label="Link an existing task" className="h-8 text-xs">
                <option value="">Link an existing task…</option>
                {linkable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!linking}
                onClick={async () => {
                  if (await updateTask(linking, { goal_id: goal.id })) setLinking("");
                }}
              >
                <Link2 className="h-3.5 w-3.5" /> Link
              </Button>
            </div>
          )}
        </section>
        {goal.status !== "active" && <Badge>{goal.status === "completed" ? "Completed" : "Archived"}</Badge>}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        destructive
        title="Delete this goal?"
        description="Its milestones will be deleted. Linked tasks are kept but unlinked. This can't be undone."
        confirmLabel="Delete goal"
        onConfirm={async () => {
          setConfirmDelete(false);
          onClose();
          await deleteGoal(goal.id);
        }}
      />
    </Dialog>
  );
}
