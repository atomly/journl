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
      {/* Formatting toolbar */}
      <div className="mx-8 block md:hidden">
        {<Skeleton className="mt-2 h-11.5 w-full" />}
      </div>

      {/* Date header */}
      {hasHeader && <Skeleton className="mx-8 h-9 w-40" />}

      {/* Content */}
      <div className="space-y-2 px-13.5">
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
