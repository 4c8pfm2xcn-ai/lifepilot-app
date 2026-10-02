"use client";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface p-0.5 scrollbar-none", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors",
            size === "sm" ? "h-6 px-2 text-2xs" : "h-7 px-2.5 text-xs",
            value === o.value ? "bg-elevated text-fg shadow-soft" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className={cn("tabular-nums", value === o.value ? "text-muted" : "text-subtle")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
