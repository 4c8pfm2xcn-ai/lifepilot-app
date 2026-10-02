"use client";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useDemoLogin } from "@/hooks/use-demo-login";
import { Button } from "@/components/ui/button";

export function NavActions() {
  const { user, loading } = useAuth();
  if (loading) return <span className="h-9 w-24" />;
  return user ? (
    <Link href="/today" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-elevated px-3.5 text-sm font-medium hover:bg-elevated/80">
      Open app <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  ) : (
    <div className="flex items-center gap-1">
      <Link href="/login" className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted hover:text-fg">
        Sign in
      </Link>
      <Link href="/signup" className="inline-flex h-9 items-center rounded-lg bg-elevated px-3.5 text-sm font-medium hover:bg-elevated/80">
        Get started
      </Link>
    </div>
  );
}

export function HeroActions() {
  const { user, auth } = useAuth();
  const demo = useDemoLogin();
  return (
    <div className="mt-9 flex flex-wrap items-center gap-3">
      <Link href={user ? "/today" : "/signup"} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg shadow-soft transition hover:brightness-105" data-testid="hero-cta">
        {user ? "Open your day" : "Get started — it's free"} <ArrowRight className="h-4 w-4" />
      </Link>
      {!user && auth.mode === "demo" && (
        <Button size="lg" variant="secondary" onClick={demo.start} loading={demo.loading}>
          <FlaskConical className="h-4 w-4" /> Try the demo
        </Button>
      )}
    </div>
  );
}
