"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Briefcase, Check, GraduationCap, Heart, Infinity as InfinityIcon, Layers, Rocket, Sparkles, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { CategoryTag } from "@/components/ui/badge";
import { LogoMark } from "@/components/app/logo";
import { useData } from "@/providers/data-provider";
import { useSnapshotSource } from "@/hooks/use-snapshot";
import { ApiError, postApi } from "@/lib/client-api";
import { DEFAULT_PREFERENCES, type Extraction, type FocusArea, type Preferences } from "@/lib/types";
import { formatDateKey, localTimeZone } from "@/lib/time";
import { cn } from "@/lib/cn";

const AREAS: { id: FocusArea; label: string; icon: typeof Briefcase; hint: string }[] = [
  { id: "school", label: "School", icon: GraduationCap, hint: "Classes, assignments, exams" },
  { id: "work", label: "Work", icon: Briefcase, hint: "Meetings, projects, deadlines" },
  { id: "business", label: "Business", icon: Rocket, hint: "Clients, suppliers, launches" },
  { id: "personal", label: "Personal life", icon: Heart, hint: "Errands, family, health" },
  { id: "projects", label: "Projects", icon: Layers, hint: "Side projects and builds" },
  { id: "goals", label: "Goals", icon: Target, hint: "Skills and ambitions" },
  { id: "everything", label: "Everything", icon: InfinityIcon, hint: "All of the above" },
];

const EXAMPLE = "Remember I have chemistry homework due Thursday and need to call the supplier Friday. Dentist next Tuesday at 4pm.";
const STEPS = 5;

export function OnboardingScreen() {
  const { profile, updateProfile, createInboxItem } = useData();
  const router = useRouter();
  const src = useSnapshotSource();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [prefs, setPrefs] = useState<Preferences>({ ...DEFAULT_PREFERENCES, ...profile?.preferences, focus_areas: profile?.preferences.focus_areas?.filter((a) => a !== "everything") ?? [] });
  const [name, setName] = useState(profile?.full_name ?? "");
  const [tryText, setTryText] = useState(EXAMPLE);
  const [result, setResult] = useState<Extraction | null>(null);
  const [trying, setTrying] = useState(false);
  const [tryError, setTryError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const toggleArea = (id: FocusArea) =>
    setPrefs((p) => {
      if (id === "everything") return { ...p, focus_areas: p.focus_areas.includes("everything") ? [] : ["everything"] };
      const without = p.focus_areas.filter((a) => a !== "everything" && a !== id);
      return { ...p, focus_areas: p.focus_areas.includes(id) ? without : [...without, id] };
    });

  const tryIt = async () => {
    setTrying(true);
    setTryError(null);
    try {
      const res = await postApi<{ extraction: Extraction }>("/api/ai/extract", { text: tryText, contentType: "text" }, { ...src, preferences: prefs });
      setResult(res.extraction);
    } catch (e) {
      setTryError(e instanceof ApiError ? e.message : "Couldn't process that.");
    } finally {
      setTrying(false);
    }
  };

  const finish = async (skipped = false) => {
    setFinishing(true);
    const finalPrefs = { ...prefs, focus_areas: prefs.focus_areas.length ? prefs.focus_areas : (["everything"] as FocusArea[]) };
    await updateProfile({ full_name: name.trim() || profile?.full_name || "", preferences: skipped ? { ...DEFAULT_PREFERENCES, ...profile?.preferences } : finalPrefs, timezone: localTimeZone(), onboarded: true });
    if (!skipped && result && result.items.length) {
      await createInboxItem({ original_content: tryText, content_type: "text", extracted_data: result, processing_status: "needs_review" });
    }
    router.replace(!skipped && result?.items.length ? "/inbox" : "/today");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <LogoMark />
        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cn("h-1 rounded-full transition-all", i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/50" : "w-3 bg-elevated")} />
          ))}
        </div>
        {step < STEPS - 1 ? (
          <button onClick={() => finish(true)} className="text-xs font-medium text-muted hover:text-fg" disabled={finishing} data-testid="skip-onboarding">
            Skip
          </button>
        ) : (
          <span className="w-8" />
        )}
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-10 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
              {step === 0 && (
                <div className="text-center">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Welcome to DAYZERO</p>
                  <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your life, finally organized.</h1>
                  <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">Send DAYZERO anything — a screenshot, a text, a voice note, a half-formed thought. It figures out what matters and turns it into a plan.</p>
                  <div className="mx-auto mt-8 max-w-xs text-left">
                    <label htmlFor="ob-name" className="mb-1.5 block text-xs font-medium text-muted">
                      What should we call you?
                    </label>
                    <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" className="h-11 text-[15px]" maxLength={120} />
                  </div>
                  <Button variant="primary" size="lg" className="mt-6" onClick={() => go(1)} data-testid="onboarding-next">
                    Get started <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What do you want help organizing?</h1>
                  <p className="mt-2 text-sm text-muted">Pick as many as you like. This shapes your suggestions — you can change it later.</p>
                  <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {AREAS.map((a) => {
                      const on = prefs.focus_areas.includes(a.id);
                      return (
                        <button key={a.id} type="button" onClick={() => toggleArea(a.id)} aria-pressed={on} className={cn("relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition", on ? "border-accent/60 bg-accent/[0.07]" : "border-line bg-card hover:border-line-strong")}>
                          <a.icon className={cn("h-5 w-5", on ? "text-accent" : "text-muted")} strokeWidth={1.8} />
                          <span>
                            <span className="block text-sm font-medium">{a.label}</span>
                            <span className="block text-2xs text-subtle">{a.hint}</span>
                          </span>
                          {on && (
                            <span className="absolute right-2.5 top-2.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-fg">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">How do you like to plan?</h1>
                  <p className="mt-2 text-sm text-muted">DAYZERO only schedules inside your working hours and never moves your events.</p>
                  <div className="mt-6 space-y-5 rounded-xl border border-line bg-card p-5">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">When do you plan your day?</p>
                      <Segmented
                        label="Planning time"
                        value={prefs.planning_time}
                        onChange={(v) => setPrefs((p) => ({ ...p, planning_time: v }))}
                        options={[
                          { value: "morning", label: "Morning of" },
                          { value: "evening", label: "Evening before" },
                        ]}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Preferred working hours</p>
                      <div className="flex items-center gap-2">
                        <Input type="time" aria-label="Start" value={prefs.work_start} onChange={(e) => e.target.value && setPrefs((p) => ({ ...p, work_start: e.target.value }))} className="w-32" />
                        <span className="text-subtle">to</span>
                        <Input type="time" aria-label="End" value={prefs.work_end} onChange={(e) => e.target.value && setPrefs((p) => ({ ...p, work_end: e.target.value }))} className="w-32" />
                      </div>
                      {prefs.work_end <= prefs.work_start && <p className="text-xs text-danger">End time should be after start time.</p>}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="ob-avail" className="text-sm font-medium">
                        Time you typically have for focused tasks
                      </label>
                      <Select id="ob-avail" value={prefs.daily_focus_minutes} onChange={(e) => setPrefs((p) => ({ ...p, daily_focus_minutes: Number(e.target.value) }))} className="w-48">
                        {[60, 120, 180, 240, 300, 360, 480].map((m) => (
                          <option key={m} value={m}>
                            About {m / 60} hour{m > 60 ? "s" : ""} a day
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Reminders</p>
                      <Segmented
                        label="Reminders"
                        value={prefs.reminders}
                        onChange={(v) => setPrefs((p) => ({ ...p, reminders: v }))}
                        options={[
                          { value: "off", label: "None" },
                          { value: "gentle", label: "Gentle" },
                          { value: "standard", label: "Standard" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Capture anything. We&apos;ll sort it out.</h1>
                  <p className="mt-2 text-sm text-muted">Type it, paste it, screenshot it or say it. Try it now:</p>
                  <div className="mt-5 rounded-xl border border-line bg-card p-3">
                    <Textarea value={tryText} onChange={(e) => (setTryText(e.target.value), setResult(null))} rows={3} aria-label="Try a capture" className="border-0 bg-transparent px-1 text-[15px] focus:ring-0" />
                    <div className="flex justify-end">
                      <Button variant="primary" size="sm" onClick={tryIt} loading={trying} disabled={!tryText.trim()} data-testid="onboarding-try">
                        <Sparkles className="h-3.5 w-3.5" /> Organize this
                      </Button>
                    </div>
                  </div>
                  {tryError && <p className="mt-3 text-sm text-danger">{tryError}</p>}
                  {trying && (
                    <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                      <Spinner className="h-3.5 w-3.5 text-accent" /> Understanding…
                    </p>
                  )}
                  {result && (
                    <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-2" aria-label="What DAYZERO found">
                      {result.items.map((i, idx) => (
                        <motion.li key={i.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                          <span className="rounded-md bg-elevated px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted">{i.kind}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.title}</span>
                          {i.date && <span className="shrink-0 text-xs text-muted">{formatDateKey(i.date, { weekday: "short", month: "short", day: "numeric" })}{i.time ? ` · ${i.time}` : ""}</span>}
                          <CategoryTag category={i.category} className="hidden shrink-0 sm:inline-flex" />
                        </motion.li>
                      ))}
                      {result.items.some((i) => i.needs_confirmation) && <li className="text-xs text-warning">Anything ambiguous is flagged for you to confirm — DAYZERO never invents a deadline.</li>}
                      {result.notice && <li className="text-2xs text-subtle">{result.notice}</li>}
                    </motion.ul>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="text-center">
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-fg">
                    <Check className="h-7 w-7" strokeWidth={2.6} />
                  </motion.div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your dashboard is ready{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}.</h1>
                  <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-muted">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Focused on {prefs.focus_areas.length && !prefs.focus_areas.includes("everything") ? prefs.focus_areas.map((a) => AREAS.find((x) => x.id === a)?.label.toLowerCase()).join(", ") : "everything"}
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Plans fit {prefs.work_start}–{prefs.work_end}, about {prefs.daily_focus_minutes / 60}h of focus a day
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {prefs.planning_time === "morning" ? "Morning" : "Evening"} planning · {prefs.reminders === "off" ? "no reminders" : `${prefs.reminders} reminders`}
                    </li>
                    {result && result.items.length > 0 && (
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Your first capture is waiting in the Inbox for review
                      </li>
                    )}
                  </ul>
                  <Button variant="primary" size="lg" className="mt-8" onClick={() => finish(false)} loading={finishing} data-testid="onboarding-finish">
                    Open DAYZERO <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {step > 0 && step < 4 && (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" onClick={() => go(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="primary" onClick={() => go(step + 1)} disabled={step === 2 && prefs.work_end <= prefs.work_start} data-testid="onboarding-next">
                {step === 3 && !result ? "Skip this" : "Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
