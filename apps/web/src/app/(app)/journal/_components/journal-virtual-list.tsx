"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { useDebouncedCallback } from "use-debounce";
import { useTRPC } from "~/trpc/react";
import {
	JournalEntryContent,
	JournalEntryHeader,
	JournalEntryLink,
	JournalEntryProvider,
	JournalEntryTextArea,
} from "./journal-entry";
import { JournalEntryLoader } from "./journal-entry-loader";
import { JournalFeedSkeleton } from "./journal-skeleton";

type JournalVirtualListProps = {
	initialRange: {
		limit: number;
	};
} & Omit<
	React.ComponentProps<typeof Virtuoso>,
	"data" | "endReached" | "increaseViewportBy" | "itemContent" | "components"
>;

export function JournalVirtualList({
	initialRange,
	...rest
}: JournalVirtualListProps) {
	const trpc = useTRPC();
	const { status, data, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
		...trpc.journal.getTimeline.infiniteQueryOptions(initialRange),
		getNextPageParam: ({ nextPage }) => nextPage,
		initialPageParam: Date.now(),
	});
	const debouncedFetchNextPage = useDebouncedCallback(fetchNextPage, 300);

	const entries = useMemo(
		() =>
			data?.pages.reduce(
				(acc, page, index) => {
					let entries = page.entries;
					if (index === 0) {
						entries = entries.filter((entry) => {
							// The server can return dates in the future, so we need to filter them out
							const isFutureEntry =
								new Date(`${entry.date}T00:00:00`) > new Date();
							return !isFutureEntry;
						});
					}
					acc.push(...entries);
					return acc;
				},
				[] as (typeof data.pages)[number]["entries"],
			) ?? [],
		[data],
	);

	if (status === "pending") {
		return (
			<div className="mx-auto max-w-4xl px-4 pt-8 md:px-8">
				<JournalFeedSkeleton className="mx-auto flex flex-1 flex-col" />
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
				<JournalEntryProvider
					className="mx-auto max-w-4xl border-b px-4 pt-8 pb-20 md:px-8"
					entry={entry}
				>
					<JournalEntryLink>
						<JournalEntryHeader />
					</JournalEntryLink>
					<JournalEntryContent>
						<JournalEntryTextArea />
					</JournalEntryContent>
				</JournalEntryProvider>
			)}
			components={{
				Footer: () => (
					<JournalEntryLoader
						className="mx-auto mt-8 max-w-4xl px-4 pb-24 md:px-8"
						hasNextPage={hasNextPage}
					/>
				),
			}}
			{...rest}
		/>
	);
}
