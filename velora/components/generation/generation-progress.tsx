"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiFetch } from "@/lib/client/api";
import type { GenerationStatus } from "@/lib/video/types";

interface StatusResponse {
  id: string;
  status: GenerationStatus;
  progress: number | null;
  errorMessage: string | null;
}

const BASE_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 15_000;

/**
 * Polls the status endpoint while a generation is active. The interval starts
 * at the provider's minimum (5s), backs off over time, and pauses while the tab
 * is hidden, so we never hammer the provider.
 */
export function GenerationProgress({
  id,
  initialStatus,
  initialProgress,
  createdAt,
}: {
  id: string;
  initialStatus: GenerationStatus;
  initialProgress: number | null;
  createdAt: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [pollError, setPollError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const attempts = useRef(0);
  const lastStatus = useRef(initialStatus);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [createdAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = () => {
      const delay = Math.min(MAX_INTERVAL_MS, BASE_INTERVAL_MS + attempts.current * 500);
      timer = setTimeout(poll, delay);
    };

    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      attempts.current += 1;
      try {
        const res = await apiFetch<StatusResponse>(`/api/generation/${id}`, { cache: "no-store" });
        setPollError(null);
        // Re-render the server parts of the page (e.g. the Details badge) when the status changes.
        if (res.status !== lastStatus.current) {
          lastStatus.current = res.status;
          router.refresh();
        }
        setStatus(res.status);
        setProgress(res.progress);
        if (res.status === "completed" || res.status === "failed" || res.status === "cancelled") {
          stopped = true;
          router.refresh();
          return;
        }
      } catch (e) {
        setPollError(e instanceof Error ? e.message : "Could not check status.");
      }
      schedule();
    };

    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopped) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, router]);

  async function onCancel() {
    setCancelling(true);
    try {
      await apiFetch(`/api/generation/${id}/cancel`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Could not cancel.");
      setCancelling(false);
    }
  }

  const pct = progress !== null ? Math.round(progress * 100) : null;
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-3xl border hairline bg-ink-900 px-6 text-center">
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aurora-violet/15 blur-[90px] animate-pulse-soft" />
        <div className="absolute left-[35%] top-[40%] h-48 w-48 rounded-full bg-aurora-blue/10 blur-[80px] animate-pulse-soft [animation-delay:1.2s]" />
      </div>
      <div className="relative flex flex-col items-center" aria-live="polite">
        <StatusBadge status={status} />
        <p className="mt-4 font-display text-3xl text-fog-50 sm:text-4xl">
          {status === "queued" ? "Waiting in the queue" : "Generating your video"}
        </p>
        <p className="mt-2 text-sm text-fog-400">
          {status === "queued"
            ? "The provider will start shortly. You can leave this page — we'll keep your video."
            : "This usually takes a minute or two. You can leave this page — we'll keep your video."}
        </p>
        <div className="mt-6 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label="Generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
          {pct !== null ? (
            <div className="h-full rounded-full bg-gradient-to-r from-aurora-violet to-aurora-blue transition-[width] duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
        </div>
        <p className="mt-3 text-xs tabular-nums text-fog-500">
          {pct !== null ? `${pct}% · ` : ""}
          {mm}:{ss} elapsed
        </p>
        {pollError ? <p className="mt-3 text-xs text-warning">{pollError} Retrying…</p> : null}
        <Button variant="ghost" size="sm" className="mt-5" onClick={onCancel} loading={cancelling}>
          Cancel generation
        </Button>
      </div>
    </div>
  );
}
