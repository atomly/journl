import type { InfiniteEntriesInput, InfiniteJournalEntriesInput } from "~/trpc";

const JOURNAL_TIMELINE_PAGE_SIZE = 7;
const JOURNAL_ENTRIES_PAGE_SIZE = 10;

export function getInfiniteJournalEntriesQueryOptions(): InfiniteJournalEntriesInput {
  return {
    limit: JOURNAL_TIMELINE_PAGE_SIZE,
  };
}

export function getInfiniteEntriesQueryOptions(): InfiniteEntriesInput {
  return {
    limit: JOURNAL_ENTRIES_PAGE_SIZE,
  };
}
