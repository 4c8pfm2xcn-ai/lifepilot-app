import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { Database } from "@/lib/db/types";

/**
 * Per-request Supabase client bound to the user's session cookies.
 * All queries run as the authenticated user and are subject to RLS.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: this marks the route as dynamic (never prerendered with user data).
  const cookieStore = await cookies();
  const url = serverEnv.supabaseUrl();
  const anonKey = serverEnv.supabaseAnonKey();
  if (!url || !anonKey) {
    throw new AppError("not_configured", "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}
