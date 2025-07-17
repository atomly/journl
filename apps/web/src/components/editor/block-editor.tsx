"use client";

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
	const [allBlocks, setAllBlocks] = useState<any[]>([]);

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
			limit: 5,
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

	// Reconstruct nested structure from flat blocks using their children arrays
	const nestedBlocks = useMemo(() => {
		if (combinedBlocks.length === 0) return [];

		// Create a map of all blocks by ID for quick lookup
		const blockMap = new Map(
			combinedBlocks.map((block) => [
				block.id,
				{ ...block, children: [] as any[] },
			]),
		);

		// Build the nested structure
		const rootBlocks: any[] = [];

		// First, identify which blocks are referenced as children by other blocks
		const childBlockIds = new Set<string>();
		for (const block of combinedBlocks) {
			if (Array.isArray(block.children)) {
				for (const childId of block.children) {
					if (typeof childId === "string") {
						childBlockIds.add(childId);
					}
				}
			}
		}

		// Process each block to build parent-child relationships
		for (const block of combinedBlocks) {
			const blockWithChildren = blockMap.get(block.id);
			if (!blockWithChildren) continue;

			// If this block has children, find them and nest them (only if child blocks are available)
			if (Array.isArray(block.children) && block.children.length > 0) {
				const childrenIds = block.children.filter(
					(id) => typeof id === "string" && id.length > 0,
				);

				for (const childId of childrenIds) {
					const childBlock = blockMap.get(childId);
					if (childBlock) {
						blockWithChildren.children.push(childBlock);
					} else {
						// Child block not found for parent
					}
				}
			}

			// If this block is not a child of any other block, it's a root block
			if (!childBlockIds.has(block.id)) {
				rootBlocks.push(blockWithChildren);
			}
		}

		return rootBlocks;
	}, [combinedBlocks]);

	// Background loading effect - load next chunks faster
	useEffect(() => {
		if (hasMoreToLoad && !isFetchingNextPage) {
			setTimeout(() => {
				fetchNextPage();
			}, 1000); // Reduced from 3000ms to 100ms for faster loading
		}
	}, [hasMoreToLoad, isFetchingNextPage, fetchNextPage]);

	// Update allBlocks when nestedBlocks changes (always keep in sync)
	useEffect(() => {
		setAllBlocks(nestedBlocks);
	}, [nestedBlocks]);

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
