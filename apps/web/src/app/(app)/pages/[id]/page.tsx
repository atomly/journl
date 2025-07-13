import { prefetch, trpc } from "~/trpc/server";
import { PageEditor } from "../_components/page-editor";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	// Prefetch both the page data and its blocks
	prefetch(trpc.pages.byId.queryOptions({ id }));
	prefetch(
		trpc.blocks.loadPageChunk.queryOptions({
			cursor: undefined, // Start from the beginning
			limit: 50, // Load first 50 blocks
			parentId: id,
			parentType: "page",
		}),
	);

	return <PageEditor id={id} />;
}
