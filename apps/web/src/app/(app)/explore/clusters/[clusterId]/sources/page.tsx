import { notFound } from "next/navigation";
import { z } from "zod/v4";
import { withAuth } from "~/app/_guards/page-guards";
import { SourceContexts } from "../../../_components/source-contexts";
export default withAuth(async function SourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ clusterId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const parsed = z.uuid().safeParse((await params).clusterId);
  const key = (await searchParams).key;
  if (!parsed.success || !key || key.length > 2100) notFound();
  return <SourceContexts clusterId={parsed.data} targetKey={key} />;
});
