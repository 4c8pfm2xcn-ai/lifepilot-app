import "server-only";

import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Grants the one-time signup credits (idempotent; enforced by a unique index)
 * and returns the balance. Safe to call on every authenticated page load.
 */
export async function ensureCreditAccount(userId: string): Promise<number | null> {
  const { data, error } = await getSupabaseAdmin().rpc("grant_signup_credits", {
    p_user_id: userId,
    p_amount: serverEnv.signupCredits(),
  });
  if (error) {
    logger.error("credits.ensure", error);
    return null;
  }
  return data;
}
