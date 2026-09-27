import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses("secondary", "sm")} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={buttonClasses("secondary", "sm", "pointer-events-none opacity-40")} aria-disabled="true">
          Previous
        </span>
      )}
      <span className="text-sm tabular-nums text-fog-500">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={buttonClasses("secondary", "sm")} rel="next">
          Next
        </Link>
      ) : (
        <span className={buttonClasses("secondary", "sm", "pointer-events-none opacity-40")} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
