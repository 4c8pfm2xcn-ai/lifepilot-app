import { BarChart3, CalendarDays, CheckSquare, Inbox, MessageSquare, Settings, Sun, Target } from "lucide-react";

export const NAV = [
  { href: "/today", label: "Today", icon: Sun, key: "t" },
  { href: "/inbox", label: "Inbox", icon: Inbox, key: "i" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, key: "k" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, key: "c" },
  { href: "/goals", label: "Goals", icon: Target, key: "g" },
  { href: "/assistant", label: "Assistant", icon: MessageSquare, key: "a" },
  { href: "/insights", label: "Insights", icon: BarChart3, key: "n" },
  { href: "/settings", label: "Settings", icon: Settings, key: "s" },
] as const;
