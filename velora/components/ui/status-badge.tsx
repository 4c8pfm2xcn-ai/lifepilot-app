import type { GenerationStatus } from "@/lib/video/types";

import { cn } from "./cn";

const STYLES: Record<GenerationStatus, { label: string; className: string; dot: string }> = {
  queued: { label: "Queued", className: "text-fog-200 bg-white/[0.06]", dot: "bg-fog-400 animate-pulse-soft" },
  processing: { label: "Generating", className: "text-aurora-blue bg-aurora-blue/10", dot: "bg-aurora-blue animate-pulse-soft" },
  completed: { label: "Completed", className: "text-success bg-success/10", dot: "bg-success" },
  failed: { label: "Failed", className: "text-danger bg-danger/10", dot: "bg-danger" },
  cancelled: { label: "Cancelled", className: "text-fog-400 bg-white/[0.05]", dot: "bg-fog-500" },
};

export function StatusBadge({ status, className }: { status: GenerationStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.className, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}
