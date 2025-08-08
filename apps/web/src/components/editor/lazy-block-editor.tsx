"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { Skeleton } from "../ui/skeleton";
import { BlockEditor } from "./block-editor";
import { useNestedBlocks } from "./hooks/use-nested-blocks";

type BlockEditorProps = {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
};

const LazyBlockEditorSkeleton = () => {
	return (
		<div className="flex flex-col gap-4 p-6">
			{/* Title skeleton */}
			<Skeleton className="mb-4 h-12 w-2/3" />
			{/* Content blocks skeleton */}
			<div className="space-y-4">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-4/5" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
				<Skeleton className="h-32 w-full" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="h-4 w-5/6" />
				</div>
			</div>
		</div>
	);
};

export function LazyBlockEditor({ parentId, parentType }: BlockEditorProps) {
	const trpc = useTRPC();
	const [ready, setReady] = useState(false);

	// Fetch parent data (only for pages)
	const { data: parentData } = useQuery({
		...trpc.pages.getById.queryOptions({ id: parentId }),
		enabled: parentType === "page",
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		staleTime: 1000,
	});

	// Progressive loading with infinite query
	const {
		data: infiniteData,
		fetchNextPage,
		isFetchingNextPage,
	} = useInfiniteQuery({
		...trpc.blocks.loadPageChunk.infiniteQueryOptions({
			limit: 100,
			parentChildren: parentData?.children ?? [],
		}),
		enabled: !!parentData,
		getNextPageParam: (lastPage) => {
			return lastPage.hasMore ? lastPage.nextCursor : undefined;
		},
		refetchOnMount: true,
		staleTime: 1000,
	});

	// Combine all loaded blocks
	const allBlocks = useMemo(() => {
		if (!infiniteData?.pages) return [];
		return infiniteData.pages
			.flatMap((page) => page.blocks)
			.filter(
				(block): block is NonNullable<typeof block> => block !== undefined,
			);
	}, [infiniteData?.pages]);

	// Check if there are more pages to load
	const hasMorePages = useMemo(() => {
		if (!infiniteData?.pages?.length) return false;
		const lastPage = infiniteData.pages[infiniteData.pages.length - 1];
		return lastPage?.hasMore ?? false;
	}, [infiniteData?.pages]);

	// Transform flat blocks into nested structure
	const nestedBlocks = useNestedBlocks(allBlocks);

	// Auto-load next page in background
	useEffect(() => {
		if (hasMorePages && !isFetchingNextPage) {
			const timer = setTimeout(() => {
				fetchNextPage();
			}, 1000);
			return () => clearTimeout(timer);
		}
	}, [hasMorePages, isFetchingNextPage, fetchNextPage]);

	// Manage ready state with fade-in delay
	useEffect(() => {
		// Set ready when we have actual data
		if (infiniteData?.pages?.length && !ready) {
			const timer = setTimeout(() => {
				setReady(true);
			}, 150); // for fade-in delay
			return () => clearTimeout(timer);
		}
	}, [infiniteData?.pages?.length, ready]);

	// Show loading state until we have stable data
	if (!ready) {
		return (
			<div className="h-full">
				<LazyBlockEditorSkeleton />
			</div>
		);
	}

	return (
		<div
			className="fade-in h-full animate-in transition-opacity duration-300 ease-in-out"
			style={{ opacity: 1 }}
		>
			<BlockEditor
				blocks={nestedBlocks}
				parentId={parentId}
				parentType={parentType}
				isFullyLoaded={!hasMorePages}
				title={parentData?.title}
			/>
		</div>
	);
}
