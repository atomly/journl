import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { withAuth } from "~/app/_guards/page-guards";
import { ExploreOverview } from "./_components/explore-overview";

export default withAuth(async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const documentId = z.uuid().safeParse(params.documentId);
  const blockId = z.uuid().safeParse(params.blockId);
  if (documentId.success)
    redirect(
      `/explore/notes/${documentId.data}${blockId.success ? `?blockId=${blockId.data}` : ""}`,
    );
  return <ExploreOverview />;
});
