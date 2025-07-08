import { prefetch, trpc } from "~/trpc/server";
import { JournalVirtualList } from "./_components/journal-virtual-list";

export default async function JournalPage() {
	const initialRange: React.ComponentProps<
		typeof JournalVirtualList
	>["initialRange"] = {
		limit: 7,
	};

	prefetch(
		trpc.journal.getBetween.queryOptions({
			limit: 7,
		}),
	);

	return (
		<div className="overflow-hidden">
			<JournalVirtualList initialRange={initialRange} />
		</div>
	);
}
