import type { Metadata } from "next";

import { Pagination } from "@/components/library/pagination";
import { VideoGrid } from "@/components/library/video-card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartIcon } from "@/components/ui/icons";
import { listFavorites } from "@/lib/data/queries";
import { libraryQuerySchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage(props: PageProps<"/favorites">) {
  const raw = await props.searchParams;
  const { page } = libraryQuerySchema.parse({ page: typeof raw.page === "string" ? raw.page : undefined });
  const { items, pageCount } = await listFavorites(page);
  return (
    <>
      <PageHeader title="Favorites" description="The generations you've saved." />
      {items.length > 0 ? (
        <>
          <VideoGrid items={items} />
          <Pagination page={page} pageCount={pageCount} basePath="/favorites" params={{}} />
        </>
      ) : (
        <EmptyState
          icon={<HeartIcon size={22} />}
          title="No favorites yet"
          description="Tap Favorite on any generation to keep it here."
          action={<LinkButton href="/library" variant="secondary">Browse library</LinkButton>}
        />
      )}
    </>
  );
}
