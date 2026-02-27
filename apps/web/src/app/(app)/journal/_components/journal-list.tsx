"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo } from "react";
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
  JournalEntryHeader,
  JournalEntryLink,
  JournalEntryProvider,
  JournalEntryWrapper,
} from "./journal-entry-editor";
import { DynamicJournalEntryEditor } from "./journal-entry-editor.dynamic";
import { JournalEntrySkeleton } from "./journal-entry-skeleton";
import { JournalListSkeleton } from "./journal-list-skeleton";

type JournalListProps = Omit<
  React.ComponentProps<typeof Virtuoso>,
  "data" | "endReached" | "increaseViewportBy" | "itemContent" | "components"
>;

export function JournalList(props: JournalListProps) {
  const { preferences } = useAppPreferences();
  const isEntriesOnly = preferences.journalTimelineView === "entries";

  return isEntriesOnly ? (
    <JournalEntries {...props} />
  ) : (
    <JournalTimeline {...props} />
  );
}

export function JournalEntries(props: JournalListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions = trpc.journal.getEntries.infiniteQueryOptions(
    getInfiniteEntriesQueryOptions(),
  );
  const { status, data, error, fetchNextPage, hasNextPage, isFetching } =
    useInfiniteQuery({
      ...queryOptions,
      gcTime: 0,
      getNextPageParam: ({ nextPage }) => nextPage ?? undefined,
      initialPageParam: null,
    });

  return (
    <VirtualizedJournalList
      {...props}
      data={data}
      error={error}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage ?? false}
      isFetching={isFetching}
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

export function JournalTimeline(props: JournalListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions = trpc.journal.getTimeline.infiniteQueryOptions(
    getInfiniteJournalEntriesQueryOptions(),
  );
  const { status, data, error, fetchNextPage, hasNextPage, isFetching } =
    useInfiniteQuery({
      ...queryOptions,
      gcTime: 0,
      getNextPageParam: ({ nextPage }) => nextPage ?? undefined,
      initialPageParam: Date.now(),
    });

  return (
    <VirtualizedJournalList
      {...props}
      data={data}
      error={error}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage ?? false}
      isFetching={isFetching}
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

type VirtualizedJournalListProps = JournalListProps & {
  status: "pending" | "error" | "success";
  data:
    | {
        pages: Array<{ timeline: JournalListEntry[] }>;
      }
    | undefined;
  error: { message?: string } | null;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetching: boolean;
  onCreateAction: (newEntry: JournalListEntry) => void;
};

function VirtualizedJournalList({
  status,
  data,
  error,
  fetchNextPage,
  hasNextPage,
  isFetching,
  onCreateAction,
  ...rest
}: VirtualizedJournalListProps) {
  const debouncedFetchNextPage = useDebouncedCallback(fetchNextPage, 300);
  const { setView } = useJournlAgent();
  const { scrollElement } = useAppLayout();

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
      <div className="mx-auto flex h-full max-w-4xl flex-1 flex-col items-center justify-center gap-y-6 text-center md:gap-y-8">
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
        if (hasNextPage) {
          debouncedFetchNextPage();
        }
      }}
      increaseViewportBy={200}
      itemContent={(_, entry) => (
        <JournalEntryProvider entry={entry}>
          <JournalEntryWrapper className="mx-auto max-w-4xl border-b pt-8 pb-20">
            <React.Suspense>
              <DynamicJournalEntryEditor onCreateAction={onCreateAction}>
                <JournalEntryLink>
                  <JournalEntryHeader className="px-8" />
                </JournalEntryLink>
              </DynamicJournalEntryEditor>
            </React.Suspense>
          </JournalEntryWrapper>
        </JournalEntryProvider>
      )}
      components={{
        Footer: () => (
          <JournalListFooter
            className="-mx-8 mt-8 max-w-4xl px-8 pb-24"
            hasNextPage={hasNextPage}
            isFetching={isFetching}
          />
        ),
      }}
      {...rest}
    />
  );
}

type JournalListFooterProps = Omit<React.ComponentProps<"div">, "children"> & {
  hasNextPage: boolean;
  isFetching: boolean;
};

function JournalListFooter({
  hasNextPage,
  isFetching,
  ...rest
}: JournalListFooterProps) {
  if (isFetching && hasNextPage) {
    return <JournalEntrySkeleton hasContent {...rest} />;
  }

  if (hasNextPage) return null;

  return (
    <div {...rest}>
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        There are no more entries to load
      </div>
    </div>
  );
}
