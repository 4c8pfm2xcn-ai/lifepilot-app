"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuthClient, type AuthClient, type AuthUser } from "@/lib/auth/auth-client";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  auth: AuthClient;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(() => getAuthClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await auth.getUser());
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    refresh();
    return auth.onChange((u) => {
      setUser(u);
      setLoading(false);
    });
  }, [auth, refresh]);

  const value = useMemo(() => ({ user, loading, auth, refresh }), [user, loading, auth, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
