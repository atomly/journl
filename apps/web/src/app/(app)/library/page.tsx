import { withAuth } from "~/app/_guards/page-guards";
import { getLibraryPagesQueryOptions } from "~/trpc/options/library-pages-query-options";
import { prefetch, trpc } from "~/trpc/server";
import { LibraryView } from "./_components/library-view";

export default withAuth(async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab =
    params.tab === "folders" ? ("folders" as const) : ("all-pages" as const);
  prefetch(trpc.pages.getAll.queryOptions(getLibraryPagesQueryOptions()));
  return <LibraryView tab={tab} />;
});
