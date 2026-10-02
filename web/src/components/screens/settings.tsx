"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Brain, CalendarClock, Database, Download, Globe, KeyRound, LogOut, Moon, Palette, Sparkles, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/app/page-header";
import { useData } from "@/providers/data-provider";
import { useAuth } from "@/providers/auth-provider";
import { useAIStatus } from "@/hooks/use-ai-status";
import { localTimeZone } from "@/lib/time";
import { loadSampleData } from "@/lib/sample-data";
import { isSupabaseConfigured } from "@/lib/config";
import type { Preferences } from "@/lib/types";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "planning", label: "Planning", icon: CalendarClock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI", icon: Brain },
  { id: "account", label: "Account", icon: KeyRound },
  { id: "data", label: "Data", icon: Database },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 p-5 sm:p-6" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-[15px] font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const profileSchema = z.object({ full_name: z.string().trim().min(1, "Enter your name").max(120) });
const passwordSchema = z.object({ password: z.string().min(8, "Use at least 8 characters").max(72), confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export function SettingsScreen() {
  const data = useData();
  const { profile, user, updateProfile, updatePreferences, wipeAll, store, reload } = data;
  const { auth } = useAuth();
  const router = useRouter();
  const ai = useAIStatus();
  const { toast } = useToast();
  const prefs = profile!.preferences;
  const [confirm, setConfirm] = useState<null | "wipe" | "account">(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => setNotifPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);

  const pf = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { full_name: profile?.full_name ?? "" } });
  const pw = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { password: "", confirm: "" } });

  const timezones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return [localTimeZone()];
    }
  }, []);

  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => updatePreferences({ [k]: v } as Partial<Preferences>);

  const exportJson = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      app: "DAYZERO",
      profile,
      tasks: data.tasks,
      events: data.events,
      inbox_items: data.inbox_items,
      goals: data.goals,
      goal_milestones: data.goal_milestones,
      conversations: data.conversations,
      messages: data.messages,
    };
    download(`dayzero-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const exportCsv = () => {
    const cols = ["title", "status", "priority", "category", "due_at", "estimated_minutes", "scheduled_start", "scheduled_end", "completed_at", "description"] as const;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // avoid spreadsheet formula injection
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const csv = [cols.join(","), ...data.tasks.map((t) => cols.map((c) => esc(t[c])).join(","))].join("\n");
    download(`dayzero-tasks-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  const hasData = data.tasks.length + data.events.length + data.goals.length + data.inbox_items.length > 0;

  return (
    <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8">
      <nav className="sticky top-8 hidden h-fit space-y-0.5 lg:block" aria-label="Settings sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-elevated/60 hover:text-fg">
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </a>
        ))}
      </nav>
      <div className="max-w-2xl space-y-5">
        <PageHeader title="Settings" className="mb-2" />

        <Section id="profile" title="Profile">
          <form
            onSubmit={pf.handleSubmit(async (v) => {
              await updateProfile({ full_name: v.full_name.trim() });
              toast("Profile saved", { tone: "success" });
            })}
            className="flex items-end gap-2"
          >
            <Field label="Name" error={pf.formState.errors.full_name?.message} className="flex-1">
              {(p) => <Input {...p} {...pf.register("full_name")} autoComplete="name" />}
            </Field>
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
          <Row label="Email" hint={isSupabaseConfigured ? undefined : "Demo account — stored only in this browser"}>
            <span className="text-sm text-muted">{user.email}</span>
          </Row>
          <Row label="Timezone" htmlFor="tz" hint={profile!.timezone !== localTimeZone() ? `Your device is set to ${localTimeZone()}. Times display in your device's timezone.` : "Used by the AI when interpreting dates like “tomorrow”."}>
            <div className="flex gap-2">
              <Select id="tz" value={profile!.timezone} onChange={(e) => updateProfile({ timezone: e.target.value })} className="w-56">
                {(timezones.includes(profile!.timezone) ? timezones : [profile!.timezone, ...timezones]).map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
              {profile!.timezone !== localTimeZone() && (
                <Button size="sm" variant="outline" onClick={() => updateProfile({ timezone: localTimeZone() })}>
                  <Globe className="h-3.5 w-3.5" /> Use device
                </Button>
              )}
            </div>
          </Row>
        </Section>

        <Section id="appearance" title="Appearance">
          <Row label="Theme" hint="Dark is DAYZERO's primary look.">
            <Segmented
              label="Theme"
              value={prefs.theme}
              onChange={(v) => set("theme", v)}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "system", label: "System" },
              ]}
            />
          </Row>
        </Section>

        <Section id="planning" title="Planning" description="DAYZERO uses these when building your daily plan.">
          <Row label="I prefer to plan" hint="Plan my day defaults to tomorrow in the evening.">
            <Segmented
              label="Planning time"
              value={prefs.planning_time}
              onChange={(v) => set("planning_time", v)}
              options={[
                { value: "morning", label: "In the morning" },
                { value: "evening", label: "The evening before" },
              ]}
            />
          </Row>
          <Row label="Working hours" hint="Focus blocks are only placed inside these hours.">
            <div className="flex items-center gap-2">
              <Input type="time" aria-label="Start of working hours" value={prefs.work_start} onChange={(e) => e.target.value && e.target.value < prefs.work_end && set("work_start", e.target.value)} className="w-28" />
              <span className="text-subtle">–</span>
              <Input type="time" aria-label="End of working hours" value={prefs.work_end} onChange={(e) => e.target.value && e.target.value > prefs.work_start && set("work_end", e.target.value)} className="w-28" />
            </div>
          </Row>
          <Row label="Daily focus time" htmlFor="focus" hint="How much planned task time fits in a realistic day.">
            <Select id="focus" value={prefs.daily_focus_minutes} onChange={(e) => set("daily_focus_minutes", Number(e.target.value))} className="w-36">
              {[60, 120, 180, 240, 300, 360, 480].map((m) => (
                <option key={m} value={m}>
                  {m / 60} hours
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Week starts on" htmlFor="wk">
            <Select id="wk" value={prefs.week_starts_on} onChange={(e) => set("week_starts_on", Number(e.target.value) as 0 | 1)} className="w-36">
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </Row>
        </Section>

        <Section id="notifications" title="Notifications" description="Reminders appear while DAYZERO is open in a tab.">
          <Row label="Reminders" hint="How early to remind you before events and timed deadlines.">
            <Segmented
              label="Reminder level"
              value={prefs.reminders}
              onChange={(v) => set("reminders", v)}
              options={[
                { value: "off", label: "Off" },
                { value: "gentle", label: "10 min" },
                { value: "standard", label: "15 min" },
              ]}
            />
          </Row>
          <Row label="Upcoming events">
            <Toggle label="Remind me about upcoming events" checked={prefs.notify_events} onChange={(v) => set("notify_events", v)} />
          </Row>
          <Row label="Deadlines">
            <Toggle label="Remind me about deadlines" checked={prefs.notify_deadlines} onChange={(v) => set("notify_deadlines", v)} />
          </Row>
          <Row label="System notifications" hint={notifPerm === "granted" ? "Enabled — you'll get notifications even when this tab is in the background." : notifPerm === "denied" ? "Blocked in your browser settings. In-app reminders still work." : notifPerm === "unsupported" ? "Not supported in this browser." : "Get reminders even when this tab is in the background."}>
            <Button size="sm" variant="outline" disabled={notifPerm !== "default"} onClick={async () => setNotifPerm(await Notification.requestPermission())}>
              {notifPerm === "granted" ? "Enabled" : "Enable"}
            </Button>
          </Row>
        </Section>

        <Section id="ai" title="AI" description={ai ? (ai.ai ? `Connected · ${ai.model}` : "No AI key is configured on this server — DAYZERO uses on-device fallbacks.") : undefined}>
          <Row label="Use AI" hint="When off, captures and plans are handled on-device and nothing is sent to the AI model.">
            <Toggle label="Use AI" checked={prefs.ai_enabled} onChange={(v) => set("ai_enabled", v)} />
          </Row>
          <Row label="Organize captures automatically" hint="Process new inbox items right away instead of waiting for you.">
            <Toggle label="Organize captures automatically" checked={prefs.ai_auto_process} onChange={(v) => set("ai_auto_process", v)} />
          </Row>
          <Row label="Assistant style">
            <Segmented
              label="Assistant style"
              value={prefs.ai_tone}
              onChange={(v) => set("ai_tone", v)}
              options={[
                { value: "concise", label: "Concise" },
                { value: "detailed", label: "Detailed" },
              ]}
            />
          </Row>
          <p className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2.5 text-xs text-muted">
            <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
            The AI never changes your data on its own. Every change it proposes is shown to you first and only applied when you confirm.
          </p>
        </Section>

        <Section id="account" title="Account">
          <form
            onSubmit={pw.handleSubmit(async (v) => {
              try {
                await auth.updatePassword(v.password);
                pw.reset();
                toast("Password updated", { tone: "success" });
              } catch (e) {
                toast(e instanceof Error ? e.message : "Couldn't update password", { tone: "error" });
              }
            })}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <Field label="New password" error={pw.formState.errors.password?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...pw.register("password")} />}
            </Field>
            <Field label="Confirm" error={pw.formState.errors.confirm?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...pw.register("confirm")} />}
            </Field>
            <Button type="submit" variant="secondary">
              Update
            </Button>
          </form>
          <Row label="Sign out" hint="You can sign back in any time — your data stays saved.">
            <Button
              variant="outline"
              onClick={async () => {
                await auth.signOut();
                router.replace("/login");
              }}
              data-testid="sign-out"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </Row>
          <Row label="Delete account" hint="Permanently deletes your account and everything in it.">
            <Button variant="danger" onClick={() => (setTyped(""), setConfirm("account"))}>
              Delete account
            </Button>
          </Row>
        </Section>

        <Section id="data" title="Your data" description="Everything you put into DAYZERO belongs to you.">
          <Row label="Export everything" hint="Profile, tasks, events, captures, goals and conversations as JSON.">
            <Button variant="outline" onClick={exportJson}>
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
          </Row>
          <Row label="Export tasks" hint="A spreadsheet-friendly CSV of all tasks.">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </Row>
          {!hasData && (
            <Row label="Load sample data" hint="Fill an empty workspace with clearly-labelled example tasks, events and goals.">
              <Button
                variant="outline"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await loadSampleData(store!);
                  await updateProfile({ is_sample: true });
                  await reload();
                  setBusy(false);
                }}
              >
                <Moon className="h-3.5 w-3.5" /> Load samples
              </Button>
            </Row>
          )}
          <Row label="Delete all data" hint="Removes every task, event, capture, goal and conversation. Your account stays.">
            <Button variant="danger" onClick={() => (setTyped(""), setConfirm("wipe"))} data-testid="wipe-data">
              <Trash2 className="h-3.5 w-3.5" /> Delete data
            </Button>
          </Row>
        </Section>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        destructive
        loading={busy}
        confirmDisabled={typed !== "DELETE"}
        title={confirm === "account" ? "Delete your account?" : "Delete all your data?"}
        description={confirm === "account" ? "This permanently deletes your account and all of its data. It can't be undone." : "Every task, event, capture, goal and conversation will be permanently deleted. Consider exporting first."}
        confirmLabel={confirm === "account" ? "Delete account" : "Delete everything"}
        onConfirm={async () => {
          if (typed !== "DELETE") return;
          setBusy(true);
          try {
            if (confirm === "account") {
              await auth.deleteAccount();
              router.replace("/");
            } else {
              await wipeAll();
              toast("All data deleted", { tone: "success" });
            }
            setConfirm(null);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Something went wrong", { tone: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm text-muted">
          Type <span className="font-mono font-semibold text-fg">DELETE</span> to confirm
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className={cn("mt-2", typed && typed !== "DELETE" && "border-danger/50")} autoComplete="off" aria-label="Type DELETE to confirm" data-testid="confirm-delete-input" />
        </label>
      </ConfirmDialog>
    </div>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
