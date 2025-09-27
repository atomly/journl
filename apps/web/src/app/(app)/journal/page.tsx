import { infiniteJournalEntriesQueryOptions } from "~/app/api/trpc/options/journal-entries-query-options";
import { withAuth } from "~/auth/guards";
import { prefetch, trpc } from "~/trpc/server";
import { JournalList } from "./_components/journal-list";

export default withAuth(async function JournalPage() {
  prefetch(
    trpc.journal.getTimeline.queryOptions(infiniteJournalEntriesQueryOptions),
  );
  return <JournalList className="h-full w-full" />;
});
