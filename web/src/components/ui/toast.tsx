"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { uid } from "@/lib/id";

type Tone = "default" | "success" | "error";
interface Toast {
  id: string;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastApi {
  toast: (message: string, opts?: { tone?: Tone; action?: Toast["action"]; duration?: number }) => string;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback<ToastApi["toast"]>(
    (message, opts = {}) => {
      const id = uid();
      const t: Toast = { id, message, tone: opts.tone ?? "default", action: opts.action, duration: opts.duration ?? (opts.action ? 6000 : 3500) };
      setToasts((prev) => [...prev.slice(-3), t]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), t.duration));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6" role="region" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm shadow-pop"
            >
              {t.tone === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : t.tone === "error" ? <AlertCircle className="h-4 w-4 shrink-0 text-danger" /> : <Info className="h-4 w-4 shrink-0 text-muted" />}
              <span className="min-w-0 flex-1 text-fg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className={cn("shrink-0 rounded p-0.5 text-subtle hover:text-fg")}>
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
