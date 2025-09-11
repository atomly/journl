import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/components/utils";
import { PageEditorSkeleton } from "./page-editor-skeleton";

type PageSkeletonProps = Omit<React.ComponentProps<"div">, "children">;

export function PageSkeleton({ className, ...rest }: PageSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...rest}>
      {/* Title skeleton */}
      <Skeleton className="mb-6 h-12 w-3/5" />

      {/* Content skeleton */}
      <div className="space-y-3">
        <div className="flex flex-col gap-4">
          {/* Title skeleton */}
          <Skeleton className="h-6 w-2/3" />

          <PageEditorSkeleton />
        </div>
      </div>
    </div>
  );
}
