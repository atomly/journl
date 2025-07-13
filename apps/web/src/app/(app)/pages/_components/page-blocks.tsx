"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { useDebouncedCallback } from "use-debounce";
import { useTRPC } from "~/trpc/react";

type PageBlocksProps = {
	initialRange: {
		limit: number;
		cursor: string | undefined;
	};
	parentId: string;
	parentType: "page" | "block";
};

// Simple Block component for rendering individual blocks
function Block({ block }: { block: any }) {
	// Basic rendering based on block type
	switch (block.type) {
		case "heading_1":
			return (
				<h1 className="mb-4 font-bold text-3xl">
					{block.properties?.title || "Untitled"}
				</h1>
			);
		case "heading_2":
			return (
				<h2 className="mb-3 font-bold text-2xl">
					{block.properties?.title || "Untitled"}
				</h2>
			);
		case "heading_3":
			return (
				<h3 className="mb-2 font-bold text-xl">
					{block.properties?.title || "Untitled"}
				</h3>
			);
		case "paragraph":
		default:
			return (
				<p className="mb-4 leading-relaxed">
					{block.properties?.text || "Empty block"}
				</p>
			);
	}
}

// Loading skeleton for blocks
function BlockSkeleton() {
	return (
		<div className="mb-4 animate-pulse">
			<div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
			<div className="h-4 w-1/2 rounded bg-gray-200" />
		</div>
	);
}

// Footer component for loading indicator
function BlocksFooter({ hasNextPage }: { hasNextPage: boolean }) {
	if (!hasNextPage) return null;

	return (
		<div className="py-4">
			<BlockSkeleton />
		</div>
	);
}

export function PageBlocks({
	initialRange,
	parentId,
	parentType,
}: PageBlocksProps) {
	const trpc = useTRPC();

	const { status, data, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
		...trpc.blocks.loadPageChunk.infiniteQueryOptions({
			cursor: initialRange.cursor,
			limit: initialRange.limit,
			parentId,
			parentType,
		}),
		enabled: !!initialRange.cursor,
		getNextPageParam: ({ nextCursor }) => nextCursor,
		initialPageParam: initialRange.cursor ?? null,
	});

	const debouncedFetchNextPage = useDebouncedCallback(fetchNextPage, 300);

	const blocks = useMemo(
		() => data?.pages.flatMap((page) => page.blocks) ?? [],
		[data],
	);

	// If there's no cursor, show empty state immediately
	if (!initialRange.cursor) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				No blocks yet. Start typing to create your first block.
			</div>
		);
	}

	if (status === "pending") {
		return (
			<div className="space-y-4">
				<BlockSkeleton />
				<BlockSkeleton />
				<BlockSkeleton />
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className="mx-auto flex h-full flex-1 flex-col items-center justify-center gap-y-8 text-center">
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

	if (blocks.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				No blocks yet. Start typing to create your first block.
			</div>
		);
	}

	return (
		<Virtuoso
			className="h-full"
			data={blocks}
			endReached={() => debouncedFetchNextPage()}
			increaseViewportBy={200}
			itemContent={(_, block) => (
				<div className="px-4 py-2">
					<Block block={block} />
				</div>
			)}
			components={{
				Footer: () => <BlocksFooter hasNextPage={hasNextPage} />,
			}}
		/>
	);
}
