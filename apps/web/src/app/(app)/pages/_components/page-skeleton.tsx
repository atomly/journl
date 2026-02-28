import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/cn";

type PageSkeletonProps = Omit<React.ComponentProps<"div">, "children">;

export function PageSkeleton({ className, ...rest }: PageSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-y-6", className)} {...rest}>
      {/* Formatting toolbar */}
      <div className="mx-8 block md:hidden">
        {<Skeleton className="mt-2 h-11.5 w-full" />}
      </div>

      {/* Title skeleton */}
      <Skeleton className="mx-8 h-9 w-60" />

      {/* Content */}
      <div className="space-y-2 px-13.5" {...rest}>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-4/5" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-5/6" />
        </div>
      </div>
    </div>
  );
}
