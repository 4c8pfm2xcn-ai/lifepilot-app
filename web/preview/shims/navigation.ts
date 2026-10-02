import { useMemo } from "react";
import { navigate, useLocation } from "./router";

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, true),
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => {},
  prefetch: () => {},
};

export function useRouter() {
  return router;
}
export function usePathname() {
  return useLocation().pathname;
}
export function useSearchParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
export function redirect(href: string) {
  navigate(href, true);
}
export function notFound() {
  navigate("/404", true);
}
