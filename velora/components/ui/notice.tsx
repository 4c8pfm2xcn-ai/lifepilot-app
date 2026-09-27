import type { ReactNode } from "react";

import { AlertIcon, CheckIcon } from "./icons";
import { cn } from "./cn";

type Tone = "info" | "warning" | "danger" | "success";

const TONES: Record<Tone, string> = {
  info: "border-aurora-blue/20 bg-aurora-blue/[0.06] text-fog-200",
  warning: "border-warning/25 bg-warning/[0.07] text-fog-200",
  danger: "border-danger/25 bg-danger/[0.07] text-fog-200",
  success: "border-success/25 bg-success/[0.07] text-fog-200",
};

export function Notice({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", TONES[tone], className)}>
      <span className={cn("mt-0.5 shrink-0", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-aurora-blue")}>
        {tone === "success" ? <CheckIcon size={16} /> : <AlertIcon size={16} />}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-medium text-fog-50">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1", "text-fog-400 [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-fog-200")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function MissingEnvNotice({ names, what }: { names: string[]; what: string }) {
  return (
    <Notice tone="warning" title={`${what} is not configured`}>
      Set {names.map((n, i) => (
        <span key={n}>
          {i > 0 ? (i === names.length - 1 ? " and " : ", ") : null}
          <code>{n}</code>
        </span>
      ))}{" "}
      in your server environment (see <code>.env.example</code>), then restart the server.
    </Notice>
  );
}
