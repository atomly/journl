import { withAuth } from "~/auth/guards";
import { prefetch, trpc } from "~/trpc/server";
import { JournalVirtualList } from "./_components/journal-virtual-list";

const initialRange: React.ComponentProps<
	typeof JournalVirtualList
>["initialRange"] = {
	limit: 7, // 7 days
};

export default withAuth(async function JournalPage() {
	prefetch(trpc.journal.getTimeline.queryOptions(initialRange));
	return (
		<JournalVirtualList initialRange={initialRange} className="h-full w-full" />
	);
});
