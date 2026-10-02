"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/** Round completion checkbox used for tasks/milestones. */
export function CheckCircle({ checked, onChange, label, size = 20, className }: { checked: boolean; onChange: () => void; label: string; size?: number; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "group relative grid shrink-0 place-items-center rounded-full border transition-colors",
        checked ? "border-accent bg-accent" : "border-line-strong hover:border-accent/70",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <motion.svg viewBox="0 0 16 16" width={size * 0.6} height={size * 0.6} initial={false} animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }} transition={{ duration: 0.15 }} aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="rgb(var(--accent-fg))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
      {!checked && (
        <svg viewBox="0 0 16 16" width={size * 0.6} height={size * 0.6} className="absolute opacity-0 transition-opacity group-hover:opacity-40" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors", checked ? "border-accent bg-accent" : "border-line-strong bg-elevated")}
    >
      <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all", checked ? "left-[18px] bg-accent-fg" : "left-0.5 bg-muted")} />
    </button>
  );
}
