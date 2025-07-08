import { JournalEntrySkeleton } from "./journal-entry-skeleton";

type JournalFeedSkeletonProps = Omit<React.ComponentProps<"div">, "children">;

export function JournalFeedSkeleton({ ...rest }: JournalFeedSkeletonProps) {
	return (
		<div {...rest}>
			<div className="mx-auto w-full max-w-4xl flex-1">
				<div className="space-y-12">
					{/* Today entry */}
					<JournalEntrySkeleton hasContent={false} />

					{/* Yesterday with content */}
					<JournalEntrySkeleton hasContent={true} />

					{/* Multiple past entries */}
					<JournalEntrySkeleton hasContent={false} />
					<JournalEntrySkeleton hasContent={false} />
					<JournalEntrySkeleton hasContent={true} />
					<JournalEntrySkeleton hasContent={false} />
					<JournalEntrySkeleton hasContent={false} />
					<JournalEntrySkeleton hasContent={false} />
				</div>
			</div>

			{/* Floating button */}
			<div className="fixed bottom-6 left-6">
				<div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
			</div>
		</div>
	);
}
