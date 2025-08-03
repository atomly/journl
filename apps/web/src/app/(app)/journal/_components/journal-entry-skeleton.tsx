import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/components/utils/cn";

type JournalEntrySkeletonProps = Omit<
	React.ComponentProps<"div">,
	"children"
> & {
	hasHeader?: boolean;
	hasContent?: boolean;
};

export function JournalEntrySkeleton({
	className,
	hasHeader = true,
	hasContent = false,
	...rest
}: JournalEntrySkeletonProps) {
	return (
		<div className={cn("space-y-3", className)} {...rest}>
			{/* Date header */}
			{hasHeader && <Skeleton className="h-7 w-40" />}

			{/* Content */}
			<div className="space-y-2">
				{hasContent ? (
					<div className="flex items-start gap-2">
						<Skeleton className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-4/5" />
							<Skeleton className="h-4 w-3/5" />
						</div>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<Skeleton className="h-2 w-2 flex-shrink-0 rounded-full" />
						<Skeleton className="h-4 w-32" />
					</div>
				)}
			</div>
		</div>
	);
}
