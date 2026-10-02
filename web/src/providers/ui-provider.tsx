"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CalendarEvent, Task } from "@/lib/types";

export type CaptureMode = "thought" | "image" | "voice" | "task" | "event";
export type TaskDraft = Partial<Task> & { title?: string };
export type EventDraft = Partial<CalendarEvent>;

interface UIState {
  capture: { open: boolean; mode: CaptureMode };
  task: { open: boolean; id: string | null; draft: TaskDraft | null };
  event: { open: boolean; id: string | null; draft: EventDraft | null };
  plan: { open: boolean; date: string | null };
  findTime: { open: boolean; taskId: string | null };
  shortcuts: boolean;
}

interface UIApi extends UIState {
  openCapture: (mode?: CaptureMode) => void;
  closeCapture: () => void;
  openTask: (idOrDraft?: string | TaskDraft) => void;
  closeTask: () => void;
  openEvent: (idOrDraft?: string | EventDraft) => void;
  closeEvent: () => void;
  openPlan: (date?: string) => void;
  closePlan: () => void;
  openFindTime: (taskId: string) => void;
  closeFindTime: () => void;
  setShortcuts: (open: boolean) => void;
}

const Ctx = createContext<UIApi | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState<UIState["capture"]>({ open: false, mode: "thought" });
  const [task, setTask] = useState<UIState["task"]>({ open: false, id: null, draft: null });
  const [event, setEvent] = useState<UIState["event"]>({ open: false, id: null, draft: null });
  const [plan, setPlan] = useState<UIState["plan"]>({ open: false, date: null });
  const [findTime, setFindTime] = useState<UIState["findTime"]>({ open: false, taskId: null });
  const [shortcuts, setShortcuts] = useState(false);

  const openCapture = useCallback((mode: CaptureMode = "thought") => setCapture({ open: true, mode }), []);
  const closeCapture = useCallback(() => setCapture((c) => ({ ...c, open: false })), []);
  const openTask = useCallback((v?: string | TaskDraft) => setTask(typeof v === "string" ? { open: true, id: v, draft: null } : { open: true, id: null, draft: v ?? {} }), []);
  const closeTask = useCallback(() => setTask((t) => ({ ...t, open: false })), []);
  const openEvent = useCallback((v?: string | EventDraft) => setEvent(typeof v === "string" ? { open: true, id: v, draft: null } : { open: true, id: null, draft: v ?? {} }), []);
  const closeEvent = useCallback(() => setEvent((e) => ({ ...e, open: false })), []);
  const openPlan = useCallback((date?: string) => setPlan({ open: true, date: date ?? null }), []);
  const closePlan = useCallback(() => setPlan((p) => ({ ...p, open: false })), []);
  const openFindTime = useCallback((taskId: string) => setFindTime({ open: true, taskId }), []);
  const closeFindTime = useCallback(() => setFindTime((f) => ({ ...f, open: false })), []);

  const value = useMemo(
    () => ({ capture, task, event, plan, findTime, shortcuts, openCapture, closeCapture, openTask, closeTask, openEvent, closeEvent, openPlan, closePlan, openFindTime, closeFindTime, setShortcuts }),
    [capture, task, event, plan, findTime, shortcuts, openCapture, closeCapture, openTask, closeTask, openEvent, closeEvent, openPlan, closePlan, openFindTime, closeFindTime],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
