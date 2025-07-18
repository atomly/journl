import type { Block, BlockWithChildren } from "@acme/db/schema";
import { useMemo, useRef } from "react";

/**
 * Hook to convert flat blocks from the database into a nested structure with optimized incremental processing
 * @param combinedBlocks - Flat array of blocks from the database
 * @returns Nested array of blocks with proper parent-child relationships
 */
export function useNestedBlocks(combinedBlocks: Block[]): BlockWithChildren[] {
	// Refs to store previous computation results for memoization
	const previousBlocksRef = useRef<Block[]>([]);
	const previousResultRef = useRef<BlockWithChildren[]>([]);
	const blockMapRef = useRef<Map<string, BlockWithChildren>>(new Map());
	const childBlockIdsRef = useRef<Set<string>>(new Set());

	return useMemo(() => {
		if (combinedBlocks.length === 0) {
			// Reset refs when no blocks
			previousBlocksRef.current = [];
			previousResultRef.current = [];
			blockMapRef.current.clear();
			childBlockIdsRef.current.clear();
			return [];
		}

		const previousBlocks = previousBlocksRef.current;
		const previousBlockMap = blockMapRef.current;

		// Check if this is just adding new blocks to existing ones (incremental loading)
		const isIncrementalUpdate =
			previousBlocks.length > 0 &&
			combinedBlocks.length > previousBlocks.length &&
			combinedBlocks
				.slice(0, previousBlocks.length)
				.every((block, index) => previousBlocks[index]?.id === block.id);

		if (isIncrementalUpdate) {
			// Incremental processing: only add new blocks, then rebuild all relationships
			const newBlocks = combinedBlocks.slice(previousBlocks.length);

			// Add new blocks to the existing block map (reset their children arrays)
			for (const block of newBlocks) {
				previousBlockMap.set(block.id, {
					...block,
					children: [] as BlockWithChildren[],
				});
			}

			// Now rebuild ALL parent-child relationships from scratch using all blocks
			// This ensures children from new chunks connect to parents from previous chunks

			// First, reset all children arrays
			for (const [_, blockWithChildren] of previousBlockMap.entries()) {
				blockWithChildren.children = [];
			}

			// Rebuild child block IDs set from all blocks
			const allChildBlockIds = new Set<string>();
			for (const block of combinedBlocks) {
				if (Array.isArray(block.children)) {
					for (const childId of block.children) {
						if (typeof childId === "string") {
							allChildBlockIds.add(childId);
						}
					}
				}
			}

			// Rebuild all parent-child relationships
			for (const block of combinedBlocks) {
				const blockWithChildren = previousBlockMap.get(block.id);
				if (!blockWithChildren) continue;

				// If this block has children, find them and nest them
				if (Array.isArray(block.children) && block.children.length > 0) {
					const childrenIds = block.children.filter(
						(id): id is string => typeof id === "string" && id.length > 0,
					);

					for (const childId of childrenIds) {
						const childBlock = previousBlockMap.get(childId);
						if (childBlock) {
							blockWithChildren.children.push(childBlock);
						}
					}
				}
			}

			// Find root blocks (blocks that are not children of others)
			const rootBlocks: BlockWithChildren[] = [];
			for (const [blockId, blockWithChildren] of previousBlockMap.entries()) {
				if (!allChildBlockIds.has(blockId)) {
					rootBlocks.push(blockWithChildren);
				}
			}

			// Update refs for next iteration
			previousBlocksRef.current = combinedBlocks;
			previousResultRef.current = rootBlocks;
			childBlockIdsRef.current = allChildBlockIds;

			return rootBlocks;
		} else {
			// Full recalculation: either first load or blocks changed significantly
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

			// Update refs for next iteration
			previousBlocksRef.current = combinedBlocks;
			previousResultRef.current = rootBlocks;
			blockMapRef.current = blockMap;
			childBlockIdsRef.current = childBlockIds;

			return rootBlocks;
		}
	}, [combinedBlocks]);
}
