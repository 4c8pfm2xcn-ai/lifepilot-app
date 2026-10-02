/** Public runtime configuration. Safe to import from client components. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export const APP_ROUTES = ["/today", "/inbox", "/tasks", "/calendar", "/goals", "/assistant", "/insights", "/settings", "/onboarding"];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
