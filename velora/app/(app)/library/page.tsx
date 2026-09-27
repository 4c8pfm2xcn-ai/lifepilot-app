import type { Metadata } from "next";
import { Suspense } from "react";

import { LibraryFilters } from "@/components/library/library-filters";
import { Pagination } from "@/components/library/pagination";
import { VideoGrid } from "@/components/library/video-card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryIcon, PlusIcon } from "@/components/ui/icons";
import { listLibrary } from "@/lib/data/queries";
import { libraryQuerySchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage(props: PageProps<"/library">) {
  const raw = await props.searchParams;
  const query = libraryQuerySchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    sort: typeof raw.sort === "string" ? raw.sort : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const { items, total, pageCount } = await listLibrary(query);
  const filtered = Boolean(query.q) || query.status !== "all";

  return (
    <>
      <PageHeader
        title="Library"
        description={`${total.toLocaleString()} ${total === 1 ? "generation" : "generations"}`}
        action={<LinkButton href="/create" icon={<PlusIcon size={16} />}>New video</LinkButton>}
      />
      <Suspense>
        <LibraryFilters />
      </Suspense>
      {items.length > 0 ? (
        <>
          <VideoGrid items={items} />
          <Pagination
            page={query.page}
            pageCount={pageCount}
            basePath="/library"
            params={{ q: query.q, status: query.status === "all" ? undefined : query.status, sort: query.sort === "newest" ? undefined : query.sort }}
          />
        </>
      ) : (
        <EmptyState
          icon={<LibraryIcon size={22} />}
          title={filtered ? "No matching generations" : "Your library is empty"}
          description={filtered ? "Try a different search or filter." : "Videos you generate will appear here."}
          action={filtered ? undefined : <LinkButton href="/create">Create your first video</LinkButton>}
        />
      )}
    </>
  );
}
