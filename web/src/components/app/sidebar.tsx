"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Keyboard, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { useAIStatus } from "@/hooks/use-ai-status";
import { isTodayTask } from "@/lib/task-utils";
import { Kbd } from "@/components/ui/kbd";
import { Logo } from "./logo";
import { NAV } from "./nav-items";

export function useNavCounts() {
  const { tasks, inbox_items } = useData();
  return {
    "/inbox": inbox_items.filter((i) => i.processing_status === "needs_review" || i.processing_status === "pending" || i.processing_status === "failed").length,
    "/today": tasks.filter((t) => t.status !== "done" && isTodayTask(t)).length,
  } as Record<string, number>;
}

export function Sidebar() {
  const pathname = usePathname();
  const ui = useUI();
  const { profile, user } = useData();
  const counts = useNavCounts();
  const ai = useAIStatus();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-4 md:flex" aria-label="Primary">
      <Link href="/today" className="mb-6 px-2" aria-label="DAYZERO home">
        <Logo />
      </Link>
      <button onClick={() => ui.openCapture()} className="mb-4 flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg shadow-soft transition hover:brightness-105 active:scale-[0.99]" data-testid="sidebar-capture">
        <Plus className="h-4 w-4" />
        Capture
        <span className="ml-auto flex gap-0.5 opacity-70">
          <Kbd className="border-accent-fg/20 bg-transparent text-accent-fg">C</Kbd>
        </span>
      </button>
      <nav className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = counts[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors", active ? "bg-elevated font-medium text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg")}
            >
              <item.icon className={cn("h-4 w-4", active ? "text-accent" : "text-subtle group-hover:text-muted")} strokeWidth={active ? 2.1 : 1.8} />
              {item.label}
              {count ? <span className={cn("ml-auto text-2xs tabular-nums", item.href === "/inbox" ? "rounded-full bg-accent/15 px-1.5 py-px font-semibold text-accent" : "text-subtle")}>{count}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-line pt-3">
        {ai && (
          <div className="flex items-center gap-2 px-2 text-2xs text-subtle" title={ai.ai ? `AI model: ${ai.model}` : "No ANTHROPIC_API_KEY configured — using on-device fallbacks"}>
            <Sparkles className={cn("h-3 w-3", ai.ai ? "text-accent" : "text-subtle")} />
            {ai.ai ? "AI connected" : "AI offline · on-device mode"}
            {ai.backend === "demo" && <span className="ml-auto rounded bg-warning/15 px-1 py-px font-medium text-warning">Demo</span>}
          </div>
        )}
        <button onClick={() => ui.setShortcuts(true)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-2xs text-subtle hover:text-fg">
          <Keyboard className="h-3 w-3" /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
        </button>
        <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-elevated/60">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-elevated text-xs font-semibold text-fg">{(profile?.full_name || user.email).slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">{profile?.full_name || "You"}</span>
            <span className="block truncate text-2xs text-subtle">{user.email}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
