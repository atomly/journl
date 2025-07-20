import type { BlockWithChildren } from "@acme/db/schema";
import type { Block as BlockNoteBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTRPC } from "~/trpc/react";
import type { BlockChange } from "../types";
import {
	convertToBlockNoteFormat,
	extractAllBlockIds,
} from "../utils/block-transforms";
import {
	detectParentChanges,
	flattenDocument,
} from "../utils/document-processor";
import { useBlockChanges } from "./use-block-changes";

/**
 * Hook to manage BlockNote editor with database synchronization.
 * Handles block changes, deletions, and parent-child relationships.
 */
export function useBlockEditor(
	blocks: BlockWithChildren[],
	parentId: string,
	parentType: "page" | "block",
	isFullyLoaded: boolean,
) {
	const trpc = useTRPC();
	const prevDocumentRef = useRef<BlockNoteBlock[]>([]);

	// Block changes management
	const {
		addBlockChange,
		clearChanges,
		handleBlockChanges,
		initializeExistingBlocks,
		processAllChanges,
		updateParentChildren,
	} = useBlockChanges(blocks);

	// API mutation for processing editor changes
	const { mutate: processEditorChanges } = useMutation(
		trpc.blocks.processEditorChanges.mutationOptions({
			onError: (error) =>
				console.error("Process editor changes failed:", error),
			onSuccess: (data) =>
				console.debug("Process editor changes successful:", data),
		}),
	);

	// Convert blocks to BlockNote format
	const initialBlocks = useMemo(() => {
		if (blocks.length === 0) {
			return undefined;
		}
		return convertToBlockNoteFormat(blocks);
	}, [blocks]);

	// Create BlockNote editor
	const editor = useCreateBlockNote({
		animations: false,
		initialContent: initialBlocks,
	});

	// Send all changes to API
	const sendChangesToAPI = useCallback(() => {
		const { blockChanges, parentChildren } = processAllChanges();

		if (blockChanges.length === 0 && parentChildren.length === 0) return;

		processEditorChanges({
			blockChanges,
			parentChildren,
			parentId,
			parentType,
			updateChildren: true,
		});

		clearChanges();
	}, [
		processAllChanges,
		processEditorChanges,
		parentId,
		parentType,
		clearChanges,
	]);

	// Debounced API calls
	const debouncedSendChanges = useDebouncedCallback(sendChangesToAPI, 500, {
		leading: false,
		trailing: true,
	});

	// Handle editor changes - captures both block changes and page children order
	const handleEditorChange = useCallback(
		(e: { document: BlockNoteBlock[] }) => {
			// Skip all processing while loading
			if (!isFullyLoaded) {
				return;
			}

			// Extract ALL block IDs from the document (flattened order)
			const allBlockIds = extractAllBlockIds(e.document);
			updateParentChildren(allBlockIds);

			// DETECT DELETIONS: Compare current document with previous to find missing blocks
			const previousAllBlockIds = extractAllBlockIds(prevDocumentRef.current);
			const currentAllBlockIds = new Set(allBlockIds);

			// Find blocks that were in previous document but not in current (these are deletions)
			const deletedBlockIds = previousAllBlockIds.filter(
				(blockId) => !currentAllBlockIds.has(blockId),
			);

			// Add delete operations for missing blocks
			for (const deletedBlockId of deletedBlockIds) {
				// Find the deleted block data from the previous document
				const findBlockInDocument = (
					doc: BlockNoteBlock[],
					targetId: string,
				): BlockNoteBlock | null => {
					for (const block of doc) {
						if (block.id === targetId) {
							return block;
						}
						if (block.children && block.children.length > 0) {
							const found = findBlockInDocument(
								block.children as BlockNoteBlock[],
								targetId,
							);
							if (found) return found;
						}
					}
					return null;
				};

				const deletedBlock = findBlockInDocument(
					prevDocumentRef.current,
					deletedBlockId,
				);
				if (deletedBlock) {
					const deleteChange: BlockChange = {
						blockId: deletedBlockId,
						data: {
							...deletedBlock,
							children: deletedBlock.children || [],
						},
						timestamp: Date.now(),
						type: "delete",
					};

					addBlockChange(deleteChange);
				}
			}

			// Flatten current and previous document structures to detect nesting changes
			const currentFlattened = flattenDocument(
				e.document,
				parentId,
				parentType,
			);
			const prevFlattened = flattenDocument(
				prevDocumentRef.current,
				parentId,
				parentType,
			);

			// Detect changes and add them to tracking
			const changes = detectParentChanges(currentFlattened, prevFlattened);

			for (const change of changes) {
				const newChange: BlockChange = {
					blockId: change.blockId,
					data: {
						...change.block,
						children: change.block.children,
					},
					newParentId: change.newParentId,
					newParentType: change.newParentType as
						| "page"
						| "journal_entry"
						| "block",
					timestamp: Date.now(),
					type: "update",
				};

				addBlockChange(newChange);
			}

			// Update previous document reference
			prevDocumentRef.current = e.document;

			debouncedSendChanges();
		},
		[
			isFullyLoaded,
			parentId,
			parentType,
			updateParentChildren,
			addBlockChange,
			debouncedSendChanges,
		],
	);

	// Update editor content when blocks change
	useEffect(() => {
		if (blocks.length > 0) {
			// Convert all blocks to BlockNote format (preserving nested structure)
			const allBlockNoteBlocks = convertToBlockNoteFormat(blocks);

			// Always replace the entire document to ensure correct nesting
			editor.replaceBlocks(editor.document, allBlockNoteBlocks);

			// Update tracking references
			initializeExistingBlocks();
			prevDocumentRef.current = allBlockNoteBlocks;
		}
	}, [blocks, editor, initializeExistingBlocks]);

	// Set up editor onChange listener for individual block changes
	useEffect(() => {
		const unsubscribe = editor.onChange((_, { getChanges }) => {
			// Skip all changes while loading
			if (!isFullyLoaded) {
				return;
			}

			const changes = getChanges();
			handleBlockChanges(changes);
		});

		return unsubscribe;
	}, [editor, isFullyLoaded, handleBlockChanges]);

	return {
		editor,
		handleEditorChange,
	};
}
