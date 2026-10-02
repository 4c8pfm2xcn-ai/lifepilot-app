"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal. Renders as a bottom sheet on small screens and a centered
 * panel (or right-hand drawer with `side="right"`) on larger ones. Traps focus,
 * closes on Escape and backdrop click, and restores focus on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side = "center",
  hideTitle = false,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "center" | "right";
  hideTitle?: boolean;
  initialFocus?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = (initialFocus && panel.querySelector<HTMLElement>(initialFocus)) || panel.querySelector<HTMLElement>("[data-autofocus]") || panel.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel).focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocus]);

  if (typeof document === "undefined") return null;
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-50 flex items-end sm:items-center", side === "right" ? "sm:justify-end" : "sm:justify-center sm:p-6")}>
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={side === "right" ? { x: 40, opacity: 0 } : { y: 24, opacity: 0, scale: 0.99 }}
            animate={side === "right" ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side === "right" ? { x: 40, opacity: 0 } : { y: 24, opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-card shadow-pop focus:outline-none",
              "rounded-t-2xl sm:rounded-xl",
              side === "right" ? "sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0" : widths[size],
            )}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
            <div className={cn("flex items-start justify-between gap-4 px-5 pb-3 pt-4", hideTitle && "sr-only")}>
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold tracking-tight">
                  {title}
                </h2>
                {description && (
                  <div id={descId} className="mt-0.5 text-sm text-muted">
                    {description}
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg" aria-label="Close dialog">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface/60 px-5 py-3 pb-safe">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  loading,
  confirmDisabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button type="button" className="h-9 rounded-lg px-3.5 text-sm font-medium text-muted hover:bg-elevated hover:text-fg" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            data-autofocus
            disabled={loading || confirmDisabled}
            onClick={onConfirm}
            className={cn("h-9 rounded-lg px-3.5 text-sm font-medium transition disabled:opacity-50", destructive ? "bg-danger text-white hover:brightness-110" : "bg-accent text-accent-fg hover:brightness-105")}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
