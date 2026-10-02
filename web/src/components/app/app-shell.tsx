"use client";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { useData } from "@/providers/data-provider";
import { Button } from "@/components/ui/button";
import { useReminders } from "@/hooks/use-reminders";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CaptureDialog } from "./capture-dialog";
import { TaskEditor } from "./task-editor";
import { EventEditor } from "./event-editor";
import { PlanDayDialog } from "./plan-day-dialog";
import { FindTimeDialog } from "./find-time-dialog";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
import { Splash } from "./splash";
import { LogoMark } from "./logo";
import Link from "next/link";

function Chrome({ children }: { children: React.ReactNode }) {
  const { profile, wipeAll } = useData();
  const [confirmFresh, setConfirmFresh] = useState(false);
  useGlobalShortcuts();
  useReminders();
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-xl md:hidden">
          <Link href="/today" className="flex items-center gap-2" aria-label="DAYZERO home">
            <LogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-[0.08em]">DAYZERO</span>
          </Link>
          <Link href="/settings" className="grid h-8 w-8 place-items-center rounded-full bg-elevated text-xs font-semibold" aria-label="Settings">
            {(profile?.full_name || "?").slice(0, 1).toUpperCase()}
          </Link>
        </header>
        {profile?.is_sample && (
          <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/[0.06] px-4 py-2 text-xs text-warning md:px-8">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">You&apos;re exploring with sample data. Everything you do here is saved in this browser.</span>
            <button className="shrink-0 font-semibold underline-offset-2 hover:underline" onClick={() => setConfirmFresh(true)}>
              Start fresh
            </button>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
      <MobileNav />
      <CaptureDialog />
      <TaskEditor />
      <EventEditor />
      <PlanDayDialog />
      <FindTimeDialog />
      <ShortcutsDialog />
      <ConfirmDialog
        open={confirmFresh}
        onClose={() => setConfirmFresh(false)}
        destructive
        title="Start fresh?"
        description="All sample tasks, events, goals and captures will be removed."
        confirmLabel="Remove sample data"
        onConfirm={async () => {
          setConfirmFresh(false);
          await wipeAll();
        }}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, loadError, reload, profile } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname === "/onboarding";

  useEffect(() => {
    if (ready && profile && !profile.onboarded && !onboarding) router.replace("/onboarding");
  }, [ready, profile, onboarding, router]);

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm text-center" role="alert">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-warning" />
          <h1 className="font-semibold">We couldn&apos;t load your data</h1>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
          <Button variant="primary" className="mt-5" onClick={reload}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (!ready || (!profile?.onboarded && !onboarding)) return <Splash />;
  if (onboarding) return <>{children}</>;
  return <Chrome>{children}</Chrome>;
}
