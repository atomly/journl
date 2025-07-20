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
		</div>
	);
}
