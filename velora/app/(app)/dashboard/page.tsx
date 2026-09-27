import type { Metadata } from "next";
import Link from "next/link";

import { VideoGrid } from "@/components/library/video-card";
import { LinkButton } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRightIcon, FolderIcon, HeartIcon, PlusIcon, SparkIcon } from "@/components/ui/icons";
import { MissingEnvNotice } from "@/components/ui/notice";
import { getCreditBalance, getProfile, getUsageSummary, listFavorites, listProjects, listRecentGenerations } from "@/lib/data/queries";
import { listProviderStatus } from "@/lib/video/registry";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const [profile, recent, favorites, projects, usage, balance] = await Promise.all([
    getProfile(),
    listRecentGenerations(6),
    listFavorites(1),
    listProjects(),
    getUsageSummary(),
    getCreditBalance(),
  ]);
  const providerMissing = listProviderStatus().every((p) => !p.configured);
  const firstName = profile?.display_name?.split(" ")[0];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border hairline bg-ink-900 px-6 py-10 sm:px-10 sm:py-14 animate-fade-up">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-aurora-violet/15 blur-[100px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-aurora-blue/10 blur-[100px]" />
        <p className="relative text-sm text-fog-500">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
        <h1 className="relative mt-2 max-w-xl font-display text-4xl leading-[1.05] tracking-tight text-fog-50 sm:text-6xl">
          What will you <em className="text-aurora not-italic sm:italic">create</em> today?
        </h1>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <LinkButton href="/create" size="lg" icon={<SparkIcon size={17} />}>
            New video
          </LinkButton>
          <LinkButton href="/library" size="lg" variant="secondary">
            Open library
          </LinkButton>
        </div>
      </section>

      {providerMissing ? <MissingEnvNotice what="Video generation" names={["RUNWAYML_API_SECRET"]} /> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Credits available", value: balance.toLocaleString(), href: "/settings#credits" },
          { label: "Videos completed", value: usage.completed.toLocaleString(), href: "/library?status=completed" },
          { label: "In progress", value: usage.active.toLocaleString(), href: "/library?status=active" },
          { label: "Credits used", value: usage.creditsSpent.toLocaleString(), href: "/settings#usage" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="surface rounded-2xl px-4 py-4 transition-colors hover:bg-ink-800">
            <p className="text-2xl font-semibold tabular-nums text-fog-50">{stat.value}</p>
            <p className="mt-1 text-xs text-fog-500">{stat.label}</p>
          </Link>
        ))}
      </section>

      <section>
        <SectionHeader
          title="Recent generations"
          action={
            recent.length > 0 ? (
              <Link href="/library" className="inline-flex items-center gap-1 text-sm text-fog-400 hover:text-fog-50">
                View all <ArrowRightIcon size={14} />
              </Link>
            ) : undefined
          }
        />
        {recent.length > 0 ? (
          <VideoGrid items={recent} />
        ) : (
          <EmptyState
            icon={<SparkIcon size={22} />}
            title="No videos yet"
            description="Describe a scene and generate your first video."
            action={<LinkButton href="/create" icon={<PlusIcon size={16} />}>Create a video</LinkButton>}
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader
            title="Favorites"
            action={<Link href="/favorites" className="text-sm text-fog-400 hover:text-fog-50">View all</Link>}
          />
          {favorites.items.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2">
              {favorites.items.slice(0, 6).map((g) => (
                <li key={g.id}>
                  <Link href={`/generations/${g.id}`} className="block aspect-video overflow-hidden rounded-xl border hairline bg-ink-850 hover:border-white/20" aria-label={g.prompt}>
                    {g.videoUrl ? (
                      <video src={`${g.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden="true" tabIndex={-1} />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="flex items-center gap-3 px-5 py-6 text-sm text-fog-500">
              <HeartIcon size={18} /> Favorite a generation to pin it here.
            </Card>
          )}
        </section>
        <section>
          <SectionHeader
            title="Projects"
            action={<Link href="/projects" className="text-sm text-fog-400 hover:text-fog-50">Manage</Link>}
          />
          {projects.length > 0 ? (
            <ul className="space-y-2">
              {projects.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="surface flex items-center justify-between rounded-xl px-4 py-3 hover:bg-ink-800">
                    <span className="flex items-center gap-3">
                      <FolderIcon size={17} className="text-fog-500" />
                      <span className="text-sm text-fog-50">{p.name}</span>
                    </span>
                    <span className="text-xs tabular-nums text-fog-500">{p.generationCount} videos</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="flex items-center gap-3 px-5 py-6 text-sm text-fog-500">
              <FolderIcon size={18} /> Group related videos into projects.
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
