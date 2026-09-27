import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { AppError } from "@/lib/errors";
import { isSupabaseAuthConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Resolves the authenticated user from the server-side session.
 * Uses getUser(), which validates the session with Supabase Auth — never trust
 * user ids supplied by the client.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Session-dependent: opt the calling route out of static prerendering.
  await cookies();
  if (!isSupabaseAuthConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

/** For route handlers: throws 401 when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("unauthorized", "You need to sign in to do that.");
  return user;
}

/** For pages: redirects to sign-in when unauthenticated. */
export async function requireUserOrRedirect(nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}
