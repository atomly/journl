import { withAuth } from "~/auth/utils";
import { prefetch, trpc } from "~/trpc/server";
import { JournalVirtualList } from "./_components/journal-virtual-list";

export default withAuth(async function JournalPage() {
	const initialRange: React.ComponentProps<
		typeof JournalVirtualList
	>["initialRange"] = {
		limit: 7,
	};

	prefetch(
		trpc.journal.getTimeline.queryOptions({
			limit: 7,
		}),
	);

	return (
		<div className="h-full w-full">
			<JournalVirtualList initialRange={initialRange} />
		</div>
	);
});
