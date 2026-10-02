import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, Image as ImageIcon, Inbox, Lock, MessageSquare, Mic, ShieldCheck, Sparkles, Target, Type } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { HeroActions, NavActions } from "@/components/screens/landing-actions";
import { HeroDemo } from "@/components/screens/hero-demo";

const STEPS = [
  { title: "Capture", body: "Screenshots, texts, voice notes, stray thoughts. No sorting required." },
  { title: "Understand", body: "DAYZERO finds the tasks, deadlines, events and ideas inside." },
  { title: "Organize", body: "Everything lands in the right place, ready for you to confirm." },
  { title: "Act", body: "A realistic plan for today that respects your calendar." },
  { title: "Improve", body: "Honest insights from what you actually did — no guilt." },
];

const FEATURES = [
  { icon: Inbox, title: "Smart inbox", body: "Paste a group chat or snap a syllabus. Each item is extracted, categorized and flagged if anything is ambiguous — never an invented deadline." },
  { icon: Sparkles, title: "Plan my day", body: "One tap builds a schedule around your meetings and working hours. You approve it before anything moves." },
  { icon: MessageSquare, title: "An assistant that asks first", body: "“What's overdue?” “Plan my afternoon.” It proposes changes; you confirm each one." },
  { icon: CalendarDays, title: "Calendar that prevents conflicts", body: "Month, week, day and agenda views with drag-to-schedule — and a clear warning before anything double-books." },
  { icon: Target, title: "Goals with real progress", body: "Break big goals into milestones, link tasks, and watch progress that's calculated, not guessed." },
  { icon: BarChart3, title: "Insights from real data", body: "Weekly trends and workload ahead, computed from your own records." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <NavActions />
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your AI personal operating system
            </p>
            <h1 className="text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              Everything,
              <br />
              organized.
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted">
              Send DAYZERO the scattered pieces of your life — screenshots, messages, voice notes, half-formed thoughts. It turns them into tasks, events and a realistic plan for today.
            </p>
            <div className="mt-6 flex items-center gap-4 text-xs text-subtle">
              <span className="inline-flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" /> Text
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Screenshots
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Voice
              </span>
            </div>
            <HeroActions />
          </div>
          <HeroDemo />
        </section>

        <section className="border-y border-line bg-surface/50">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <p className="label mb-8">How it works</p>
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="font-mono text-xs text-accent">0{i + 1}</span>
                  <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight">Spend seconds capturing, not twenty minutes organizing the organizer.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6">
                <f.icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
                <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <div className="grid gap-6 rounded-2xl border border-line bg-card p-8 sm:grid-cols-[auto_1fr] sm:items-center sm:p-10">
            <ShieldCheck className="h-8 w-8 text-accent" strokeWidth={1.6} />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Private by design. In control by default.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Your data is isolated to your account with database row-level security. The AI runs server-side and never changes anything without your confirmation. Export everything, or delete it, any time.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24 text-center sm:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start with a clean slate.</h2>
          <p className="mt-3 text-muted">Day zero is today.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/signup" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg shadow-soft transition hover:brightness-105">
              Create your free account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-subtle sm:px-8">
          <span>© {new Date().getFullYear()} DAYZERO</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Everything, organized.
          </span>
        </div>
      </footer>
    </div>
  );
}
