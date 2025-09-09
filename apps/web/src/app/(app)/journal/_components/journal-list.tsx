"use client";

import type { TimelineEntry } from "@acme/api";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { useDebouncedCallback } from "use-debounce";
import { useJournlAgentAwareness } from "~/ai/agents/use-journl-agent-awareness";
import { useTRPC } from "~/trpc/react";
import {
  JournalEntryContent,
  JournalEntryEditor,
  JournalEntryHeader,
  JournalEntryLink,
  JournalEntryProvider,
  JournalEntryWrapper,
} from "./journal-entry-editor";
import { JournalEntryLoader } from "./journal-entry-loader";
import { JournalListSkeleton } from "./journal-list-skeleton";

type JournalVirtualListProps = {
  initialRange: {
    limit: number;
  };
} & Omit<
  React.ComponentProps<typeof Virtuoso>,
  "data" | "endReached" | "increaseViewportBy" | "itemContent" | "components"
>;

export function JournalList({
  initialRange,
  ...rest
}: JournalVirtualListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions =
    trpc.journal.getTimeline.infiniteQueryOptions(initialRange);
  const { status, data, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
    ...queryOptions,
    gcTime: 0,
    getNextPageParam: ({ nextPage }) => nextPage,
    initialPageParam: Date.now(),
  });
  const debouncedFetchNextPage = useDebouncedCallback(fetchNextPage, 300);
  const { rememberView: setView } = useJournlAgentAwareness();

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
        [] as (TimelineEntry & { pageIndex: number })[],
      ) ?? [],
    [data],
  );

  useEffect(() => {
    setView({
      name: "journal-timeline",
    });
    return () => {
      setView({
        name: "other",
      });
    };
  }, [setView]);

  if (status === "pending") {
    return (
      <div className="mx-auto max-w-4xl px-13.5 pt-8">
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
      data={entries}
      endReached={() => debouncedFetchNextPage()}
      increaseViewportBy={200}
      itemContent={(_, entry) => (
        <JournalEntryProvider entry={entry}>
          <JournalEntryWrapper className="mx-auto max-w-4xl border-b pt-8 pb-20">
            <JournalEntryLink>
              <JournalEntryHeader className="px-13.5" />
            </JournalEntryLink>
            <JournalEntryContent>
              <JournalEntryEditor
                onCreate={(newEntry) => {
                  queryClient.setQueryData(queryOptions.queryKey, (old) => ({
                    ...old,
                    pageParams: [...(old?.pageParams ?? [])],
                    pages: [...(old?.pages ?? [])].map((page) => {
                      return {
                        ...page,
                        timeline: page.timeline.map((e) =>
                          e.date === newEntry.date ? newEntry : e,
                        ),
                      };
                    }),
                  }));
                }}
              />
            </JournalEntryContent>
          </JournalEntryWrapper>
        </JournalEntryProvider>
      )}
      components={{
        Footer: () => (
          <JournalEntryLoader
            className="mx-auto mt-8 max-w-4xl px-13.5 pb-24"
            hasNextPage={hasNextPage}
          />
        ),
      }}
      {...rest}
    />
  );
}
