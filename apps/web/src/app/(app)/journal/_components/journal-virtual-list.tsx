"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useIntersectionObserver } from "~/hooks/useIntersectionObserver";
import { useTRPC } from "~/trpc/react";
import { JournalEntry } from "./journal-entry";
import { JournalLoader } from "./journal-loader";
import { JournalFeedSkeleton } from "./journal-skeleton";

type JournalEntryOptions = {
	initialRange: {
		limit: number;
	};
};

export function JournalVirtualList({ initialRange }: JournalEntryOptions) {
	const trpc = useTRPC();
	const { status, data, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
		...trpc.journal.getBetween.infiniteQueryOptions(initialRange),
		getNextPageParam: ({ nextPage }) => nextPage,
		initialPageParam: Date.now(),
	});
	const debouncedFetchNextPage = useDebouncedCallback(fetchNextPage, 300);
	const { setTarget } = useIntersectionObserver(debouncedFetchNextPage, {
		rootMargin: "100px",
		threshold: 0.1,
	});

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

	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: hasNextPage ? entries.length + 1 : entries.length,
		estimateSize: () => 400,
		getScrollElement: () => parentRef.current,
		// overscan: 2,
	});

	const items = virtualizer.getVirtualItems();

	if (status === "pending") {
		return <JournalFeedSkeleton className="flex flex-1 flex-col" />;
	}

	if (status === "error") {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-destructive">Error: {error.message}</div>
			</div>
		);
	}

	return (
		<div
			ref={parentRef}
			className="flex h-[calc(100svh-60px)] w-full flex-col overflow-y-scroll"
			style={{
				contain: "strict",
			}}
		>
			<div
				style={{
					height: virtualizer.getTotalSize(),
				}}
				className="relative w-full"
			>
				<div
					className="absolute top-0 left-0 w-full space-y-12"
					style={{
						transform: `translateY(${items[0]?.start ?? 0}px)`,
					}}
				>
					{items.map((virtualRow) => {
						const render = () => {
							const isLoaderRow = virtualRow.index > entries.length - 1;

							if (isLoaderRow) {
								return (
									<JournalLoader
										hasNextPage={hasNextPage}
										ref={(ref) => {
											virtualizer.measureElement(ref);
											if (hasNextPage) setTarget(ref);
										}}
										className="w-full py-4"
									/>
								);
							}

							const entry = entries[virtualRow.index];

							// Simple type guard that should never happen.
							if (!entry) {
								return null;
							}

							return <JournalEntry entry={entry} />;
						};
						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
							>
								{render()}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
