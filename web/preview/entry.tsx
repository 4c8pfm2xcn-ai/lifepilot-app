import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { useLocation } from "./shims/router";
import { AuthProvider } from "@/providers/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import AppLayout from "@/app/(app)/layout";
import Landing from "@/app/page";
import NotFound from "@/app/not-found";
import { LoginScreen } from "@/components/screens/login";
import { SignupScreen } from "@/components/screens/signup";
import { ForgotPasswordScreen, ResetPasswordScreen } from "@/components/screens/password";
import { TodayScreen } from "@/components/screens/today";
import { InboxScreen } from "@/components/screens/inbox";
import { TasksScreen } from "@/components/screens/tasks";
import { CalendarScreen } from "@/components/screens/calendar";
import { GoalsScreen } from "@/components/screens/goals";
import { AssistantScreen } from "@/components/screens/assistant";
import { InsightsScreen } from "@/components/screens/insights";
import { SettingsScreen } from "@/components/screens/settings";
import { OnboardingScreen } from "@/components/screens/onboarding";

const PUBLIC: Record<string, () => ReactNode> = {
  "/": () => <Landing />,
  "/login": () => <LoginScreen />,
  "/signup": () => <SignupScreen />,
  "/forgot-password": () => <ForgotPasswordScreen />,
  "/reset-password": () => <ResetPasswordScreen />,
};

const APP: Record<string, () => ReactNode> = {
  "/today": () => <TodayScreen />,
  "/inbox": () => <InboxScreen />,
  "/tasks": () => <TasksScreen />,
  "/calendar": () => <CalendarScreen />,
  "/goals": () => <GoalsScreen />,
  "/assistant": () => <AssistantScreen />,
  "/insights": () => <InsightsScreen />,
  "/settings": () => <SettingsScreen />,
  "/onboarding": () => <OnboardingScreen />,
};

function Routes() {
  const { pathname } = useLocation();
  if (PUBLIC[pathname]) return <>{PUBLIC[pathname]()}</>;
  if (APP[pathname]) return <AppLayout>{APP[pathname]()}</AppLayout>;
  return <NotFound />;
}

// Some embedded viewers block localStorage; fall back to in-memory storage so the app still runs.
try {
  window.localStorage.getItem("dayzero:probe");
} catch {
  const mem = new Map<string, string>();
  const fallback: Storage = {
    get length() {
      return mem.size;
    },
    key: (i) => Array.from(mem.keys())[i] ?? null,
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => void mem.set(k, String(v)),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
  };
  try {
    Object.defineProperty(window, "localStorage", { value: fallback, configurable: true });
  } catch {}
}

try {
  const t = localStorage.getItem("dayzero:theme") || "dark";
  document.documentElement.dataset.theme = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
} catch {
  document.documentElement.dataset.theme = "dark";
}

const rootEl = document.getElementById("dayzero-root")!;
rootEl.innerHTML = "";
createRoot(rootEl).render(
  <AuthProvider>
    <ToastProvider>
      <Routes />
    </ToastProvider>
  </AuthProvider>,
);
