import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Category, Priority } from "@/lib/types";

export function Badge({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: "neutral" | "accent" | "warning" | "danger" | "success" }) {
  const tones = {
    neutral: "bg-elevated text-muted border-line",
    accent: "bg-accent/10 text-accent border-accent/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    danger: "bg-danger/10 text-danger border-danger/20",
    success: "bg-success/10 text-success border-success/20",
  };
  return <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-2xs font-medium", tones[tone], className)}>{children}</span>;
}

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export function PriorityFlag({ priority, showLabel = false }: { priority: Priority; showLabel?: boolean }) {
  if (priority === "normal" && !showLabel) return null;
  const color = { urgent: "text-danger", high: "text-warning", normal: "text-muted", low: "text-subtle" }[priority];
  const bars = { urgent: 3, high: 2, normal: 1, low: 0 }[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-2xs font-medium", color)} title={`${PRIORITY_LABEL[priority]} priority`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={i * 3.5} y={7 - i * 3} width="2.5" height={3 + i * 3} rx="0.75" fill="currentColor" opacity={i < bars ? 1 : 0.25} />
        ))}
      </svg>
      {(showLabel || priority === "urgent") && <span>{PRIORITY_LABEL[priority]}</span>}
      <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>
    </span>
  );
}

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  personal: { label: "Personal", color: "#8FB8F2" },
  school: { label: "School", color: "#C79BF2" },
  work: { label: "Work", color: "#6FD3C7" },
  business: { label: "Business", color: "#F2C66D" },
  health: { label: "Health", color: "#80D99B" },
  other: { label: "Other", color: "#9BA49D" },
};

export function CategoryTag({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-2xs font-medium text-muted", className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
