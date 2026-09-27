import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { Database } from "@/lib/db/types";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Service-role client. Bypasses RLS — only use after the caller's identity and
 * ownership have been verified. Never import from client code.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  const url = serverEnv.supabaseUrl();
  const serviceKey = serverEnv.supabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new AppError("not_configured", "SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }
  if (!adminClient) {
    adminClient = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
