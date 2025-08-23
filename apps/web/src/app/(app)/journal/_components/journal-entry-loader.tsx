import { JournalEntrySkeleton } from "./journal-entry-skeleton";

type JournalLoaderProps = Omit<React.ComponentProps<"div">, "children"> & {
  hasNextPage: boolean;
};

export function JournalEntryLoader({
  hasNextPage,
  ...rest
}: JournalLoaderProps) {
  if (hasNextPage) {
    return <JournalEntrySkeleton hasContent {...rest} />;
  }

  return (
    <div {...rest}>
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        There are no more entries to load
      </div>
    </div>
  );
}
