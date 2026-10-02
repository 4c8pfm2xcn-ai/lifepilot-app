import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app/logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/" aria-label="DAYZERO home">
          <Logo />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-8 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function DemoNotice() {
  return (
    <p className="mb-5 rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2.5 text-xs leading-relaxed text-warning">
      <span className="font-semibold">Demo mode.</span> Supabase isn&apos;t configured, so accounts and data are stored only in this browser.
    </p>
  );
}
