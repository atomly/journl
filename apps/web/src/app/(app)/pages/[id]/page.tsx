import { redirect } from "next/navigation";
import { api, prefetch, trpc } from "~/trpc/server";
import { PageEditor } from "../_components/page-editor";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	// Prefetch the page data first
	prefetch(trpc.pages.byId.queryOptions({ id }));

	// Get page data to access children for block prefetching
	const pageData = await api.pages.byId({ id });

	if (!pageData) {
		redirect("/");
	}

	// Prefetch blocks using the page's children
	if (pageData?.children && pageData.children.length > 0) {
		prefetch(
			trpc.blocks.loadPageChunk.queryOptions({
				limit: 10, // Load first 10 blocks
				parentChildren: pageData.children,
			}),
		);
	}

	return <PageEditor id={id} />;
}
