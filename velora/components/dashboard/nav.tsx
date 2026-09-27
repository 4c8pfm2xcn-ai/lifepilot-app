"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/cn";
import { FolderIcon, HeartIcon, HomeIcon, LibraryIcon, SettingsIcon, SparkIcon } from "@/components/ui/icons";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/create", label: "Create", icon: SparkIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/favorites", label: "Favorites", icon: HeartIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/library" && pathname.startsWith("/generations"));
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active ? "bg-white/[0.07] text-fog-50" : "text-fog-400 hover:bg-white/[0.04] hover:text-fog-50",
            )}
          >
            <Icon size={18} className={active ? "text-aurora-violet" : "text-fog-500 group-hover:text-fog-200"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const MOBILE_ITEMS = NAV_ITEMS.filter((i) => i.href !== "/settings" && i.href !== "/favorites");

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const isCreate = href === "/create";
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "text-fog-50" : "text-fog-500")}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl",
                    isCreate && "bg-fog-50 text-ink-950",
                    !isCreate && active && "text-aurora-violet",
                  )}
                >
                  <Icon size={18} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
