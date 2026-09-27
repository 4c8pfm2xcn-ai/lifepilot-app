"use client";

import { cn } from "@/components/ui/cn";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/** Accessible single-select group rendered as a radio group. */
export function Segmented<T extends string | number>({
  name,
  label,
  options,
  value,
  onChange,
  columns,
}: {
  name: string;
  label: string;
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fog-500">{label}</legend>
      <div className={cn("grid gap-2", columns ?? "grid-cols-3")}>
        {options.map((option) => {
          const checked = option.value === value;
          const id = `${name}-${option.value}`;
          return (
            <label
              key={String(option.value)}
              htmlFor={id}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-sm transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-aurora-violet",
                checked
                  ? "border-aurora-violet/60 bg-aurora-violet/[0.09] text-fog-50"
                  : "border-white/[0.08] bg-white/[0.02] text-fog-400 hover:border-white/15 hover:text-fog-200",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              <span className="font-medium">{option.label}</span>
              {option.hint ? <span className="mt-0.5 text-[11px] text-fog-500">{option.hint}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
