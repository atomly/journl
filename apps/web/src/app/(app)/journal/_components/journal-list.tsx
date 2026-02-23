"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { useDebouncedCallback } from "use-debounce";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { useAppLayout } from "~/app/_components/app-layout-provider";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import type { JournalListEntry } from "~/trpc";
import {
  getInfiniteEntriesQueryOptions,
  getInfiniteJournalEntriesQueryOptions,
} from "~/trpc/options/journal-entries-query-options";
import { useTRPC } from "~/trpc/react";
import {
  JournalEntryContent,
  JournalEntryHeader,
  JournalEntryLink,
  JournalEntryProvider,
  JournalEntryWrapper,
} from "./journal-entry-editor";
import { DynamicJournalEntryEditor } from "./journal-entry-editor.dynamic";
import { JournalEntryLoader } from "./journal-entry-loader";
import { JournalListSkeleton } from "./journal-list-skeleton";

type JournalVirtualListProps = Omit<
  React.ComponentProps<typeof Virtuoso>,
  "data" | "endReached" | "increaseViewportBy" | "itemContent" | "components"
>;

type JournalListError = { message?: string } | null;

type JournalListContentProps = JournalVirtualListProps & {
  status: "pending" | "error" | "success";
  data:
    | {
        pages: Array<{ timeline: JournalListEntry[] }>;
      }
    | undefined;
  error: JournalListError;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  onCreateAction: (newEntry: JournalListEntry) => void;
};

function JournalListContent({
  status,
  data,
  error,
  fetchNextPage,
  hasNextPage,
  onCreateAction,
  ...rest
}: JournalListContentProps) {
  const debouncedFetchNextPage = useDebouncedCallback(fetchNextPage, 300);
  const { rememberView: setView } = useJournlAgent();
  const { scrollElement } = useAppLayout();
  const hasMore = hasNextPage;

  const entries = useMemo(
    () =>
      data?.pages.reduce(
        (acc, page, index) => {
          for (const entry of page.timeline) {
            if (new Date(`${entry.date}T00:00:00`) > new Date()) {
              continue;
            }
            acc.push({ ...entry, pageIndex: index });
          }
          return acc;
        },
        [] as (JournalListEntry & { pageIndex: number })[],
      ) ?? [],
    [data],
  );

  useEffect(() => {
    setView({
      name: "journal",
    });
    return () => {
      setView({
        name: "other",
      });
    };
  }, [setView]);

  if (status === "pending") {
    return (
      <div className="mx-auto max-w-4xl pt-8">
        <JournalListSkeleton className="mx-auto flex flex-1 flex-col" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex h-full max-w-4xl flex-1 flex-col items-center justify-center gap-y-8 text-center">
        <div>
          <div>Sorry, something went wrong.</div>
          <div>Please try again.</div>
        </div>
        {error?.message && (
          <code className="text-destructive/80 text-sm">
            Error: {error?.message}
          </code>
        )}
      </div>
    );
  }

  return (
    <Virtuoso
      customScrollParent={scrollElement ?? undefined}
      data={entries}
      endReached={() => {
        if (hasMore) {
          debouncedFetchNextPage();
        }
      }}
      increaseViewportBy={200}
      itemContent={(_, entry) => (
        <JournalEntryProvider entry={entry}>
          <JournalEntryWrapper className="mx-auto max-w-4xl border-b pt-8 pb-20">
            <JournalEntryLink>
              <JournalEntryHeader className="px-8" />
            </JournalEntryLink>
            <JournalEntryContent>
              <DynamicJournalEntryEditor onCreateAction={onCreateAction} />
            </JournalEntryContent>
          </JournalEntryWrapper>
        </JournalEntryProvider>
      )}
      components={{
        Footer: () => (
          <JournalEntryLoader
            className="mx-auto mt-8 max-w-4xl px-8 pb-24"
            hasNextPage={hasMore}
          />
        ),
      }}
      {...rest}
    />
  );
}

export function JournalTimeline({ ...rest }: JournalVirtualListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions = trpc.journal.getTimeline.infiniteQueryOptions(
    getInfiniteJournalEntriesQueryOptions(),
  );
  const { status, data, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
    ...queryOptions,
    gcTime: 0,
    getNextPageParam: ({ nextPage }) => nextPage ?? undefined,
    initialPageParam: Date.now(),
  });

  return (
    <JournalListContent
      {...rest}
      data={data}
      error={error}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage ?? false}
      onCreateAction={(newEntry) => {
        queryClient.setQueryData(queryOptions.queryKey, (old) => ({
          ...old,
          pageParams: [...(old?.pageParams ?? [])],
          pages: [...(old?.pages ?? [])].map((page) => {
            return {
              ...page,
              timeline: page.timeline.map((entry) =>
                entry.date === newEntry.date ? newEntry : entry,
              ),
            };
          }),
        }));
      }}
      status={status}
    />
  );
}

export function JournalEntries({ ...rest }: JournalVirtualListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions = trpc.journal.getEntries.infiniteQueryOptions(
    getInfiniteEntriesQueryOptions(),
  );
  const { status, data, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
    ...queryOptions,
    gcTime: 0,
    getNextPageParam: ({ nextPage }) => nextPage ?? undefined,
    initialPageParam: null,
  });

  return (
    <JournalListContent
      {...rest}
      data={data}
      error={error}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage ?? false}
      onCreateAction={(newEntry) => {
        queryClient.setQueryData(queryOptions.queryKey, (old) => {
          const pages = [...(old?.pages ?? [])];
          if (pages.length === 0) {
            return {
              ...old,
              pageParams: [...(old?.pageParams ?? [])],
              pages,
            };
          }

          let didReplace = false;
          const updatedPages = pages.map((page) => ({
            ...page,
            timeline: page.timeline.map((entry) => {
              if (entry.date === newEntry.date) {
                didReplace = true;
                return newEntry;
              }
              return entry;
            }),
          }));

          if (!didReplace) {
            const [firstPage, ...restPages] = updatedPages;
            if (firstPage) {
              return {
                ...old,
                pageParams: [...(old?.pageParams ?? [])],
                pages: [
                  {
                    ...firstPage,
                    timeline: [newEntry, ...firstPage.timeline],
                  },
                  ...restPages,
                ],
              };
            }
          }

          return {
            ...old,
            pageParams: [...(old?.pageParams ?? [])],
            pages: updatedPages,
          };
        });
      }}
      status={status}
    />
  );
}

export function JournalList({ ...rest }: JournalVirtualListProps) {
  const { preferences } = useAppPreferences();
  const isEntriesOnly = preferences.journalTimelineView === "entries";

  return isEntriesOnly ? (
    <JournalEntries {...rest} />
  ) : (
    <JournalTimeline {...rest} />
  );
}
