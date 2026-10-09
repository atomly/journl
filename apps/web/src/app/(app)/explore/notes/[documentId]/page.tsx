import { notFound } from "next/navigation";
import { z } from "zod/v4";
import { withAuth } from "~/app/_guards/page-guards";
import { GraphExplorer } from "../../../graph/_components/graph-explorer";
export default withAuth(async function NoteExplorePage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
  params: Promise<{ documentId: string }>;
}) {
  const parsed = z.uuid().safeParse((await params).documentId);
  if (!parsed.success) notFound();
  const parent = z.uuid().safeParse((await searchParams).thread);
  return (
    <GraphExplorer
      parentClusterId={parent.success ? parent.data : undefined}
      key={parsed.data}
      documentId={parsed.data}
    />
  );
});
