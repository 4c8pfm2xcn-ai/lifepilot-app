import Link from "next/link";

import { formatDate, truncate } from "@/components/ui/format";
import { HeartIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import type { GenerationView } from "@/lib/data/queries";

import { HoverVideo } from "./hover-video";

export function VideoCard({ generation, index = 0 }: { generation: GenerationView; index?: number }) {
  const g = generation;
  const active = g.status === "queued" || g.status === "processing";
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <Link
        href={`/generations/${g.id}`}
        className="group block overflow-hidden rounded-2xl border hairline bg-ink-900 transition-all hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_20px_50px_-30px_rgba(167,139,250,0.5)]"
      >
        <div className="relative aspect-video overflow-hidden bg-ink-850">
          {g.status === "completed" && g.videoUrl ? (
            <HoverVideo src={g.videoUrl} poster={g.posterUrl} />
          ) : g.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={g.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-50" />
          ) : (
            <div className={active ? "skeleton h-full w-full" : "h-full w-full bg-gradient-to-br from-ink-800 to-ink-900"} />
          )}
          <div className="absolute left-2.5 top-2.5">
            <StatusBadge status={g.status} className="backdrop-blur-md" />
          </div>
          {g.isFavorite ? (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-ink-950/70 p-1.5 text-aurora-rose backdrop-blur" aria-label="Favorite">
              <HeartIcon size={13} filled />
            </span>
          ) : null}
          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-ink-950/75 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fog-200 backdrop-blur">
            {g.duration}s · {g.aspect_ratio}
          </span>
        </div>
        <div className="p-3.5">
          <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug text-fog-200 group-hover:text-fog-50">{truncate(g.prompt, 140)}</p>
          <p className="mt-2 text-xs text-fog-500">{formatDate(g.created_at)}</p>
        </div>
      </Link>
    </li>
  );
}

export function VideoGrid({ items }: { items: GenerationView[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((g, i) => (
        <VideoCard key={g.id} generation={g} index={i} />
      ))}
    </ul>
  );
}
