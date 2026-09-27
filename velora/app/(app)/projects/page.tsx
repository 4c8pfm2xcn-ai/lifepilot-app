import type { Metadata } from "next";
import Link from "next/link";

import { NewProjectForm } from "@/components/projects/project-forms";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/components/ui/format";
import { FolderIcon } from "@/components/ui/icons";
import { listProjects } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await listProjects();
  return (
    <>
      <PageHeader title="Projects" description="Organize related generations together." action={<NewProjectForm />} />
      {projects.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p, i) => (
            <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
              <Link href={`/projects/${p.id}`} className="group block overflow-hidden rounded-2xl border hairline bg-ink-900 transition-all hover:-translate-y-0.5 hover:border-white/15">
                <div className="relative aspect-[16/8] bg-gradient-to-br from-ink-800 via-ink-850 to-ink-900">
                  {p.coverSignedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={p.coverSignedUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <FolderIcon size={28} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-fog-600" />
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium text-fog-50">{p.name}</p>
                  {p.description ? <p className="mt-1 line-clamp-2 text-sm text-fog-500">{p.description}</p> : null}
                  <p className="mt-3 text-xs text-fog-500">
                    {p.generationCount} {p.generationCount === 1 ? "video" : "videos"} · Updated {formatDate(p.updated_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<FolderIcon size={22} />} title="No projects yet" description="Create a project to group generations for a campaign, story or client." />
      )}
    </>
  );
}
