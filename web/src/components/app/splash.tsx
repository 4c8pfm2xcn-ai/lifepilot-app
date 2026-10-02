import { LogoMark } from "./logo";

export function Splash({ message }: { message?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-10 w-10 animate-pulse" />
        <span className="text-xs text-subtle">{message ?? "Loading your day…"}</span>
      </div>
    </div>
  );
}
