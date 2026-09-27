import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/library/pagination";
import { VideoGrid } from "@/components/library/video-card";
import { ProjectSettings } from "@/components/projects/project-forms";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryIcon, PlusIcon } from "@/components/ui/icons";
import { getProject, listLibrary } from "@/lib/data/queries";
import { libraryQuerySchema, uuidSchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const raw = await props.searchParams;
  const query = libraryQuerySchema.parse({ page: typeof raw.page === "string" ? raw.page : undefined });
  const project = await getProject(id);
  if (!project) notFound();
  const { items, pageCount } = await listLibrary({ ...query, projectId: id });

  return (
    <>
      <nav className="mb-5 text-sm text-fog-500" aria-label="Breadcrumb">
        <Link href="/projects" className="hover:text-fog-200">Projects</Link>
        <span className="mx-2 text-fog-600">/</span>
        <span className="text-fog-200">{project.name}</span>
      </nav>
      <PageHeader
        title={project.name}
        description={project.description ?? `${project.generationCount} ${project.generationCount === 1 ? "video" : "videos"}`}
        action={<LinkButton href={`/create?project=${project.id}`} icon={<PlusIcon size={16} />}>New video in project</LinkButton>}
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {items.length > 0 ? (
            <>
              <VideoGrid items={items} />
              <Pagination page={query.page} pageCount={pageCount} basePath={`/projects/${project.id}`} params={{}} />
            </>
          ) : (
            <EmptyState
              icon={<LibraryIcon size={22} />}
              title="No videos in this project"
              description="Create a new video here, or move existing videos in from their detail page."
            />
          )}
        </div>
        <aside>
          <ProjectSettings id={project.id} name={project.name} description={project.description} coverUrl={project.coverSignedUrl} />
        </aside>
      </div>
    </>
  );
}
