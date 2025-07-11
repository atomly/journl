import { prefetch, trpc } from "~/trpc/server";
import { PageEditor } from "../_components/page-editor";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	prefetch(trpc.pages.byId.queryOptions({ id }));

	return <PageEditor id={id} />;
}
