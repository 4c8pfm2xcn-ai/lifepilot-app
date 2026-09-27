"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/components/ui/cn";
import { SearchIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "active", label: "In progress" },
  { value: "failed", label: "Failed" },
] as const;

export function LibraryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "newest";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || (k === "status" && v === "all") || (k === "sort" && v === "newest")) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div role="radiogroup" aria-label="Filter by status" className="flex gap-1 overflow-x-auto rounded-xl border hairline bg-white/[0.02] p-1">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={status === s.value}
            onClick={() => update({ status: s.value })}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
              status === s.value ? "bg-white/[0.08] text-fog-50" : "text-fog-500 hover:text-fog-200",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1 sm:w-64">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-500" />
          <label htmlFor="library-search" className="sr-only">
            Search prompts
          </label>
          <input
            id="library-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prompts"
            maxLength={200}
            className="field py-2 pl-9 text-sm"
          />
          {pending ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fog-500"><Spinner size={14} /></span> : null}
        </div>
        <label htmlFor="library-sort" className="sr-only">
          Sort
        </label>
        <select id="library-sort" value={sort} onChange={(e) => update({ sort: e.target.value })} className="field w-auto py-2 text-sm">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
    </div>
  );
}
