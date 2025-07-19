import type { BlockWithChildren } from "@acme/db/schema";
import type { Block as BlockNoteBlock } from "@blocknote/core";
import { useCallback, useRef } from "react";
import type {
	BlockChange,
	BlockChangeType,
	ProcessedBlockChange,
} from "../types";
import { flattenBlocks } from "../utils/block-transforms";

export function useBlockChanges(blocks: BlockWithChildren[]) {
	// Track all changes per block ID and current parent children order
	const blockChangesRef = useRef<Map<string, BlockChange[]>>(new Map());
	const currentParentChildrenRef = useRef<string[]>([]);
	const hasUnsavedChangesRef = useRef(false);
	const existingBlockIdsRef = useRef<Set<string>>(new Set());

	// Initialize existing block IDs from the loaded blocks
	const initializeExistingBlocks = useCallback(() => {
		const currentFlattened = flattenBlocks(blocks);
		existingBlockIdsRef.current = new Set(currentFlattened.map((b) => b.id));
	}, [blocks]);

	// Add a block change to the tracking
	const addBlockChange = useCallback((change: BlockChange) => {
		const existingChanges = blockChangesRef.current.get(change.blockId) || [];
		blockChangesRef.current.set(change.blockId, [...existingChanges, change]);
		hasUnsavedChangesRef.current = true;

		// Track newly inserted blocks
		if (change.type === "insert") {
			existingBlockIdsRef.current.add(change.blockId);
		}
	}, []);

	// Handle individual block changes from editor.onChange
	const handleBlockChanges = useCallback(
		(changes: Array<{ type: BlockChangeType; block: BlockNoteBlock }>) => {
			for (const change of changes) {
				const { block, type } = change;
				const blockId = block.id;

				// Convert insert to update if block already exists
				const actualType =
					type === "insert" && existingBlockIdsRef.current.has(blockId)
						? "update"
						: type;

				const newChange: BlockChange = {
					blockId,
					data: { ...block },
					timestamp: Date.now(),
					type: actualType,
				};

				addBlockChange(newChange);
			}
		},
		[addBlockChange],
	);

	// Update parent children order
	const updateParentChildren = useCallback((childrenIds: string[]) => {
		currentParentChildrenRef.current = childrenIds;
	}, []);

	// Process all batched changes and convert to API format
	const processAllChanges = useCallback((): {
		blockChanges: ProcessedBlockChange[];
		parentChildren: string[];
	} => {
		const changes = blockChangesRef.current;
		const parentChildren = currentParentChildrenRef.current;
		const blockChanges: ProcessedBlockChange[] = [];

		for (const [blockId, blockChangeList] of changes.entries()) {
			const hasInsert = blockChangeList.some((c) => c.type === "insert");
			const hasDelete = blockChangeList.some((c) => c.type === "delete");
			const lastChange = blockChangeList[blockChangeList.length - 1];

			if (!lastChange) continue;

			// Skip blocks that were inserted then deleted in the same batch
			if (hasInsert && hasDelete) {
				continue;
			}

			// Determine final operation type
			let finalType: BlockChangeType;
			if (hasDelete) {
				finalType = "delete";
			} else if (hasInsert) {
				finalType = "insert";
			} else {
				finalType = "update";
			}

			blockChanges.push({
				blockId,
				data: lastChange.data,
				newParentId: lastChange.newParentId,
				newParentType: lastChange.newParentType,
				type: finalType,
			});
		}

		return { blockChanges, parentChildren };
	}, []);

	// Clear processed changes
	const clearChanges = useCallback(() => {
		blockChangesRef.current.clear();
		hasUnsavedChangesRef.current = false;
	}, []);

	// Check if there are unsaved changes
	const hasUnsavedChanges = () => hasUnsavedChangesRef.current;

	return {
		addBlockChange,
		clearChanges,
		handleBlockChanges,
		hasUnsavedChanges,
		initializeExistingBlocks,
		processAllChanges,
		updateParentChildren,
	};
}
