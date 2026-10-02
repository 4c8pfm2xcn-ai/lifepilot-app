"use client";
import { AlertTriangle, CalendarPlus, CheckSquare, ChevronDown, NotebookPen, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CATEGORY_META, CategoryTag, PRIORITY_LABEL, PriorityFlag } from "@/components/ui/badge";
import { CATEGORIES, PRIORITIES, type ExtractedItem, type ExtractedKind } from "@/lib/types";
import { formatDuration, localDate } from "@/lib/time";
import { cn } from "@/lib/cn";

const KIND_LABEL: Record<ExtractedKind, string> = { task: "Task", event: "Event", idea: "Idea", note: "Note" };

/** One AI-extracted item, editable before it becomes a task/event/note. */
export function ExtractedItemRow({
  item,
  onPatch,
  onAccept,
  onDismiss,
  onOpenCreated,
}: {
  item: ExtractedItem;
  onPatch: (patch: Partial<ExtractedItem>) => void;
  onAccept: (as: "task" | "event" | "note") => Promise<boolean> | void;
  onDismiss: () => void;
  onOpenCreated?: () => void;
}) {
  const [editing, setEditing] = useState(item.needs_confirmation);
  const [busy, setBusy] = useState(false);

  if (item.status === "dismissed") return null;
  if (item.status === "accepted") {
    return (
      <li className="flex items-center gap-2.5 rounded-lg bg-success/[0.06] px-3 py-2 text-sm">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-success/20 text-success">
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        <span className="shrink-0 text-xs text-muted">{item.created_id ? `Added as ${item.kind}` : `Kept as ${item.kind}`}</span>
        {item.created_id && onOpenCreated && (
          <button onClick={onOpenCreated} className="shrink-0 text-xs text-accent hover:underline">
            Open
          </button>
        )}
      </li>
    );
  }

  const act = async (as: "task" | "event" | "note") => {
    setBusy(true);
    await onAccept(as);
    setBusy(false);
  };

  const primary: "task" | "event" | "note" = item.kind === "event" ? "event" : item.kind === "task" ? "task" : "note";
  const dateLabel = item.date ? localDate(item.date, item.time ?? "12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + (item.time ? ` · ${item.time}${item.end_time ? `–${item.end_time}` : ""}` : "") : null;

  return (
    <li className={cn("rounded-lg border bg-surface", item.needs_confirmation ? "border-warning/30" : "border-line")} data-testid="extracted-item">
      <div className="flex items-start gap-3 p-3">
        <Select aria-label="Item type" value={item.kind} onChange={(e) => onPatch({ kind: e.target.value as ExtractedKind })} className="h-7 w-[88px] shrink-0 px-2 pr-6 text-xs">
          {(Object.keys(KIND_LABEL) as ExtractedKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </Select>
        <div className="min-w-0 flex-1">
          <input aria-label="Title" value={item.title} onChange={(e) => onPatch({ title: e.target.value.slice(0, 200) })} className="w-full bg-transparent text-sm font-medium focus:outline-none" />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
            {dateLabel ? <span className={cn(item.has_deadline && "text-warning")}>{item.has_deadline ? "Due " : ""}{dateLabel}</span> : <span className="text-subtle">No date</span>}
            <CategoryTag category={item.category} />
            <PriorityFlag priority={item.priority} showLabel={item.priority !== "normal"} />
            {item.estimated_minutes ? <span>{formatDuration(item.estimated_minutes)}</span> : null}
          </div>
        </div>
        <button onClick={() => setEditing((e) => !e)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg" aria-expanded={editing} aria-label="Edit details">
          <ChevronDown className={cn("h-4 w-4 transition-transform", editing && "rotate-180")} />
        </button>
        <button onClick={onDismiss} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-danger/10 hover:text-danger" aria-label={`Delete “${item.title}”`}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {item.needs_confirmation && item.ambiguity && (
        <p className="mx-3 mb-2 flex items-start gap-1.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold">Please confirm:</span> {item.ambiguity}
          </span>
        </p>
      )}

      {editing && (
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-4">
          <label className="space-y-1 text-2xs text-muted">
            Date
            <Input type="date" value={item.date ?? ""} onChange={(e) => onPatch({ date: e.target.value || null, needs_confirmation: false, has_deadline: !!e.target.value && item.kind === "task" ? true : item.has_deadline })} className="h-8 text-xs" />
          </label>
          <label className="space-y-1 text-2xs text-muted">
            {item.kind === "event" ? "Start" : "Time"}
            <Input type="time" value={item.time ?? ""} onChange={(e) => onPatch({ time: e.target.value || null, needs_confirmation: false })} className="h-8 text-xs" />
          </label>
          {item.kind === "event" ? (
            <label className="space-y-1 text-2xs text-muted">
              End
              <Input type="time" value={item.end_time ?? ""} onChange={(e) => onPatch({ end_time: e.target.value || null })} className="h-8 text-xs" />
            </label>
          ) : (
            <label className="space-y-1 text-2xs text-muted">
              Estimate (min)
              <Input type="number" min={5} max={960} step={5} value={item.estimated_minutes ?? ""} onChange={(e) => onPatch({ estimated_minutes: e.target.value ? Math.max(1, Math.min(960, Number(e.target.value))) : null })} className="h-8 text-xs" />
            </label>
          )}
          <label className="space-y-1 text-2xs text-muted">
            Category
            <Select value={item.category} onChange={(e) => onPatch({ category: e.target.value as ExtractedItem["category"] })} className="h-8 text-xs">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-2xs text-muted">
            Priority
            <Select value={item.priority} onChange={(e) => onPatch({ priority: e.target.value as ExtractedItem["priority"] })} className="h-8 text-xs">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </label>
          <label className="col-span-2 space-y-1 text-2xs text-muted sm:col-span-3">
            Details
            <Textarea value={item.description ?? ""} onChange={(e) => onPatch({ description: e.target.value || null })} rows={1} className="min-h-[32px] py-1.5 text-xs" />
          </label>
          {item.date && item.kind === "task" && (
            <label className="col-span-2 flex items-center gap-2 text-xs text-muted sm:col-span-4">
              <input type="checkbox" checked={item.has_deadline} onChange={(e) => onPatch({ has_deadline: e.target.checked })} className="accent-[rgb(var(--accent))]" />
              This date is a deadline
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
        <Button size="sm" variant={primary === "task" ? "primary" : "outline"} loading={busy && primary === "task"} disabled={busy} onClick={() => act("task")} data-testid="accept-task">
          <CheckSquare className="h-3.5 w-3.5" /> {primary === "task" ? "Accept as task" : "Convert to task"}
        </Button>
        <Button size="sm" variant={primary === "event" ? "primary" : "outline"} disabled={busy} onClick={() => act("event")}>
          <CalendarPlus className="h-3.5 w-3.5" /> {primary === "event" ? "Accept as event" : "Convert to event"}
        </Button>
        <Button size="sm" variant={primary === "note" ? "primary" : "ghost"} disabled={busy} onClick={() => act("note")}>
          <NotebookPen className="h-3.5 w-3.5" /> Keep as {item.kind === "idea" ? "idea" : "note"}
        </Button>
      </div>
    </li>
  );
}
