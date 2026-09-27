import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center rounded-2xl px-6 py-14 text-center animate-fade-up">
      {icon ? <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-fog-400">{icon}</div> : null}
      <h3 className="text-base font-medium text-fog-50">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-fog-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
