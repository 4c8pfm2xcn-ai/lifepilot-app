"use client";
import { AlertTriangle, ArrowUp, Check, MessageSquarePlus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { SourceBadge } from "@/components/app/source-badge";
import { useData } from "@/providers/data-provider";
import { useSnapshotSource } from "@/hooks/use-snapshot";
import { useAIStatus } from "@/hooks/use-ai-status";
import { ApiError, postApi } from "@/lib/client-api";
import { dueFromParts } from "@/lib/time";
import { uid } from "@/lib/id";
import type { Message, ProposedAction } from "@/lib/types";
import { cn } from "@/lib/cn";

const PROMPTS = ["What do I need to finish this week?", "Find tasks that are overdue.", "Help me plan my afternoon.", "Organize my tasks for tomorrow.", "Summarize everything I captured today.", "Break my biggest project into smaller steps."];

export function AssistantScreen() {
  const data = useData();
  const { conversations, messages, createConversation, deleteConversation, addMessage, updateMessage, updateConversation } = data;
  const src = useSnapshotSource();
  const ai = useAIStatus();
  const { toast } = useToast();
  const sorted = useMemo(() => [...conversations].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)), [conversations]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; text: string; retryable: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeId && !conversations.some((c) => c.id === activeId)) setActiveId(null);
  }, [conversations, activeId]);

  const thread = useMemo(() => (activeId ? messages.filter((m) => m.conversation_id === activeId).sort((a, b) => a.created_at.localeCompare(b.created_at)) : []), [messages, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length, loading, error]);

  const ask = async (text: string, opts: { retry?: boolean } = {}) => {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    let convId = activeId;
    if (!convId) {
      const conv = await createConversation(content.slice(0, 60));
      if (!conv) return;
      convId = conv.id;
      setActiveId(conv.id);
    }
    const history = data.messages.filter((m) => m.conversation_id === convId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!opts.retry) {
      await addMessage({ conversation_id: convId, role: "user", content, actions: [], source: null });
      setInput("");
    }
    setLoading(true);
    try {
      const prior = opts.retry ? history.slice(0, -1) : history;
      const res = await postApi<{ reply: string; actions: ProposedAction[]; source: "ai" | "offline" }>("/api/ai/assistant", { message: content, history: prior.map((m) => ({ role: m.role, content: m.content })) }, src);
      await addMessage({ conversation_id: convId, role: "assistant", content: res.reply, actions: res.actions, source: res.source });
      updateConversation(convId, { updated_at: new Date().toISOString() });
    } catch (e) {
      setError({ message: e instanceof ApiError ? e.message : "Something went wrong.", text: content, retryable: e instanceof ApiError ? e.retryable : true });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  /** Execute a confirmed action against the user's own data. */
  const execute = async (msg: Message, action: ProposedAction) => {
    const setStatus = (status: ProposedAction["status"], err?: string) => updateMessage(msg.id, { actions: data.peek("messages", msg.id)!.actions.map((a) => (a.id === action.id ? { ...a, status, error: err ?? null } : a)) });
    const task = "task_id" in action ? data.peek("tasks", action.task_id) : undefined;
    if ("task_id" in action && !task) {
      await setStatus("failed", "That task no longer exists.");
      return;
    }
    let ok = false;
    switch (action.type) {
      case "create_task":
        ok = !!(await data.createTask({ title: action.title, description: action.description ?? null, category: action.category, priority: action.priority, estimated_minutes: action.estimated_minutes ?? null, goal_id: action.goal_id ?? null, ...dueFromParts(action.due_date, action.due_time) }));
        break;
      case "update_task": {
        const patch: Record<string, unknown> = {};
        if (action.title) patch.title = action.title;
        if (action.priority) patch.priority = action.priority;
        if (action.category) patch.category = action.category;
        if (action.estimated_minutes) patch.estimated_minutes = action.estimated_minutes;
        if (action.due_date) Object.assign(patch, dueFromParts(action.due_date, action.due_time));
        ok = await data.updateTask(action.task_id, patch);
        break;
      }
      case "complete_task":
        ok = await data.updateTask(action.task_id, { status: "done", completed_at: new Date().toISOString() });
        break;
      case "delete_task":
        await data.deleteTask(action.task_id);
        ok = !data.peek("tasks", action.task_id);
        break;
      case "schedule_task":
        ok = await data.updateTask(action.task_id, { scheduled_start: action.start, scheduled_end: action.end });
        break;
      case "create_event":
        ok = !!(await data.createEvent({ title: action.title, description: action.description ?? null, start_at: action.start, end_at: action.end }));
        break;
      case "add_subtasks":
        ok = await data.updateTask(action.task_id, { subtasks: [...(task?.subtasks ?? []), ...action.subtasks.map((s) => ({ id: uid(), title: s, done: false }))] });
        break;
      case "add_milestones": {
        if (!data.peek("goals", action.goal_id)) {
          await setStatus("failed", "That goal no longer exists.");
          return;
        }
        let n = 0;
        for (const m of action.milestones) if (await data.createMilestone(action.goal_id, m)) n++;
        ok = n === action.milestones.length;
        break;
      }
    }
    await setStatus(ok ? "applied" : "failed", ok ? undefined : "Couldn't apply this change.");
  };

  const proposedCount = (m: Message) => m.actions.filter((a) => a.status === "proposed").length;

  return (
    <div className="flex h-[calc(100dvh-170px)] min-h-[480px] gap-5 md:h-[calc(100dvh-80px)]">
      <aside className="hidden w-56 shrink-0 flex-col lg:flex" aria-label="Conversations">
        <Button variant="secondary" onClick={() => (setActiveId(null), setError(null), inputRef.current?.focus())} className="mb-3 justify-start">
          <MessageSquarePlus className="h-4 w-4" /> New conversation
        </Button>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {sorted.map((c) => (
            <li key={c.id}>
              <button onClick={() => (setActiveId(c.id), setError(null))} className={cn("w-full truncate rounded-lg px-2.5 py-2 text-left text-sm transition-colors", c.id === activeId ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg")} aria-current={c.id === activeId ? "true" : undefined}>
                {c.title}
              </button>
            </li>
          ))}
          {sorted.length === 0 && <li className="px-2.5 text-xs text-subtle">No conversations yet.</li>}
        </ul>
      </aside>

      <section className="card flex min-w-0 flex-1 flex-col overflow-hidden" aria-label="Assistant chat">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Sparkles className="h-4 w-4 text-accent" />
          <h1 className="text-sm font-semibold">Assistant</h1>
          {ai && <SourceBadge source={ai.ai ? "ai" : "offline"} />}
          <div className="ml-auto flex items-center gap-1.5">
            <Select aria-label="Conversation" value={activeId ?? ""} onChange={(e) => (setActiveId(e.target.value || null), setError(null))} className="h-8 max-w-[160px] text-xs lg:hidden">
              <option value="">New conversation</option>
              {sorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
            {activeId && (
              <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete conversation">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {thread.length === 0 && !loading && (
            <div className="mx-auto flex max-w-lg flex-col items-center pt-6 text-center">
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold">How can I help you get organized?</h2>
              <p className="mt-1 text-sm text-muted">I can see your tasks, calendar, goals and captures. I&apos;ll always ask before changing anything.</p>
              {ai && !ai.ai && <p className="mt-2 text-xs text-subtle">Offline mode: no AI key is configured, so I understand a limited set of requests.</p>}
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {PROMPTS.map((p) => (
                  <button key={p} onClick={() => ask(p)} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-sm text-muted transition hover:border-line-strong hover:text-fg">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[88%] sm:max-w-[78%]", m.role === "user" && "rounded-2xl rounded-br-md bg-elevated px-4 py-2.5")}>
                {m.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1.5 text-2xs text-subtle">
                    <Sparkles className="h-3 w-3 text-accent" /> DAYZERO {m.source === "offline" && "· offline"}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</div>
                {m.actions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.actions.map((a) => (
                      <ActionCard key={a.id} action={a} onConfirm={() => execute(m, a)} onDismiss={() => updateMessage(m.id, { actions: m.actions.map((x) => (x.id === a.id ? { ...x, status: "dismissed" } : x)) })} />
                    ))}
                    {proposedCount(m) > 1 && !m.actions.some((a) => a.destructive && a.status === "proposed") && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          for (const a of m.actions.filter((x) => x.status === "proposed")) await execute(data.peek("messages", m.id) ?? m, a);
                          toast("Changes applied", { tone: "success" });
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm all {proposedCount(m)}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted" role="status">
              <Spinner className="h-3.5 w-3.5 text-accent" /> Thinking…
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="flex-1">
                <p>{error.message}</p>
                {error.retryable && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => ask(error.text, { retry: true })}>
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="border-t border-line p-3"
        >
          <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-accent/50">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Ask anything about your plans…"
              aria-label="Message the assistant"
              className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm placeholder:text-subtle focus:outline-none"
              style={{ height: "auto" }}
              data-testid="assistant-input"
            />
            <Button type="submit" size="icon-sm" variant="primary" disabled={!input.trim() || loading} aria-label="Send message" className="h-8 w-8 rounded-lg">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        destructive
        title="Delete this conversation?"
        description="The messages will be permanently removed. Changes you already applied stay."
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmDelete(false);
          if (activeId) await deleteConversation(activeId);
          setActiveId(null);
        }}
      />
    </div>
  );
}

function ActionCard({ action, onConfirm, onDismiss }: { action: ProposedAction; onConfirm: () => Promise<void>; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const done = action.status !== "proposed";
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", action.destructive ? "border-danger/30 bg-danger/[0.05]" : "border-line bg-surface", done && "opacity-70")} data-testid="action-card">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{action.summary}</p>
          {action.type === "add_subtasks" && <ul className="mt-1 list-inside list-disc text-xs text-muted">{action.subtasks.map((s) => <li key={s}>{s}</li>)}</ul>}
          {action.type === "add_milestones" && <ul className="mt-1 list-inside list-disc text-xs text-muted">{action.milestones.map((s) => <li key={s}>{s}</li>)}</ul>}
          {action.warning && (
            <p className="mt-1 flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" /> {action.warning}
            </p>
          )}
          {action.status === "failed" && <p className="mt-1 text-xs text-danger">{action.error ?? "Failed"}</p>}
        </div>
        {done ? (
          <span className={cn("shrink-0 text-xs font-medium", action.status === "applied" ? "text-success" : action.status === "failed" ? "text-danger" : "text-subtle")}>
            {action.status === "applied" ? "✓ Applied" : action.status === "failed" ? "Failed" : "Dismissed"}
          </span>
        ) : (
          <div className="flex shrink-0 gap-1">
            <Button size="icon-sm" variant="ghost" onClick={onDismiss} aria-label={`Dismiss: ${action.summary}`}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={action.destructive ? "danger" : "primary"}
              loading={busy}
              onClick={async () => {
                if (action.destructive && !confirming) {
                  setConfirming(true);
                  return;
                }
                setBusy(true);
                await onConfirm();
                setBusy(false);
              }}
              data-testid="confirm-action"
            >
              {action.destructive ? (confirming ? "Really delete?" : "Delete") : "Confirm"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
