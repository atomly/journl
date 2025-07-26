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

	// Get parent data (for pages) - refetch once when navigating
	const { data: parentData, isLoading: isParentLoading } = useQuery({
		...trpc.pages.byId.queryOptions({ id: parentId }),
		enabled: parentType === "page",
		// Refetch once when navigating to a page (not continuously)
		refetchOnMount: true,
		// Refetch when window regains focus to catch external changes
		refetchOnWindowFocus: true, // 1 second
		// Short stale time to ensure relatively fresh data but prevent infinite loops
		staleTime: 1000,
	});

	// Progressive loading with infinite query - refetch once when navigating
	const {
		data: infiniteData,
		fetchNextPage,
		isFetchingNextPage,
		isLoading: isBlocksLoading,
	} = useInfiniteQuery({
		...trpc.blocks.loadPageChunk.infiniteQueryOptions({
			limit: 100,
			parentChildren: parentData?.children ?? [],
		}),
		enabled: !!parentData,
		getNextPageParam: (lastPage) => {
			return lastPage.hasMore ? lastPage.nextCursor : undefined;
		},
		// Refetch once when navigating to a page (not continuously)
		refetchOnMount: true,
		// Short stale time to ensure relatively fresh data but prevent infinite loops
		staleTime: 1000, // 1 second
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
			}, 2000);
		}
	}, [hasMoreToLoad, isFetchingNextPage, fetchNextPage]);

	// Show skeleton while loading initial data OR when refetching
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
