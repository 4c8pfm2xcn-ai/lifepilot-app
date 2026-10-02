import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="rgb(var(--elevated))" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgb(var(--line) / var(--line-strong-alpha))" />
      <circle cx="16" cy="17" r="7.25" fill="none" stroke="rgb(var(--fg))" strokeWidth="2.5" />
      <circle cx="21.5" cy="10.5" r="3" fill="rgb(var(--accent))" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[0.08em]">DAYZERO</span>
    </span>
  );
}
