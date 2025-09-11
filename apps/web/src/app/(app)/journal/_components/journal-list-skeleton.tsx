import { JournalEntrySkeleton } from "./journal-entry-skeleton";

type JournalFeedSkeletonProps = Omit<React.ComponentProps<"div">, "children">;

export function JournalListSkeleton({ ...rest }: JournalFeedSkeletonProps) {
  return (
    <div {...rest}>
      <div className="mx-auto w-full max-w-4xl flex-1">
        <div className="space-y-20">
          {/* Today entry */}
          <JournalEntrySkeleton hasContent={false} />

          {/* Yesterday with content */}
          <JournalEntrySkeleton hasContent />

          {/* Multiple past entries */}
          <JournalEntrySkeleton hasContent={false} />
          <JournalEntrySkeleton hasContent />
          <JournalEntrySkeleton hasContent={false} />
          <JournalEntrySkeleton hasContent />
        </div>
      </div>
    </div>
  );
}
