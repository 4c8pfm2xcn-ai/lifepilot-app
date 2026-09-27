"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 8_000;
const MAX_CHECKS = 150;

/**
 * Keeps list pages (library, dashboard, favorites, projects) up to date while
 * any listed generation is still queued or processing. Each check calls the
 * status endpoint, which syncs with the provider (rate-limited server-side),
 * and refreshes the page once something finishes.
 */
export function ActiveRefresher({ ids }: { ids: string[] }) {
  const router = useRouter();
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    const pending = new Set(key.split(","));
    let checks = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      checks += 1;
      if (document.visibilityState === "visible") {
        let finished = false;
        // Sequential on purpose: keeps request volume low.
        for (const id of [...pending].slice(0, 6)) {
          try {
            const res = await fetch(`/api/generation/${id}`, { cache: "no-store", credentials: "same-origin" });
            if (!res.ok) {
              pending.delete(id);
              continue;
            }
            const body = (await res.json()) as { status: string };
            if (body.status === "completed" || body.status === "failed" || body.status === "cancelled") {
              pending.delete(id);
              finished = true;
            }
          } catch {
            // Network hiccup: try again next tick.
          }
        }
        if (finished) router.refresh();
      }
      if (pending.size > 0 && checks < MAX_CHECKS && !stopped) timer = setTimeout(tick, INTERVAL_MS);
    };

    timer = setTimeout(tick, INTERVAL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [key, router]);

  return null;
}
