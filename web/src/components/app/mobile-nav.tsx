"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useUI } from "@/providers/ui-provider";
import { Dialog } from "@/components/ui/dialog";
import { NAV } from "./nav-items";
import { useNavCounts } from "./sidebar";

const PRIMARY = ["/today", "/inbox", "/tasks", "/calendar"];

export function MobileNav() {
  const pathname = usePathname();
  const ui = useUI();
  const counts = useNavCounts();
  const [more, setMore] = useState(false);
  const moreActive = !PRIMARY.some((p) => pathname.startsWith(p));

  return (
    <>
      <button
        onClick={() => ui.openCapture()}
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-pop transition active:scale-95 md:hidden"
        aria-label="Quick capture"
        data-testid="fab-capture"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-safe backdrop-blur-xl md:hidden" aria-label="Primary">
        <ul className="grid h-[60px] grid-cols-5">
          {NAV.filter((n) => PRIMARY.includes(n.href)).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-fg" : "text-subtle")}>
                  <item.icon className={cn("h-5 w-5", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                  {item.href === "/inbox" && counts["/inbox"] ? <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-accent" aria-label={`${counts["/inbox"]} to review`} /> : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} className={cn("flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium", moreActive ? "text-fg" : "text-subtle")} aria-haspopup="dialog">
              <MoreHorizontal className={cn("h-5 w-5", moreActive && "text-accent")} />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={more} onClose={() => setMore(false)} title="More">
        <ul className="grid grid-cols-2 gap-2 pb-2">
          {NAV.filter((n) => !PRIMARY.includes(n.href)).map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setMore(false)} className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-4 text-sm font-medium", pathname.startsWith(item.href) && "border-accent/40")}>
                <item.icon className="h-5 w-5 text-muted" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
