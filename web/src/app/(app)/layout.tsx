"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { DataProvider } from "@/providers/data-provider";
import { UIProvider } from "@/providers/ui-provider";
import { AppShell } from "@/components/app/app-shell";
import { Splash } from "@/components/app/splash";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <Splash />;
  return (
    <DataProvider user={user}>
      <UIProvider>
        <AppShell>{children}</AppShell>
      </UIProvider>
    </DataProvider>
  );
}
