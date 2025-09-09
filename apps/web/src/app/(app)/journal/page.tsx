import { withAuth } from "~/auth/guards";
import { prefetch, trpc } from "~/trpc/server";
import { JournalList } from "./_components/journal-list";

const initialRange: React.ComponentProps<typeof JournalList>["initialRange"] = {
  limit: 7, // 7 days
};

export default withAuth(async function JournalPage() {
  prefetch(trpc.journal.getTimeline.queryOptions(initialRange));
  return <JournalList initialRange={initialRange} className="h-full w-full" />;
});
