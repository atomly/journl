"use client";

import type { Block } from "@acme/db/schema";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

	// Load all blocks for this parent at once
	// Since we're using a single editor, we don't need pagination
	const { data: parentData, isLoading: isParentLoading } = useQuery({
		...trpc.pages.byId.queryOptions({ id: parentId }),
		enabled: parentType === "page",
	});

	const { data: blocksData, isLoading: isBlocksLoading } = useQuery({
		...trpc.blocks.loadPageChunkRecursive.queryOptions({
			limit: 50, // High limit to load all blocks at once
			maxDepth: 5,
			parentId,
			parentType,
		}),
		enabled: !!parentData || parentType === "block",
	});

	// Get blocks in the correct order based on parent's children array
	const orderedBlocks = useMemo(() => {
		if (!blocksData?.blocks) return [];

		// Get the order from parent's children array
		let childrenOrder: string[] = [];
		if (parentType === "page" && parentData?.children) {
			childrenOrder = parentData.children as string[];
		} else if (parentType === "block" && blocksData.blocks.length > 0) {
			// For block parents, the order is determined by the API response
			return blocksData.blocks;
		}

		// If no children order, return blocks as-is
		if (childrenOrder.length === 0) {
			return blocksData.blocks;
		}

		// Create a map for quick lookup
		const blockMap = new Map(
			blocksData.blocks.map((block) => [block.id, block]),
		);

		// Return blocks in the order specified by children array
		const orderedResult = childrenOrder
			.map((blockId) => {
				const block = blockMap.get(blockId);
				if (!block) {
					console.warn("Block not found in blockMap:", blockId);
				}
				return block;
			})
			.filter((block): block is Block => block !== undefined);

		return orderedResult;
	}, [blocksData?.blocks, parentData?.children, parentType]);

	console.log("orderedBlocks", orderedBlocks);

	// Show skeleton while loading
	const isLoading = isParentLoading || isBlocksLoading;
	if (isLoading) {
		return <BlockEditorSkeleton />;
	}

	return (
		<div className="h-full">
			<BlockNoteEditor
				blocks={orderedBlocks}
				parentId={parentId}
				parentType={parentType}
			/>
		</div>
	);
}
