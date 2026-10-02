/**
 * Minimal client router that stands in for Next.js routing in the single-file
 * preview. The path lives in memory and is mirrored to a bare "#path" hash.
 */
import { useSyncExternalStore } from "react";

type Loc = { pathname: string; search: string };
const listeners = new Set<() => void>();

function initial(): Loc {
  try {
    const h = window.location.hash.replace(/^#/, "");
    if (/^[a-z-]+$/.test(h)) return { pathname: `/${h}`, search: "" };
  } catch {}
  return { pathname: "/", search: "" };
}

let loc: Loc = initial();

export function navigate(href: string, replace = false) {
  const url = new URL(href, "http://x");
  loc = { pathname: url.pathname, search: url.search };
  try {
    const token = url.pathname.replace(/^\//, "");
    const hash = token ? `#${token}` : " ";
    if (replace) history.replaceState(null, "", hash.trim() || window.location.pathname);
    else history.pushState(null, "", hash.trim() || window.location.pathname);
  } catch {}
  if (url.hash) setTimeout(() => document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
  else if (!replace) window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

try {
  window.addEventListener("popstate", () => {
    loc = initial();
    listeners.forEach((l) => l());
  });
} catch {}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLocation() {
  return useSyncExternalStore(subscribe, () => loc, () => loc);
}
