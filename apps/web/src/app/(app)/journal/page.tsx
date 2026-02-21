import { withAuth } from "~/app/_guards/page-guards";
import { getAppPreferences } from "~/preferences/get-preferences";
import {
  getInfiniteEntriesQueryOptions,
  getInfiniteJournalEntriesQueryOptions,
} from "~/trpc/options/journal-entries-query-options";
import { prefetch, trpc } from "~/trpc/server";
import { JournalList } from "./_components/journal-list";

export default withAuth(async function JournalPage() {
  const preferences = await getAppPreferences();
  const isEntriesOnly = preferences.journalTimelineView === "entries";
  if (isEntriesOnly) {
    prefetch(
      trpc.journal.getEntries.queryOptions(getInfiniteEntriesQueryOptions()),
    );
  } else {
    prefetch(
      trpc.journal.getTimeline.queryOptions(
        getInfiniteJournalEntriesQueryOptions(),
      ),
    );
  }
  return <JournalList className="h-full w-full" />;
});
