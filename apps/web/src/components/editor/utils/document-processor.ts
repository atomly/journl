import type { Block as BlockNoteBlock } from "@blocknote/core";
import type { EditorBlock } from "../hooks/use-block-editor";
import type { FlattenedBlock } from "../types";

/**
 * Flattens BlockNote document and tracks parent-child relationships
 */
export function flattenDocument(
	blocks: EditorBlock[],
	parentId: string,
	parentType: string,
	blockParentId?: string,
	blockParentType?: string,
): FlattenedBlock[] {
	const currentParentId = blockParentId || parentId;
	const currentParentType = blockParentType || parentType;
	const flattened: FlattenedBlock[] = [];

	for (const block of blocks) {
		// Add current block
		flattened.push({
			block,
			parentId: currentParentId,
			parentType: currentParentType,
		});

		// Recursively add children
		if (
			block.children &&
			Array.isArray(block.children) &&
			block.children.length > 0
		) {
			const childBlocks = block.children.filter(
				(child) => child.id,
			) as BlockNoteBlock[];

			if (childBlocks.length > 0) {
				flattened.push(
					...flattenDocument(
						childBlocks,
						parentId,
						parentType,
						block.id,
						"block",
					),
				);
			}
		}
	}

	return flattened;
}

/**
 * Compares two flattened document structures to detect parent changes
 */
export function detectParentChanges(
	currentFlattened: FlattenedBlock[],
	prevFlattened: FlattenedBlock[],
) {
	const changes: Array<{
		blockId: string;
		block: EditorBlock;
		newParentId: string;
		newParentType: string;
		changeType: "moved" | "children_changed";
	}> = [];

	// Create maps for easier comparison
	const currentBlockParents = new Map(
		currentFlattened.map(({ block, parentId, parentType }) => [
			block.id,
			{ block, parentId, parentType },
		]),
	);

	const prevBlockParents = new Map(
		prevFlattened.map(({ block, parentId, parentType }) => [
			block.id,
			{ block, parentId, parentType },
		]),
	);

	// Detect blocks that have changed parents (nesting changes)
	for (const [blockId, current] of currentBlockParents) {
		const previous = prevBlockParents.get(blockId);

		// Check if block moved to a different parent
		if (
			previous &&
			(previous.parentId !== current.parentId ||
				previous.parentType !== current.parentType)
		) {
			changes.push({
				block: current.block,
				blockId,
				changeType: "moved",
				newParentId: current.parentId,
				newParentType: current.parentType,
			});
		}
		// Check for children changes only for blocks that didn't move
		else if (
			previous &&
			previous.parentId === current.parentId &&
			previous.parentType === current.parentType
		) {
			const prevChildrenIds = Array.isArray(previous.block.children)
				? previous.block.children.map((child) => child.id || child)
				: [];
			const currentChildrenIds = Array.isArray(current.block.children)
				? current.block.children.map((child) => child.id || child)
				: [];

			// Compare children arrays by ID only
			if (
				JSON.stringify(prevChildrenIds) !== JSON.stringify(currentChildrenIds)
			) {
				changes.push({
					block: current.block,
					blockId,
					changeType: "children_changed",
					newParentId: current.parentId,
					newParentType: current.parentType,
				});
			}
		}
	}

	return changes;
}
