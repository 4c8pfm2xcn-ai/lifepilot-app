import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-2xl", className)} {...props} />;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fog-50">{title}</h2>
        {description ? <p className="mt-1 text-sm text-fog-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-tight text-fog-50 sm:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-fog-400 sm:text-base">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
