import {
  getInfiniteEntriesQueryOptions,
  getInfiniteJournalEntriesQueryOptions,
} from "~/app/api/trpc/options/journal-entries-query-options";
import { withAuth } from "~/auth/guards";
import { getAppPreferences } from "~/preferences/get-preferences";
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
