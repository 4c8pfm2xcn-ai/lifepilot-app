"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CATEGORY_META, PRIORITY_LABEL } from "@/components/ui/badge";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { CATEGORIES, PRIORITIES, type Subtask } from "@/lib/types";
import { dueFromParts, formatTimeRange, localHHMM, localKey } from "@/lib/time";
import { uid } from "@/lib/id";

const schema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200, "Keep it under 200 characters"),
  description: z.string().max(4000, "Too long").optional(),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
  estimated_minutes: z.string().optional(),
  goal_id: z.string().optional(),
}).refine((v) => !v.due_time || !!v.due_date, { message: "Pick a date for this time", path: ["due_date"] });

type FormValues = z.infer<typeof schema>;

const ESTIMATES = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];

export function TaskEditor() {
  const ui = useUI();
  const { tasks, goals, createTask, updateTask, deleteTask, toggleTask } = useData();
  const existing = ui.task.id ? tasks.find((t) => t.id === ui.task.id) ?? null : null;
  const draft = ui.task.draft;
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState("");
  const [saving, setSaving] = useState(false);

  const defaults = useMemo<FormValues>(() => {
    const src = existing ?? draft ?? {};
    const due = src.due_at ? new Date(src.due_at) : null;
    return {
      title: src.title ?? "",
      description: src.description ?? "",
      category: src.category ?? "other",
      priority: src.priority ?? "normal",
      due_date: due ? localKey(due) : "",
      due_time: due && !src.due_all_day ? localHHMM(due) : "",
      estimated_minutes: src.estimated_minutes ? String(src.estimated_minutes) : "",
      goal_id: src.goal_id ?? "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.task.id, ui.task.draft, ui.task.open]);

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (!ui.task.open) return;
    reset(defaults);
    setSubtasks(existing?.subtasks ?? draft?.subtasks ?? []);
    setNewSub("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.task.open, defaults, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true);
    const due = dueFromParts(v.due_date || null, v.due_time || null);
    const pending = newSub.trim() ? [...subtasks, { id: uid(), title: newSub.trim(), done: false }] : subtasks;
    const payload = {
      title: v.title.trim(),
      description: v.description?.trim() || null,
      category: v.category,
      priority: v.priority,
      ...due,
      estimated_minutes: v.estimated_minutes ? Number(v.estimated_minutes) : null,
      goal_id: v.goal_id || null,
      subtasks: pending,
    };
    const ok = existing ? await updateTask(existing.id, payload) : !!(await createTask({ ...draft, ...payload }));
    setSaving(false);
    if (ok) ui.closeTask();
  });

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubtasks((s) => [...s, { id: uid(), title: newSub.trim().slice(0, 200), done: false }]);
    setNewSub("");
  };

  const estimateOptions = useMemo(() => {
    const current = Number(defaults.estimated_minutes);
    return current && !ESTIMATES.includes(current) ? [...ESTIMATES, current].sort((a, b) => a - b) : ESTIMATES;
  }, [defaults.estimated_minutes]);

  return (
    <Dialog
      open={ui.task.open}
      onClose={ui.closeTask}
      title={existing ? "Edit task" : "New task"}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {existing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => {
                    deleteTask(existing.id);
                    ui.closeTask();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                {existing.status !== "done" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      ui.closeTask();
                      ui.openFindTime(existing.id);
                    }}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> {existing.scheduled_start ? "Reschedule" : "Schedule"}
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={ui.closeTask}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onSubmit} loading={saving} data-testid="save-task">
              {existing ? "Save" : "Create task"}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-3">
          {existing && <CheckCircle checked={existing.status === "done"} onChange={() => toggleTask(existing.id)} label={existing.status === "done" ? "Reopen task" : "Complete task"} className="mt-2" size={22} />}
          <Field label="Title" error={formState.errors.title?.message} className="flex-1">
            {(p) => <Input {...p} data-autofocus {...register("title")} placeholder="What needs to happen?" autoComplete="off" className="h-10 text-[15px]" />}
          </Field>
        </div>

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
          <Field label="Priority">
            {(p) => (
              <Select {...p} {...register("priority")}>
                {PRIORITIES.map((pr) => (
                  <option key={pr} value={pr}>
                    {PRIORITY_LABEL[pr]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Due date" error={formState.errors.due_date?.message}>
            {(p) => <Input {...p} type="date" {...register("due_date")} />}
          </Field>
          <Field label="Due time (optional)">
            {(p) => <Input {...p} type="time" {...register("due_time")} />}
          </Field>
          <Field label="Estimate">
            {(p) => (
              <Select {...p} {...register("estimated_minutes")}>
                <option value="">No estimate</option>
                {estimateOptions.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`.replace(".5 h", "½ h")}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Goal">
            {(p) => (
              <Select {...p} {...register("goal_id")}>
                <option value="">None</option>
                {goals
                  .filter((g) => g.status !== "archived" || g.id === defaults.goal_id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>

        {existing?.scheduled_start && existing.scheduled_end && (
          <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
            <span className="text-muted">
              Scheduled <span className="text-fg">{new Date(existing.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTimeRange(existing.scheduled_start, existing.scheduled_end)}</span>
            </span>
            <button type="button" className="text-muted hover:text-fg" onClick={() => updateTask(existing.id, { scheduled_start: null, scheduled_end: null })}>
              Unschedule
            </button>
          </div>
        )}

        <Field label="Notes">
          {(p) => <Textarea {...p} {...register("description")} placeholder="Details, links, context…" rows={3} />}
        </Field>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">Subtasks</div>
          {subtasks.length > 0 && (
            <ul className="space-y-1">
              {subtasks.map((s) => (
                <li key={s.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1">
                  <CheckCircle size={16} checked={s.done} label={s.done ? `Mark ${s.title} not done` : `Complete ${s.title}`} onChange={() => setSubtasks((all) => all.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                  <input
                    aria-label="Subtask title"
                    value={s.title}
                    onChange={(e) => setSubtasks((all) => all.map((x) => (x.id === s.id ? { ...x, title: e.target.value.slice(0, 200) } : x)))}
                    className={`min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${s.done ? "text-subtle line-through" : ""}`}
                  />
                  <button type="button" aria-label={`Remove ${s.title}`} onClick={() => setSubtasks((all) => all.filter((x) => x.id !== s.id))} className="text-subtle opacity-60 hover:text-danger group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub();
                }
              }}
              placeholder="Add a subtask"
              aria-label="New subtask"
              className="h-8 text-xs"
            />
            <Button size="icon-sm" variant="outline" onClick={addSub} aria-label="Add subtask" className="h-8 w-8">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
