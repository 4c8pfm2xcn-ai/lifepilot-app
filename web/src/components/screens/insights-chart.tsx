"use client";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";

function readTokens() {
  const s = getComputedStyle(document.documentElement);
  const rgb = (n: string) => `rgb(${s.getPropertyValue(`--${n}`).trim().split(/\s+/).join(",")})`;
  return { accent: rgb("accent"), muted: rgb("muted"), subtle: rgb("subtle"), fg: rgb("fg"), elevated: rgb("elevated"), line: `rgba(${s.getPropertyValue("--line").trim().split(/\s+/).join(",")},${s.getPropertyValue("--line-alpha").trim()})` };
}

/** Theme tokens resolved to concrete colors, re-read when the theme changes. */
function useTokens() {
  const [t, setT] = useState(readTokens);
  useEffect(() => {
    const obs = new MutationObserver(() => setT(readTokens()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

interface Datum {
  label: string;
  value: number;
  extra?: string;
}

/** Single-series bar chart: one hue, rounded data-ends, recessive grid, direct value labels, hover tooltip. */
export function SimpleBarChart({ data, valueLabel, highlightLast }: { data: Datum[]; valueLabel: string; highlightLast?: boolean }) {
  const c = useTokens();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="h-[180px] w-full" role="img" aria-label={data.map((d) => `${d.label}: ${d.value} ${valueLabel}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 4, bottom: 0, left: -28 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={c.line} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.subtle, fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c.subtle, fontSize: 11 }} domain={[0, Math.max(4, Math.ceil(max * 1.15))]} />
          <Tooltip
            cursor={{ fill: c.elevated, opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as Datum;
              return (
                <div className="rounded-lg border border-line bg-elevated px-3 py-2 text-xs shadow-pop">
                  <p className="text-sm font-semibold tabular-nums text-fg">
                    {d.value} {valueLabel}
                  </p>
                  <p className="text-muted">{d.label}</p>
                  {d.extra && <p className="text-subtle">{d.extra}</p>}
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} fill={c.accent} shape={undefined}>
            <LabelList dataKey="value" position="top" offset={6} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} style={{ fill: c.muted, fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {highlightLast && <span className="sr-only">The last bar is the current week.</span>}
    </div>
  );
}
