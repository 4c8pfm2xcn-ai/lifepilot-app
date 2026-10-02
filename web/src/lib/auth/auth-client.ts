"use client";
import { isSupabaseConfigured, SITE_URL } from "../config";
import { getBrowserSupabase } from "../supabase/client";
import { uid } from "../id";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface SignUpResult {
  user: AuthUser | null;
  /** Supabase projects with email confirmation enabled return no session yet. */
  needsConfirmation: boolean;
}

export interface AuthClient {
  mode: "supabase" | "demo";
  getUser(): Promise<AuthUser | null>;
  signUp(input: { name: string; email: string; password: string }): Promise<SignUpResult>;
  signIn(input: { email: string; password: string }): Promise<AuthUser>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  deleteAccount(): Promise<void>;
  onChange(cb: (user: AuthUser | null) => void): () => void;
}

export class AuthError extends Error {}

/* ── Supabase ─────────────────────────────────────────────────────────── */

function origin() {
  return SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
}

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Try signing in.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

const supabaseAuth: AuthClient = {
  mode: "supabase",
  async getUser() {
    const { data } = await getBrowserSupabase().auth.getUser();
    const u = data.user;
    return u ? { id: u.id, email: u.email ?? "", name: (u.user_metadata?.full_name as string) ?? "" } : null;
  },
  async signUp({ name, email, password }) {
    const { data, error } = await getBrowserSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${origin()}/auth/callback?next=/onboarding` },
    });
    if (error) throw new AuthError(friendly(error.message));
    const u = data.user;
    return {
      user: u ? { id: u.id, email: u.email ?? email, name } : null,
      needsConfirmation: !data.session,
    };
  },
  async signIn({ email, password }) {
    const { data, error } = await getBrowserSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new AuthError(friendly(error.message));
    const u = data.user;
    return { id: u.id, email: u.email ?? email, name: (u.user_metadata?.full_name as string) ?? "" };
  },
  async signOut() {
    await getBrowserSupabase().auth.signOut();
  },
  async requestPasswordReset(email) {
    const { error } = await getBrowserSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin()}/auth/callback?next=/reset-password`,
    });
    if (error) throw new AuthError(friendly(error.message));
  },
  async updatePassword(password) {
    const { error } = await getBrowserSupabase().auth.updateUser({ password });
    if (error) throw new AuthError(friendly(error.message));
  },
  async deleteAccount() {
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthError(body.error ?? "Account deletion failed.");
    }
    await getBrowserSupabase().auth.signOut();
  },
  onChange(cb) {
    const { data } = getBrowserSupabase().auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      cb(u ? { id: u.id, email: u.email ?? "", name: (u.user_metadata?.full_name as string) ?? "" } : null);
    });
    return () => data.subscription.unsubscribe();
  },
};

/* ── Demo (browser-only accounts) ─────────────────────────────────────── */

interface DemoAccount {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  created_at: string;
}

const ACCOUNTS_KEY = "dayzero:accounts";
const SESSION_KEY = "dayzero:session";
const listeners = new Set<(u: AuthUser | null) => void>();

function accounts(): DemoAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveAccounts(a: DemoAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

async function hashPassword(password: string, salt: string) {
  const enc = new TextEncoder();
  if (!crypto?.subtle) throw new AuthError("Secure context required (use https or localhost).");
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 120_000 }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

function emit(u: AuthUser | null) {
  listeners.forEach((l) => l(u));
}

function toUser(a: DemoAccount): AuthUser {
  return { id: a.id, email: a.email, name: a.name };
}

export const demoAuth: AuthClient & { createSampleAccount(): Promise<AuthUser> } = {
  mode: "demo",
  async getUser() {
    const id = localStorage.getItem(SESSION_KEY);
    const a = id ? accounts().find((x) => x.id === id) : null;
    return a ? toUser(a) : null;
  },
  async signUp({ name, email, password }) {
    const all = accounts();
    const normalized = email.trim().toLowerCase();
    if (all.some((a) => a.email === normalized)) throw new AuthError("An account with this email already exists on this device. Try signing in.");
    const salt = uid();
    const account: DemoAccount = { id: uid(), email: normalized, name: name.trim(), salt, hash: await hashPassword(password, salt), created_at: new Date().toISOString() };
    saveAccounts([...all, account]);
    localStorage.setItem(SESSION_KEY, account.id);
    emit(toUser(account));
    return { user: toUser(account), needsConfirmation: false };
  },
  async signIn({ email, password }) {
    const a = accounts().find((x) => x.email === email.trim().toLowerCase());
    if (!a || (await hashPassword(password, a.salt)) !== a.hash) throw new AuthError("That email and password don't match an account on this device.");
    localStorage.setItem(SESSION_KEY, a.id);
    emit(toUser(a));
    return toUser(a);
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    emit(null);
  },
  async requestPasswordReset() {
    throw new AuthError("Password recovery sends an email, which needs Supabase configured. Demo accounts live only in this browser.");
  },
  async updatePassword(password) {
    const id = localStorage.getItem(SESSION_KEY);
    const all = accounts();
    const a = all.find((x) => x.id === id);
    if (!a) throw new AuthError("You're not signed in.");
    a.salt = uid();
    a.hash = await hashPassword(password, a.salt);
    saveAccounts(all);
  },
  async deleteAccount() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return;
    saveAccounts(accounts().filter((a) => a.id !== id));
    const prefix = `dayzero:v1:${id}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
    localStorage.removeItem(SESSION_KEY);
    emit(null);
  },
  async createSampleAccount() {
    const all = accounts();
    let a = all.find((x) => x.email === "demo@dayzero.local");
    if (!a) {
      const salt = uid();
      a = { id: uid(), email: "demo@dayzero.local", name: "Alex", salt, hash: await hashPassword(uid(), salt), created_at: new Date().toISOString() };
      saveAccounts([...all, a]);
    }
    localStorage.setItem(SESSION_KEY, a.id);
    emit(toUser(a));
    return toUser(a);
  },
  onChange(cb) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) demoAuth.getUser().then(cb);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function getAuthClient(): AuthClient {
  return isSupabaseConfigured ? supabaseAuth : demoAuth;
}
