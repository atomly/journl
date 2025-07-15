"use client";

import type { Block } from "@acme/db/schema";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTRPC } from "~/trpc/react";

// Import BlockNote styles
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

type BlockNoteEditorProps = {
	blocks: Block[];
	parentId: string;
	parentType: "page" | "block";
	isFullyLoaded: boolean;
	onBlocksChange?: (blocks: Block[]) => void;
};

// Track block changes for batching
type BlockChangeType = "insert" | "update" | "delete";
type BlockChange = {
	type: BlockChangeType;
	blockId: string;
	data: any;
	timestamp: number;
};

export function BlockNoteEditor({
	blocks,
	parentId,
	parentType,
	isFullyLoaded,
	onBlocksChange,
}: BlockNoteEditorProps) {
	const trpc = useTRPC();
	const { theme, systemTheme } = useTheme();

	// Track all changes per block ID and current parent children order
	const blockChangesRef = useRef<Map<string, BlockChange[]>>(new Map());
	const currentParentChildrenRef = useRef<string[]>([]);
	const hasUnsavedChangesRef = useRef(false);
	// Track which blocks already exist in the database
	const existingBlockIdsRef = useRef<Set<string>>(new Set());
	// Track previous blocks to detect new additions
	const prevBlocksRef = useRef<Block[]>([]);
	// Track if there were changes made during loading
	const changesWhileLoadingRef = useRef(false);

	// New combined mutation for processing editor changes
	const { mutate: processEditorChanges } = useMutation(
		trpc.blocks.processEditorChanges.mutationOptions({
			onError: (error) =>
				console.error("Process editor changes failed:", error),
			onSuccess: (data) =>
				console.log("Process editor changes successful:", data),
		}),
	);

	// Convert blocks to BlockNote format
	const initialBlocks = useMemo(() => {
		if (blocks.length === 0) {
			return undefined;
		}

		// Track existing block IDs
		const blockIds = blocks.map((block) => block.id);
		existingBlockIdsRef.current = new Set(blockIds);

		return blocks.map((block) => ({
			children: block.children,
			content: block.content,
			id: block.id,
			props: block.props,
			type: block.type,
		}));
	}, [blocks]);

	// Create BlockNote editor
	const editor = useCreateBlockNote({
		animations: false,
		initialContent: initialBlocks as any,
		trailingBlock: false, // Disable automatic trailing block
	});

	// Sync changes made during loading using processEditorChanges
	const syncChangesAfterLoading = useCallback(() => {
		// Only sync if there were actually changes made during loading
		if (!changesWhileLoadingRef.current) {
			return;
		}

		console.log("zzz Syncing changes made during loading");

		// Get current editor state
		const currentBlocks = editor.document.map((block) => block.id);
		currentParentChildrenRef.current = currentBlocks;

		// Create block changes for all blocks in the editor
		// We'll treat all blocks as updates since both insert and update now use upsert logic
		const blockChanges = editor.document.map((block) => ({
			blockId: block.id,
			data: {
				...block,
				children: Array.isArray(block.children)
					? block.children.map((child: any) => child.id || child)
					: [],
			},
			type: "update" as const,
		}));

		// Use processEditorChanges for consistency
		processEditorChanges({
			blockChanges,
			parentChildren: currentBlocks,
			parentId,
			parentType,
			updateChildren: true,
		});

		// Reset the flag and clear changes
		changesWhileLoadingRef.current = false;
		blockChangesRef.current.clear();
		hasUnsavedChangesRef.current = false;
	}, [editor, parentId, parentType, processEditorChanges]);

	// Process all batched changes - both blocks and parent children
	const processAllChanges = useCallback(() => {
		const changes = blockChangesRef.current;
		const parentChildren = currentParentChildrenRef.current;

		if (changes.size === 0 && parentChildren.length === 0) return;

		// Convert block changes to the format expected by the API
		// For each block, determine the final operation based on all changes
		const blockChanges: any[] = [];
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

			// If delete → send delete with the last change data
			if (hasDelete) {
				blockChanges.push({
					blockId,
					data: lastChange.data,
					type: "delete",
				});
			}
			// If insert (with or without updates) → send insert with final state
			else if (hasInsert) {
				blockChanges.push({
					blockId,
					data: lastChange.data,
					type: "insert",
				});
			}
			// If only updates → send update with final state
			else {
				blockChanges.push({
					blockId,
					data: lastChange.data,
					type: "update",
				});
			}
		}

		// Call the combined API
		processEditorChanges({
			blockChanges,
			parentChildren,
			parentId,
			parentType,
			updateChildren: true,
		});

		// Clear processed changes
		blockChangesRef.current.clear();
		hasUnsavedChangesRef.current = false;
	}, [processEditorChanges, parentId, parentType]);

	// Debounced processing of all changes
	const debouncedProcessAllChanges = useDebouncedCallback(
		processAllChanges,
		1000, // 1 second debounce
		{ leading: false, trailing: true },
	);

	// Handle individual block changes from editor.onChange
	const handleBlockChange = useCallback(
		(changes: any[]) => {
			// If not fully loaded, track that changes were made but don't process them yet
			if (!isFullyLoaded) {
				changesWhileLoadingRef.current = true;
				return;
			}

			// Process each change in the array
			for (const change of changes) {
				const { block, type } = change;
				const blockId = block.id;

				// Determine the actual change type based on whether block exists
				let actualType = type as BlockChangeType;
				if (type === "insert" && existingBlockIdsRef.current.has(blockId)) {
					// Block already exists in database, treat as update
					actualType = "update";
				} else if (type === "insert") {
					// Truly new block, add to existing set
					existingBlockIdsRef.current.add(blockId);
				} else if (type === "delete") {
					// Block deleted, remove from existing set
					existingBlockIdsRef.current.delete(blockId);
				}

				// Track the change
				const existingChanges = blockChangesRef.current.get(blockId) || [];

				const newChange: BlockChange = {
					blockId,
					data: { ...block },
					timestamp: Date.now(),
					type: actualType,
				};

				blockChangesRef.current.set(blockId, [...existingChanges, newChange]);
				hasUnsavedChangesRef.current = true;
			}
		},
		[isFullyLoaded],
	);

	// Handle editor changes - captures both block changes and page children order
	const handleEditorChange = useCallback(
		(e: { document: any[] }) => {
			// If not fully loaded, skip processing - we'll sync everything at the end
			if (!isFullyLoaded) {
				return;
			}

			// Skip if no changes to process
			if (blockChangesRef.current.size === 0) {
				return;
			}

			// Extract block IDs from the current document order
			const blockIds = e.document.map((block) => block.id);
			currentParentChildrenRef.current = blockIds;

			// Process all changes (blocks + page children) together
			debouncedProcessAllChanges();
		},
		[isFullyLoaded, debouncedProcessAllChanges],
	);

	// Update editor content when blocks change
	useEffect(() => {
		if (blocks.length > 0) {
			const blockNoteBlocks = blocks.map((block) => ({
				children: block.children,
				content: block.content,
				id: block.id,
				props: block.props,
				type: block.type,
			}));

			// Get previous block IDs
			const prevBlockIds = new Set(
				prevBlocksRef.current.map((block) => block.id),
			);

			// Find new blocks that weren't in previous blocks
			const newBlocks = blockNoteBlocks.filter(
				(block) => !prevBlockIds.has(block.id),
			);

			// If this is the first load or we have new blocks, update the editor
			if (prevBlocksRef.current.length === 0) {
				// First load - replace the entire document
				editor.replaceBlocks(editor.document, blockNoteBlocks as any);
				existingBlockIdsRef.current = new Set(blockNoteBlocks.map((b) => b.id));
			} else if (newBlocks.length > 0) {
				// Add only new blocks to the end
				const lastBlock = editor.document[editor.document.length - 1];
				if (lastBlock) {
					// Insert after the last block since we disabled trailing block
					editor.insertBlocks(newBlocks as any, lastBlock.id, "after");
				} else {
					// If document is empty, replace with new blocks
					editor.replaceBlocks(editor.document, newBlocks as any);
				}

				// Update existing blocks set
				newBlocks.forEach((block) => existingBlockIdsRef.current.add(block.id));
			}

			// Update previous blocks reference
			prevBlocksRef.current = blocks;
		}
	}, [blocks, editor]);

	// Sync changes made during loading when fully loaded
	useEffect(() => {
		if (isFullyLoaded && blocks.length > 0) {
			// Only sync if there were changes made during loading
			syncChangesAfterLoading();
		}
	}, [isFullyLoaded, blocks.length, syncChangesAfterLoading]);

	// Set up editor onChange listener for individual block changes
	editor.onChange((_, { getChanges }) => {
		// Skip if we're updating programmatically
		// if (isUpdatingProgrammaticallyRef.current) {
		// 	return;
		// }

		const changes = getChanges();
		if (
			!isFullyLoaded &&
			changes.find(
				(change) => change.type === "insert" || change.type === "delete",
			)
		) {
			return;
		}

		handleBlockChange(changes);
	});

	return (
		<div className="blocknote-editor">
			<BlockNoteView
				editor={editor}
				onChange={handleEditorChange}
				theme={
					theme === "system"
						? (systemTheme as "light" | "dark")
						: (theme as "light" | "dark")
				}
			/>
			{!isFullyLoaded && (
				<div className="mb-2 text-muted-foreground text-sm">
					Loading blocks...
				</div>
			)}
		</div>
	);
}
