import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { CreditsPill } from "@/components/dashboard/credits-pill";
import { MobileTabBar, SidebarNav } from "@/components/dashboard/nav";
import { LinkButton } from "@/components/ui/button";
import { LogoutIcon, PlusIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { MissingEnvNotice } from "@/components/ui/notice";
import { requireUserOrRedirect } from "@/lib/auth";
import { ensureCreditAccount } from "@/lib/credits/account";
import { getCreditBalance, getProfile } from "@/lib/data/queries";
import { isSupabaseConfigured, supabaseConfigChecks } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) {
    const missing = supabaseConfigChecks().filter((c) => !c.ok).map((c) => c.name);
    return (
      <div className="mx-auto max-w-xl px-5 py-20">
        <Logo />
        <div className="mt-10">
          <MissingEnvNotice what="Supabase" names={missing} />
        </div>
      </div>
    );
  }

  const user = await requireUserOrRedirect("/dashboard");
  const ensured = await ensureCreditAccount(user.id);
  const [profile, balance] = await Promise.all([getProfile(), ensured ?? getCreditBalance()]);
  const name = profile?.display_name ?? user.email ?? "Account";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-fog-50 focus:px-3 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col border-r hairline bg-ink-900/60 px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo href="/dashboard" />
        </div>
        <LinkButton href="/create" size="md" className="mt-8 w-full" icon={<PlusIcon size={16} />}>
          New video
        </LinkButton>
        <div className="mt-6">
          <SidebarNav />
        </div>
        <div className="mt-auto space-y-3 px-1">
          <CreditsPill balance={balance} />
          <div className="flex items-center justify-between gap-2 rounded-xl border hairline px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm text-fog-50">{name}</p>
              {user.email && profile?.display_name ? <p className="truncate text-xs text-fog-500">{user.email}</p> : null}
            </div>
            <form action={signOutAction}>
              <button type="submit" className="rounded-lg p-1.5 text-fog-500 hover:bg-white/5 hover:text-fog-50" aria-label="Sign out" title="Sign out">
                <LogoutIcon size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b hairline bg-ink-950/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-2">
            <CreditsPill balance={balance} />
            <LinkButtonIcon />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}

function LinkButtonIcon() {
  return (
    <Link href="/settings" className="rounded-lg p-2 text-fog-400 hover:bg-white/5 hover:text-fog-50" aria-label="Settings">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    </Link>
  );
}
