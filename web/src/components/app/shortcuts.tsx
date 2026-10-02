"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useUI } from "@/providers/ui-provider";
import { NAV } from "./nav-items";

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

/** Global keyboard shortcuts: C capture, N new task, E new event, P plan day, G+key navigation, ? help. */
export function useGlobalShortcuts() {
  const ui = useUI();
  const router = useRouter();
  const pendingG = useRef<number | null>(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        uiRef.current.openCapture();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (pendingG.current) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const dest = NAV.find((n) => n.key === k);
        if (dest) {
          e.preventDefault();
          router.push(dest.href);
        }
        return;
      }
      if (k === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1200);
      } else if (k === "c") {
        e.preventDefault();
        uiRef.current.openCapture();
      } else if (k === "n") {
        e.preventDefault();
        uiRef.current.openTask();
      } else if (k === "e") {
        e.preventDefault();
        uiRef.current.openEvent();
      } else if (k === "p") {
        e.preventDefault();
        uiRef.current.openPlan();
      } else if (e.key === "?") {
        e.preventDefault();
        uiRef.current.setShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: "Create",
    items: [
      [["C"], "Quick capture"],
      [["⌘", "K"], "Quick capture (anywhere)"],
      [["N"], "New task"],
      [["E"], "New event"],
      [["P"], "Plan my day"],
    ],
  },
  { title: "Navigate", items: NAV.map((n) => [["G", n.key.toUpperCase()], n.label] as [string[], string]) },
  {
    title: "General",
    items: [
      [["/"], "Search tasks (on Tasks)"],
      [["Esc"], "Close dialog"],
      [["?"], "Show shortcuts"],
    ],
  },
];

export function ShortcutsDialog() {
  const ui = useUI();
  return (
    <Dialog open={ui.shortcuts} onClose={() => ui.setShortcuts(false)} title="Keyboard shortcuts" size="md">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className={g.title === "Navigate" ? "sm:row-span-2" : ""}>
            <h3 className="label mb-2">{g.title}</h3>
            <ul className="space-y-1.5">
              {g.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <span className="flex gap-1">
                    {keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
