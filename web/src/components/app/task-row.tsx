"use client";
import { CalendarClock, CalendarPlus, Clock, ListChecks, MoreHorizontal, Pencil, Target, Trash2 } from "lucide-react";
import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Goal, Task } from "@/lib/types";
import { formatDue, formatDuration, formatTimeRange } from "@/lib/time";
import { isOverdue } from "@/lib/task-utils";
import { CategoryTag, PriorityFlag } from "@/components/ui/badge";
import { CheckCircle } from "@/components/ui/checkbox";
import { Menu } from "@/components/ui/menu";

interface Props {
  task: Task;
  goal?: Goal | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  onFindTime?: (id: string) => void;
  compact?: boolean;
  showCategory?: boolean;
}

export const TaskRow = memo(function TaskRow({ task, goal, onToggle, onOpen, onDelete, onFindTime, compact, showCategory = true }: Props) {
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const subDone = task.subtasks.filter((s) => s.done).length;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.16 }}
      className={cn("group relative flex items-start gap-3 rounded-lg px-3 transition-colors hover:bg-elevated/60", compact ? "py-2" : "py-2.5")}
      data-testid="task-row"
    >
      <CheckCircle checked={done} onChange={() => onToggle(task.id)} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} className="mt-0.5" />
      <button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left focus-visible:outline-offset-4">
        <span className={cn("block truncate text-sm leading-5", done ? "text-subtle line-through decoration-subtle/60" : "text-fg")}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
          {task.due_at && (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-danger")}>
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {overdue ? "Overdue · " : ""}
              {formatDue(task.due_at, task.due_all_day)}
            </span>
          )}
          {task.scheduled_start && task.scheduled_end && !done && (
            <span className="inline-flex items-center gap-1 text-accent">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatTimeRange(task.scheduled_start, task.scheduled_end)}
            </span>
          )}
          {task.estimated_minutes ? <span>{formatDuration(task.estimated_minutes)}</span> : null}
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" aria-hidden="true" />
              {subDone}/{task.subtasks.length}
            </span>
          )}
          {showCategory && !compact && <CategoryTag category={task.category} />}
          {goal && (
            <span className="inline-flex max-w-[140px] items-center gap-1 truncate">
              <Target className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{goal.title}</span>
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <PriorityFlag priority={task.priority} />
        {(onDelete || onFindTime) && (
          <Menu
            label={`Actions for ${task.title}`}
            items={[
              { label: "Edit", icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => onOpen(task.id) },
              ...(onFindTime && !done ? [{ label: task.scheduled_start ? "Reschedule" : "Find a time", icon: <CalendarPlus className="h-3.5 w-3.5" />, onSelect: () => onFindTime(task.id) }] : []),
              ...(onDelete ? [{ label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, onSelect: () => onDelete(task.id), danger: true }] : []),
            ]}
            trigger={(p) => (
              <button type="button" {...p} aria-label={`More actions for ${task.title}`} className="grid h-6 w-6 place-items-center rounded-md text-subtle opacity-100 transition hover:bg-card hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 sm:aria-expanded:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
          />
        )}
      </div>
    </motion.li>
  );
});
