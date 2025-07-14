"use client";

import type { Block } from "@acme/db/schema";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { useTRPC } from "~/trpc/react";
import { BlockNoteEditor } from "./blocknote-editor";

type BlockEditorProps = {
	parentId: string;
	parentType: "page" | "block";
};

function BlockEditorSkeleton() {
	return (
		<div className="space-y-4 p-4">
			<Skeleton className="h-8 w-3/4" />
			<Skeleton className="h-6 w-full" />
			<Skeleton className="h-6 w-5/6" />
			<Skeleton className="h-8 w-2/3" />
			<Skeleton className="h-6 w-full" />
			<Skeleton className="h-6 w-4/5" />
			<Skeleton className="h-6 w-3/4" />
		</div>
	);
}

export function BlockEditor({ parentId, parentType }: BlockEditorProps) {
	const trpc = useTRPC();
	const [allBlocks, setAllBlocks] = useState<Block[]>([]);

	// Get parent data (for pages)
	const { data: parentData, isLoading: isParentLoading } = useQuery({
		...trpc.pages.byId.queryOptions({ id: parentId }),
		enabled: parentType === "page",
	});

	// Progressive loading with infinite query
	const {
		data: infiniteData,
		fetchNextPage,
		isFetchingNextPage,
		isLoading: isBlocksLoading,
	} = useInfiniteQuery({
		...trpc.blocks.loadPageChunk.infiniteQueryOptions({
			limit: 10,
			parentId,
			parentType,
		}),
		enabled: !!parentData || parentType === "block",
		getNextPageParam: (lastPage) => {
			return lastPage.hasMore ? lastPage.nextCursor : undefined;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	// Combine all loaded blocks
	const combinedBlocks = useMemo(() => {
		if (!infiniteData?.pages) return [];
		return infiniteData.pages.flatMap((page) => page.blocks);
	}, [infiniteData?.pages]);

	// Check if we have more pages to load based on the last page's hasMore
	const hasMoreToLoad = useMemo(() => {
		if (!infiniteData?.pages || infiniteData.pages.length === 0) return false;
		const lastPage = infiniteData.pages[infiniteData.pages.length - 1];
		return lastPage?.hasMore ?? false;
	}, [infiniteData?.pages]);

	// Get blocks in the correct order based on parent's children array
	const orderedBlocks = useMemo(() => {
		if (combinedBlocks.length === 0) return [];

		// Get the order from parent's children array
		let childrenOrder: string[] = [];
		if (parentType === "page" && parentData?.children) {
			childrenOrder = parentData.children as string[];
		} else if (parentType === "block" && combinedBlocks.length > 0) {
			// For block parents, the order is determined by the API response
			return combinedBlocks;
		}

		// If no children order, return blocks as-is
		if (childrenOrder.length === 0) {
			return combinedBlocks;
		}

		// Create a map for quick lookup
		const blockMap = new Map(combinedBlocks.map((block) => [block.id, block]));

		// Return blocks in the order specified by children array
		return childrenOrder
			.map((blockId) => blockMap.get(blockId))
			.filter((block): block is Block => block !== undefined);
	}, [combinedBlocks, parentData?.children, parentType]);

	// Background loading effect
	useEffect(() => {
		if (hasMoreToLoad && !isFetchingNextPage) {
			fetchNextPage();
		} else if (!hasMoreToLoad) {
			setAllBlocks(orderedBlocks);
		}
	}, [hasMoreToLoad, isFetchingNextPage, fetchNextPage, orderedBlocks]);

	// Update allBlocks when orderedBlocks changes
	useEffect(() => {
		setAllBlocks(orderedBlocks);
	}, [orderedBlocks]);

	// Show skeleton while loading initial data
	const isLoading = isParentLoading || isBlocksLoading;
	if (isLoading) {
		return <BlockEditorSkeleton />;
	}

	return (
		<div className="h-full">
			<BlockNoteEditor
				blocks={allBlocks}
				parentId={parentId}
				parentType={parentType}
				isFullyLoaded={!hasMoreToLoad}
			/>
		</div>
	);
}
