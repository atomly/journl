"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { useTRPC } from "~/trpc/react";
import { BlockEditor } from "./block-editor";
import { useNestedBlocks } from "./hooks/use-nested-blocks";

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

export function LazyBlockEditor({ parentId, parentType }: BlockEditorProps) {
	const trpc = useTRPC();

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
			limit: 50,
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
		return infiniteData.pages
			.flatMap((page) => page.blocks)
			.filter(
				(block): block is NonNullable<typeof block> => block !== undefined,
			);
	}, [infiniteData?.pages]);

	// Check if we have more pages to load based on the last page's hasMore
	const hasMoreToLoad = useMemo(() => {
		if (!infiniteData?.pages || infiniteData.pages.length === 0) return false;
		const lastPage = infiniteData.pages[infiniteData.pages.length - 1];
		return lastPage?.hasMore ?? false;
	}, [infiniteData?.pages]);

	// Use the hook to get nested blocks with proper typing
	const nestedBlocks = useNestedBlocks(combinedBlocks);

	// Background loading effect - load next chunks faster
	useEffect(() => {
		if (hasMoreToLoad && !isFetchingNextPage) {
			setTimeout(() => {
				fetchNextPage();
			}, 100);
		}
	}, [hasMoreToLoad, isFetchingNextPage, fetchNextPage]);

	// Show skeleton while loading initial data
	const isLoading = isParentLoading || isBlocksLoading;
	if (isLoading) {
		return <BlockEditorSkeleton />;
	}

	return (
		<div className="h-full">
			<BlockEditor
				blocks={nestedBlocks}
				parentId={parentId}
				parentType={parentType}
				isFullyLoaded={!hasMoreToLoad}
			/>
		</div>
	);
}
