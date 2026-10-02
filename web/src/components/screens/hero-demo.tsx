"use client";
import { motion } from "framer-motion";
import { CalendarClock, CheckSquare, Sparkles } from "lucide-react";

/** Illustrative product visual: a raw capture turning into organized items. */
export function HeroDemo() {
  const items = [
    { icon: CheckSquare, title: "Chemistry homework", meta: "Due Thursday · School", dot: "#C79BF2" },
    { icon: CheckSquare, title: "Call the supplier", meta: "Friday · Business", dot: "#F2C66D" },
    { icon: CalendarClock, title: "Dentist", meta: "Tue 4:00 PM · Health", dot: "#80D99B" },
  ];
  return (
    <div className="relative" aria-label="Example: a message becomes organized tasks and events" role="img">
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_top_right,rgb(var(--accent)/0.10),transparent_60%)]" aria-hidden="true" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-line bg-card p-4 shadow-pop">
        <p className="label mb-2">Capture</p>
        <p className="rounded-xl bg-surface px-4 py-3 text-[15px] leading-relaxed text-fg/90">
          “Remember I have chemistry homework due Thursday and need to call the supplier Friday. Dentist next Tuesday at 4.”
        </p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="my-3 flex items-center gap-2 pl-4 text-xs text-muted">
        <Sparkles className="h-3.5 w-3.5 text-accent" /> Understood · 2 tasks, 1 event
      </motion.div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <motion.div key={it.title} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.15, duration: 0.35 }} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
            <it.icon className="h-4 w-4 text-muted" />
            <span className="flex-1 text-sm font-medium">{it.title}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: it.dot }} />
              {it.meta}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
