"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { demoAuth } from "@/lib/auth/auth-client";
import { LocalStore } from "@/lib/data/local-store";
import { loadSampleData } from "@/lib/sample-data";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { localTimeZone } from "@/lib/time";

/** One-click demo: signs into a local sample account and seeds labelled sample data. */
export function useDemoLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const start = async () => {
    setLoading(true);
    try {
      const user = await demoAuth.createSampleAccount();
      const store = new LocalStore(user.id);
      const existing = await store.getProfile();
      if (!existing) {
        const now = new Date().toISOString();
        await store.upsertProfile({ id: user.id, full_name: "Alex", email: user.email, timezone: localTimeZone(), preferences: DEFAULT_PREFERENCES, onboarded: true, is_sample: true, created_at: now, updated_at: now });
        await loadSampleData(store);
      }
      router.push("/today");
    } finally {
      setLoading(false);
    }
  };
  return { start, loading };
}
