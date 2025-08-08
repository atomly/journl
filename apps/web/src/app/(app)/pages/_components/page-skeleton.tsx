import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/components/utils";

type PageSkeletonProps = Omit<React.ComponentProps<"div">, "children">;

export function PageSkeleton({ className, ...rest }: PageSkeletonProps) {
	return (
		<div className={cn("flex flex-col gap-4 p-4", className)} {...rest}>
			{/* Title skeleton */}
			<Skeleton className="h-10 w-3/5" />

			{/* Content skeleton */}
			<div className="space-y-3">
				<div className="flex flex-col gap-4 p-6">
					{/* Title skeleton */}
					<Skeleton className="h-8 w-2/3" />

					{/* Content blocks skeleton */}
					<div className="space-y-4">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
						<Skeleton className="h-4 w-4/5" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</div>
						<Skeleton className="h-32 w-full" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-4 w-5/6" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
