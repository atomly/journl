"use client";

import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import type { JournalListEntry } from "~/trpc";
import { useTRPC } from "~/trpc/react";
import { JournalEntryDraft } from "./journal-entry-draft";

type JournalDraftsContextValue = {
  drafts: Map<string, JournalEntryDraft>;
  save: ConstructorParameters<typeof JournalEntryDraft>[2];
  load: (date: string) => Promise<JournalListEntry>;
  onSaved: ConstructorParameters<typeof JournalEntryDraft>[4];
};

const JournalDraftsContext = createContext<JournalDraftsContextValue | null>(
  null,
);

export function JournalDraftsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drafts] = useState(() => new Map<string, JournalEntryDraft>());
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation(
    trpc.journal.saveTransactions.mutationOptions(),
  );
  const value = useMemo(
    () => ({
      drafts,
      load: (date: string) =>
        queryClient.fetchQuery({
          ...trpc.journal.getByDate.queryOptions({ date }),
          staleTime: 0,
        }),
      onSaved: (entry: Extract<JournalListEntry, { document_id: string }>) => {
        // Keep cached remount data current without presenting unsaved edits as server data.
        for (const queryKey of [
          trpc.journal.getEntries.infiniteQueryKey(),
          trpc.journal.getTimeline.infiniteQueryKey(),
        ]) {
          void queryClient.cancelQueries({ queryKey });
          queryClient.setQueriesData<
            InfiniteData<{ timeline: JournalListEntry[] }>
          >(
            { queryKey },
            (old) =>
              old && {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  timeline: page.timeline.map((item) =>
                    item.date === entry.date ? entry : item,
                  ),
                })),
              },
          );
        }
        const queryKey = trpc.journal.getByDate.queryKey({ date: entry.date });
        void queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData(queryKey, entry);
      },
      save: mutateAsync,
    }),
    [drafts, mutateAsync, queryClient, trpc],
  );
  return (
    <JournalDraftsContext.Provider value={value}>
      {children}
    </JournalDraftsContext.Provider>
  );
}

export function useJournalEntryDraft(
  date: string,
  initial: ConstructorParameters<typeof JournalEntryDraft>[1],
) {
  const context = useContext(JournalDraftsContext);
  if (!context)
    throw new Error("Journal editors require JournalDraftsProvider");
  const { drafts, save, load, onSaved } = context;
  const [draft] = useState(() => {
    const retained = drafts.get(date);
    if (retained && !retained.canUseServerSnapshot(initial)) return retained;
    return new JournalEntryDraft(
      date,
      initial,
      save,
      () => load(date),
      onSaved,
    );
  });

  return {
    draft,
    // Only edited entries need to outlive their row; untouched entries can refetch normally.
    retainDraft: () => drafts.set(date, draft),
  };
}
