import { notFound } from "next/navigation";
import { api, prefetch, trpc } from "~/trpc/server";
import { PageEditor } from "../_components/page-editor";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const page = await api.pages.getById({ id });

	if (!page) {
		notFound();
	}

	if (page?.children && page.children.length > 0) {
		prefetch(
			trpc.blocks.loadPageChunk.queryOptions({
				limit: 100,
				parentChildren: page.children,
			}),
		);
	}

	return <PageEditor id={id} />;
}
