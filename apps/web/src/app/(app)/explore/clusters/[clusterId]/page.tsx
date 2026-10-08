import { notFound } from "next/navigation";
import { z } from "zod/v4";
import { withAuth } from "~/app/_guards/page-guards";
import { ClusterExplorer } from "../../_components/cluster-explorer";
export default withAuth(async function ClusterPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const parsed = z.uuid().safeParse((await params).clusterId);
  if (!parsed.success) notFound();
  return <ClusterExplorer key={parsed.data} clusterId={parsed.data} />;
});
