import type { BlockWithChildren } from "@acme/db/schema";
import type { Block as BlockNoteBlock } from "@blocknote/core";
import { useCallback, useRef } from "react";
import type {
	BlockChange,
	BlockChangeType,
	ProcessedBlockChange,
} from "../types";
import { flattenBlocks } from "../utils/block-transforms";

export function useBlockChanges(
	blocks: BlockWithChildren[],
	parentId: string,
	parentType: "page" | "block",
) {
	// Track all changes per block ID and current parent children order
	const blockChangesRef = useRef<Map<string, BlockChange[]>>(new Map());
	const currentParentChildrenRef = useRef<string[]>([]);
	const hasUnsavedChangesRef = useRef(false);
	// Track which blocks already exist in the database
	const existingBlockIdsRef = useRef<Set<string>>(new Set());

	// Initialize existing block IDs
	const initializeExistingBlocks = useCallback(() => {
		const currentFlattened = flattenBlocks(blocks);
		existingBlockIdsRef.current = new Set(currentFlattened.map((b) => b.id));
	}, [blocks]);

	// Add a block change to the tracking
	const addBlockChange = useCallback((change: BlockChange) => {
		const existingChanges = blockChangesRef.current.get(change.blockId) || [];
		blockChangesRef.current.set(change.blockId, [...existingChanges, change]);
		hasUnsavedChangesRef.current = true;

		// Update existing blocks tracking
		if (change.type === "insert") {
			existingBlockIdsRef.current.add(change.blockId);
		} else if (change.type === "delete") {
			existingBlockIdsRef.current.delete(change.blockId);
		}
	}, []);

	// Handle individual block changes from editor.onChange
	const handleBlockChanges = useCallback(
		(changes: Array<{ type: BlockChangeType; block: BlockNoteBlock }>) => {
			for (const change of changes) {
				const { block, type } = change;
				const blockId = block.id;

				// Determine the actual change type based on whether block exists
				let actualType = type as BlockChangeType;
				if (type === "insert" && existingBlockIdsRef.current.has(blockId)) {
					// Block already exists in database, treat as update
					actualType = "update";
				}

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

	// Process all batched changes
	const processAllChanges = useCallback((): {
		blockChanges: ProcessedBlockChange[];
		parentChildren: string[];
	} => {
		const changes = blockChangesRef.current;
		const parentChildren = currentParentChildrenRef.current;

		// Get current block IDs from the original blocks prop for validation
		const originalBlockIds = new Set(flattenBlocks(blocks).map((b) => b.id));

		// Convert block changes to the format expected by the API
		const blockChanges: ProcessedBlockChange[] = [];

		for (const [blockId, blockChangeList] of changes.entries()) {
			// Determine the final operation for this block
			const hasInsert = blockChangeList.some((c) => c.type === "insert");
			const hasDelete = blockChangeList.some((c) => c.type === "delete");
			const lastChange = blockChangeList[blockChangeList.length - 1];

			if (!lastChange) continue;

			// If insert then delete → do nothing (don't send any change)
			if (hasInsert && hasDelete) {
				continue;
			}

			// If delete → validate block exists before sending delete
			if (hasDelete) {
				// Only send delete if the block exists in our original data
				if (
					originalBlockIds.has(blockId) ||
					existingBlockIdsRef.current.has(blockId)
				) {
					blockChanges.push({
						blockId,
						data: lastChange.data,
						newParentId: lastChange.newParentId,
						newParentType: lastChange.newParentType,
						type: "delete",
					});
				}
			}
			// If insert (with or without updates) → send insert with final state
			else if (hasInsert) {
				blockChanges.push({
					blockId,
					data: lastChange.data,
					newParentId: lastChange.newParentId,
					newParentType: lastChange.newParentType,
					type: "insert",
				});
			}
			// If only updates → send update with final state
			else {
				blockChanges.push({
					blockId,
					data: lastChange.data,
					newParentId: lastChange.newParentId,
					newParentType: lastChange.newParentType,
					type: "update",
				});
			}
		}

		return { blockChanges, parentChildren };
	}, [blocks]);

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
