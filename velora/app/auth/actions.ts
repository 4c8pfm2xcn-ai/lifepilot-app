"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isSupabaseAuthConfigured, serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

const emailSchema = z.email("Enter a valid email address").max(254);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters");

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

async function siteOrigin(): Promise<string> {
  const configured = serverEnv.siteUrl();
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const NOT_CONFIGURED: AuthFormState = {
  error: "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
};

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseAuthConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(72) }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Please confirm your email address first. Check your inbox." };
    return { error: "Incorrect email or password." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseAuthConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({
      displayName: z.string().trim().min(1, "Enter your name").max(80),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) {
    logger.warn("auth.signUp", { code: error.code, message: error.message });
    if (error.code === "weak_password") return { error: "Please choose a stronger password." };
    if (error.code === "over_email_send_rate_limit") return { error: "Too many attempts. Please wait a minute and try again." };
    return { error: "Could not create your account. Please try again." };
  }
  if (data.session) redirect("/dashboard");
  // Email confirmation enabled: don't reveal whether the email was already registered.
  return { message: "Check your email to confirm your account, then sign in." };
}

export async function requestPasswordResetAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseAuthConfigured()) return NOT_CONFIGURED;
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/auth/update-password`,
  });
  if (error) logger.warn("auth.resetPassword", { code: error.code, message: error.message });
  // Same response either way to avoid account enumeration.
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseAuthConfigured()) return NOT_CONFIGURED;
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (formData.get("password") !== formData.get("confirm")) return { error: "Passwords do not match." };
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password different from your current one." };
    return { error: "Could not update your password. Please try again." };
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
