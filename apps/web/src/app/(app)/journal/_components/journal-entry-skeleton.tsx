import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/cn";

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
    <div className={cn("space-y-6", className)} {...rest}>
      {/* Date header */}
      {hasHeader && <Skeleton className="h-12 w-40" />}

      {/* Content */}
      <div className="space-y-2">
        {hasContent ? (
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-3/5" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-32" />
          </div>
        )}
      </div>
    </div>
  );
}
