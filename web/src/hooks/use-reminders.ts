"use client";
import { useEffect, useRef } from "react";
import { useData } from "@/providers/data-provider";
import { useToast } from "@/components/ui/toast";
import { formatTime } from "@/lib/time";

/**
 * In-app reminders while DAYZERO is open: upcoming events and timed deadlines.
 * Uses system notifications when the user granted permission, otherwise a toast.
 * (Background push notifications would need a service worker + push server.)
 */
export function useReminders() {
  const { tasks, events, profile } = useData();
  const { toast } = useToast();
  const fired = useRef(new Set<string>());
  const latest = useRef({ tasks, events, profile });
  latest.current = { tasks, events, profile };

  useEffect(() => {
    const check = () => {
      const { tasks, events, profile } = latest.current;
      if (!profile || profile.preferences.reminders === "off") return;
      const lead = profile.preferences.reminders === "standard" ? 15 : 10;
      const now = Date.now();
      const notify = (key: string, title: string, body: string) => {
        if (fired.current.has(key)) return;
        fired.current.add(key);
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification(title, { body, icon: "/icon.svg", tag: key });
        } else toast(`${title} — ${body}`);
      };
      if (profile.preferences.notify_events) {
        for (const e of events) {
          if (e.all_day) continue;
          const s = Date.parse(e.start_at);
          if (s > now && s - now <= lead * 60000) notify(`ev:${e.id}:${e.start_at}`, e.title, `Starts at ${formatTime(e.start_at)}`);
        }
      }
      for (const t of tasks) {
        if (t.status === "done") continue;
        if (profile.preferences.notify_deadlines && t.due_at && !t.due_all_day) {
          const d = Date.parse(t.due_at);
          if (d > now && d - now <= lead * 60000) notify(`due:${t.id}:${t.due_at}`, t.title, `Due at ${formatTime(t.due_at)}`);
        }
        if (t.scheduled_start) {
          const s = Date.parse(t.scheduled_start);
          if (s > now && s - now <= 5 * 60000) notify(`blk:${t.id}:${t.scheduled_start}`, t.title, `Focus block starts at ${formatTime(t.scheduled_start)}`);
        }
      }
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
  }, [toast]);
}
