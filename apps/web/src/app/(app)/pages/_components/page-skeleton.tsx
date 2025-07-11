import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/components/utils";

type PageSkeletonProps = Omit<React.ComponentProps<"div">, "children"> & {
	hasContent?: boolean;
};

export function PageSkeleton({
	className,
	hasContent = true,
	...rest
}: PageSkeletonProps) {
	return (
		<div className={cn("flex flex-col gap-4 p-4", className)} {...rest}>
			{/* Title skeleton */}
			<Skeleton className="h-10 w-3/5" />

			{/* Content skeleton */}
			<div className="space-y-3">
				{hasContent ? (
					<>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-11/12" />
						<Skeleton className="h-4 w-4/5" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-4 w-5/6" />
						<Skeleton className="h-4 w-2/3" />
					</>
				) : (
					<Skeleton className="h-4 w-1/3" />
				)}
			</div>
		</div>
	);
}
