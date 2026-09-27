import "server-only";

/**
 * Server-side environment access. Never import this from client components.
 * Missing values are reported, not thrown at import time, so the UI can render
 * a clear configuration state during development.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export const serverEnv = {
  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),
  runwayApiSecret: () => read("RUNWAYML_API_SECRET"),
  llmProvider: () => read("LLM_PROVIDER") ?? "anthropic",
  llmApiKey: () => read("LLM_API_KEY"),
  llmModel: () => read("LLM_MODEL"),
  cronSecret: () => read("CRON_SECRET"),
  siteUrl: () => read("NEXT_PUBLIC_SITE_URL"),
  signupCredits: () => {
    const raw = read("VELORA_SIGNUP_CREDITS");
    const n = raw === undefined ? 100 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 100;
  },
};

export function isSet(name: string): boolean {
  return read(name) !== undefined;
}

export interface ConfigCheck {
  name: string;
  ok: boolean;
  purpose: string;
}

export function supabaseConfigChecks(): ConfigCheck[] {
  return [
    { name: "NEXT_PUBLIC_SUPABASE_URL", ok: isSet("NEXT_PUBLIC_SUPABASE_URL"), purpose: "Supabase project URL" },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", ok: isSet("NEXT_PUBLIC_SUPABASE_ANON_KEY"), purpose: "Supabase public (anon) key" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", ok: isSet("SUPABASE_SERVICE_ROLE_KEY"), purpose: "Server-only key for credits, storage and status sync" },
  ];
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfigChecks().every((c) => c.ok);
}

export function isSupabaseAuthConfigured(): boolean {
  return isSet("NEXT_PUBLIC_SUPABASE_URL") && isSet("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
