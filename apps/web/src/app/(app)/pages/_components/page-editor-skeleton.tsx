import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/components/utils";

type PageEditorSkeletonProps = Omit<React.ComponentProps<"div">, "children">;

export function PageEditorSkeleton({
  className,
  ...rest
}: PageEditorSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} {...rest}>
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
  );
}
