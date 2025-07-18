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
 * Custom hook to manage the block editor's state and interactions.
 *
 * This hook is responsible for:
 * 1. Setting up references to track the previous document structure and processed blocks.
 * 2. Utilizing the `useBlockChanges` hook to manage block changes, including adding, clearing, and processing changes.
 * 3. Configuring a mutation to process editor changes via the API, with error and success handling.
 * 4. Converting the initial blocks into the BlockNote format for the editor.
 * 5. Creating the BlockNote editor instance with specific configurations.
 * 6. Defining a callback to process and send all changes to the API.
 */
export function useBlockEditor(
	blocks: BlockWithChildren[],
	parentId: string,
	parentType: "page" | "block",
	isFullyLoaded: boolean,
) {
	const trpc = useTRPC();

	// Track previous document structure to detect nesting changes
	const prevDocumentRef = useRef<BlockNoteBlock[]>([]);
	const lastProcessedBlocksRef = useRef<BlockWithChildren[]>([]);
	const prevBlocksRef = useRef<BlockWithChildren[]>([]);

	// Use the block changes hook
	const {
		addBlockChange,
		clearChanges,
		handleBlockChanges,
		initializeExistingBlocks,
		processAllChanges,
		updateParentChildren,
	} = useBlockChanges(blocks, parentId, parentType);

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
		trailingBlock: false, // Disable automatic trailing block
	});

	// Process and send all changes to the API
	const sendChangesToAPI = useCallback(() => {
		const { blockChanges, parentChildren } = processAllChanges();

		if (blockChanges.length === 0 && parentChildren.length === 0) return;

		// Call the combined API
		processEditorChanges({
			blockChanges,
			parentChildren,
			parentId,
			parentType,
			updateChildren: true,
		});

		// Clear processed changes
		clearChanges();
	}, [
		processAllChanges,
		processEditorChanges,
		parentId,
		parentType,
		clearChanges,
	]);

	// Debounced processing of all changes
	const debouncedSendChanges = useDebouncedCallback(
		sendChangesToAPI,
		1000, // 1 second debounce
		{ leading: false, trailing: true },
	);

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
			lastProcessedBlocksRef.current = blocks;
			prevBlocksRef.current = blocks;

			// Update previous document reference
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
