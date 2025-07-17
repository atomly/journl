import type { Block, BlockWithChildren } from "@acme/db/schema";
import { useMemo } from "react";

/**
 * Hook to convert flat blocks from the database into a nested structure
 * @param combinedBlocks - Flat array of blocks from the database
 * @returns Nested array of blocks with proper parent-child relationships
 */
export function useNestedBlocks(combinedBlocks: Block[]): BlockWithChildren[] {
	return useMemo(() => {
		if (combinedBlocks.length === 0) return [];

		// Create a map of all blocks by ID for quick lookup
		const blockMap = new Map<string, BlockWithChildren>(
			combinedBlocks.map((block) => [
				block.id,
				{ ...block, children: [] as BlockWithChildren[] },
			]),
		);

		// Build the nested structure
		const rootBlocks: BlockWithChildren[] = [];

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
					(id): id is string => typeof id === "string" && id.length > 0,
				);

				for (const childId of childrenIds) {
					const childBlock = blockMap.get(childId);
					if (childBlock) {
						blockWithChildren.children.push(childBlock);
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
}
