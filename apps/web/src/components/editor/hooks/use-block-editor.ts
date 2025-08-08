import type { BlockWithChildren } from "@acme/db/schema";
import {
	type Block,
	BlockNoteSchema,
	defaultBlockSpecs,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
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

const schema = BlockNoteSchema.create({
	blockSpecs: {
		...defaultBlockSpecs,
		// TODO: Add custom blocks here
	},
});

// Type for blocks that includes our custom title block
export type EditorBlock = Block<
	typeof schema.blockSchema,
	typeof schema.inlineContentSchema,
	typeof schema.styleSchema
>;

/**
 * Hook to manage BlockNote editor with database synchronization.
 * Handles block changes, deletions, and parent-child relationships.
 */
export function useBlockEditor(
	blocks: BlockWithChildren[],
	parentId: string,
	parentType: "page" | "journal_entry" | "block",
	isFullyLoaded: boolean,
) {
	const trpc = useTRPC();
	const prevDocumentRef = useRef<EditorBlock[]>([]);

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

	// API mutation for updating embed timestamp (triggers embedding generation)
	const { mutate: updateEmbedTimestamp } = useMutation(
		trpc.pages.updateEmbedTimestamp.mutationOptions({
			onError: (error) =>
				console.error("Update embed timestamp failed:", error),
			onSuccess: () => toast.success("Your page is now searchable."),
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
		schema,
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

	// Track if we have pending embedding updates
	const hasPendingEmbeddingUpdate = useRef(false);
	// Track if embedding update has already been forced during cleanup
	const hasEmbeddingBeenForced = useRef(false);

	// Force embedding update (used for cleanup)
	const forceEmbeddingUpdate = useCallback(() => {
		if (
			parentType === "page" &&
			hasPendingEmbeddingUpdate.current &&
			!hasEmbeddingBeenForced.current
		) {
			updateEmbedTimestamp({ id: parentId });
			hasPendingEmbeddingUpdate.current = false; // Clear pending flag after forcing
			hasEmbeddingBeenForced.current = true; // Mark as forced to prevent multiple calls
		}
	}, [parentType, parentId, updateEmbedTimestamp]);

	// Separate debounced call for embedding updates (longer delay)
	const debouncedUpdateEmbedding = useDebouncedCallback(
		() => {
			// Only update embedding timestamp for pages (not individual blocks)
			if (parentType === "page") {
				updateEmbedTimestamp({ id: parentId });
				hasPendingEmbeddingUpdate.current = false; // Clear pending flag after update
				hasEmbeddingBeenForced.current = false; // Reset forced flag for future cleanup calls
			}
		},
		30000, // 30 seconds
		{
			leading: false,
			trailing: true,
		},
	);

	// Handle editor changes - captures both block changes and page children order
	const handleEditorChange = useCallback(
		(e: { document: EditorBlock[] }) => {
			// Skip all processing while loading
			if (!isFullyLoaded) {
				return;
			}

			// Extract ALL block IDs from the document (flattened order)
			const allBlockIds = extractAllBlockIds(e.document as any);
			updateParentChildren(allBlockIds);

			// DETECT DELETIONS: Compare current document with previous to find missing blocks
			const previousAllBlockIds = extractAllBlockIds(
				prevDocumentRef.current as any,
			);
			const currentAllBlockIds = new Set(allBlockIds);

			// Find blocks that were in previous document but not in current (these are deletions)
			const deletedBlockIds = previousAllBlockIds.filter(
				(blockId) => !currentAllBlockIds.has(blockId),
			);

			// Add delete operations for missing blocks
			for (const deletedBlockId of deletedBlockIds) {
				// Find the deleted block data from the previous document
				const findBlockInDocument = (
					doc: EditorBlock[],
					targetId: string,
				): EditorBlock | null => {
					for (const block of doc) {
						if (block.id === targetId) {
							return block;
						}
						if (block.children && block.children.length > 0) {
							const found = findBlockInDocument(
								block.children as EditorBlock[],
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

			// Only trigger embedding update if user has actually made changes (detected via keydown)
			if (parentType === "page" && hasPendingEmbeddingUpdate.current) {
				debouncedUpdateEmbedding();
			}
		},
		[
			isFullyLoaded,
			parentId,
			parentType,
			updateParentChildren,
			addBlockChange,
			debouncedSendChanges,
			debouncedUpdateEmbedding,
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
			handleBlockChanges(changes as any);
		});

		return unsubscribe;
	}, [editor, isFullyLoaded, handleBlockChanges]);

	// Set up event listeners to detect actual user input
	useEffect(() => {
		const markAsChanged = () => {
			if (parentType === "page" && isFullyLoaded) {
				hasPendingEmbeddingUpdate.current = true;
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			// Only set pending flag for actual content changes, not navigation keys
			const isContentKey =
				![
					"Tab",
					"Shift",
					"Control",
					"Alt",
					"Meta",
					"CapsLock",
					"Escape",
					"F1",
					"F2",
					"F3",
					"F4",
					"F5",
					"F6",
					"F7",
					"F8",
					"F9",
					"F10",
					"F11",
					"F12",
				].includes(event.key) &&
				!event.key.startsWith("Arrow") &&
				!event.ctrlKey &&
				!event.metaKey; // Ignore shortcuts like Ctrl+C, Cmd+V, etc.

			if (isContentKey) {
				markAsChanged();
			}
		};

		const handlePaste = () => markAsChanged();
		const handleCut = () => markAsChanged();

		// Add event listeners to the editor's DOM element
		const editorElement = editor.domElement;
		if (editorElement) {
			editorElement.addEventListener("keydown", handleKeyDown);
			editorElement.addEventListener("paste", handlePaste);
			editorElement.addEventListener("cut", handleCut);

			return () => {
				editorElement.removeEventListener("keydown", handleKeyDown);
				editorElement.removeEventListener("paste", handlePaste);
				editorElement.removeEventListener("cut", handleCut);
			};
		}
	}, [editor, parentType, isFullyLoaded]);

	// Handle page unload events to force embedding updates
	useEffect(() => {
		const handleBeforeUnload = () => {
			// Only force embedding updates if there are pending changes
			if (hasPendingEmbeddingUpdate.current) {
				forceEmbeddingUpdate();
			}
		};

		const handleVisibilityChange = () => {
			// Only force embedding update when page becomes hidden if there are pending changes
			if (document.hidden && hasPendingEmbeddingUpdate.current) {
				forceEmbeddingUpdate();
			}
		};

		// Add event listeners
		window.addEventListener("beforeunload", handleBeforeUnload);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		// Cleanup function to force embedding update and remove listeners
		return () => {
			if (hasPendingEmbeddingUpdate.current) {
				forceEmbeddingUpdate();
				window.removeEventListener("beforeunload", handleBeforeUnload);
				document.removeEventListener(
					"visibilitychange",
					handleVisibilityChange,
				);
			}
		};
	}, [forceEmbeddingUpdate]);

	return {
		editor,
		forceEmbeddingUpdate,
		handleEditorChange, // Expose for manual triggering if needed
	};
}
