"use client";

import type { BlockWithChildren } from "@acme/db/schema";
import type { Block as BlockNoteBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTRPC } from "~/trpc/react";

type BlockNoteEditorProps = {
	blocks: BlockWithChildren[];
	parentId: string;
	parentType: "page" | "block";
	isFullyLoaded: boolean;
};

// Track block changes for batching
type BlockChangeType = "insert" | "update" | "delete";
type BlockChange = {
	type: BlockChangeType;
	blockId: string;
	data: BlockNoteBlock;
	timestamp: number;
	// Optional parent info for when blocks move between parents
	newParentId?: string;
	newParentType?: "page" | "journal_entry" | "block";
};

export function BlockNoteEditor({
	blocks,
	parentId,
	parentType,
	isFullyLoaded,
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
	const prevBlocksRef = useRef<BlockWithChildren[]>([]);

	// Track previous document structure to detect nesting changes
	const prevDocumentRef = useRef<BlockNoteBlock[]>([]);
	// Track the last processed blocks to find differences (nested structure)
	const lastProcessedBlocksRef = useRef<BlockWithChildren[]>([]);

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
		})) as BlockNoteBlock[];
	}, [blocks]);

	// Helper function to flatten nested blocks for comparison
	const flattenBlocks = useCallback(
		(blocks: BlockWithChildren[]): BlockWithChildren[] => {
			const flattened: BlockWithChildren[] = [];

			const addBlockAndChildren = (block: BlockWithChildren) => {
				flattened.push(block);
				// If block has nested children (objects), recursively add them
				if (Array.isArray(block.children)) {
					for (const child of block.children) {
						addBlockAndChildren(child as BlockWithChildren);
					}
				}
			};

			for (const block of blocks) {
				addBlockAndChildren(block);
			}

			return flattened;
		},
		[],
	);

	// Create BlockNote editor
	const editor = useCreateBlockNote({
		animations: false,
		initialContent: initialBlocks,
		trailingBlock: false, // Disable automatic trailing block
	});

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
					newParentId: lastChange.newParentId,
					newParentType: lastChange.newParentType,
					type: "delete",
				});
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
		(changes: Array<{ type: BlockChangeType; block: BlockNoteBlock }>) => {
			// Skip all changes while loading
			if (!isFullyLoaded) {
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

	// Helper function to flatten BlockNote document and track parent-child relationships
	const flattenDocument = useCallback(
		(
			blocks: BlockNoteBlock[],
			blockParentId?: string,
			blockParentType?: string,
		) => {
			const currentParentId = blockParentId || parentId;
			const currentParentType = blockParentType || parentType;
			const flattened: Array<{
				block: BlockNoteBlock;
				parentId: string;
				parentType: string;
			}> = [];

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
						(child: any) => typeof child === "object" && child.id,
					) as BlockNoteBlock[];

					if (childBlocks.length > 0) {
						flattened.push(...flattenDocument(childBlocks, block.id, "block"));
					}
				}
			}

			return flattened;
		},
		[parentId, parentType],
	);

	// Handle editor changes - captures both block changes and page children order
	const handleEditorChange = useCallback(
		(e: { document: BlockNoteBlock[] }) => {
			// Skip all processing while loading
			if (!isFullyLoaded) {
				return;
			}

			// Extract ALL block IDs from the document (flattened order)
			const flattenAllBlockIds = (blocks: BlockNoteBlock[]): string[] => {
				const allIds: string[] = [];
				for (const block of blocks) {
					allIds.push(block.id);
					if (
						block.children &&
						Array.isArray(block.children) &&
						block.children.length > 0
					) {
						const childBlocks = block.children.filter(
							(child: any) => typeof child === "object" && child.id,
						) as BlockNoteBlock[];
						allIds.push(...flattenAllBlockIds(childBlocks));
					}
				}
				return allIds;
			};

			const allBlockIds = flattenAllBlockIds(e.document);
			currentParentChildrenRef.current = allBlockIds;

			// Flatten current and previous document structures to detect nesting changes
			const currentFlattened = flattenDocument(e.document);
			const prevFlattened = flattenDocument(prevDocumentRef.current);

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

				// Check if block moved to a different parent or has structural changes
				if (
					previous &&
					(previous.parentId !== current.parentId ||
						previous.parentType !== current.parentType ||
						JSON.stringify(previous.block.children) !==
							JSON.stringify(current.block.children))
				) {
					// Create update change for this block with new parent info
					const newChange: BlockChange = {
						blockId,
						data: {
							...current.block,
							children: Array.isArray(current.block.children)
								? current.block.children.map((child: any) => child.id || child)
								: [],
						},
						newParentId: current.parentId,
						newParentType: current.parentType as
							| "page"
							| "journal_entry"
							| "block",
						timestamp: Date.now(),
						type: "update",
					};

					const existingChanges = blockChangesRef.current.get(blockId) || [];
					blockChangesRef.current.set(blockId, [...existingChanges, newChange]);
				}
			}

			// Update previous document reference
			prevDocumentRef.current = e.document;

			debouncedProcessAllChanges();
		},
		[isFullyLoaded, debouncedProcessAllChanges, flattenDocument],
	);

	// Update editor content when blocks change - simple replacement approach
	useEffect(() => {
		if (blocks.length > 0) {
			// Convert all blocks to BlockNote format (preserving nested structure)
			const allBlockNoteBlocks = blocks.map((block) => ({
				children: block.children,
				content: block.content,
				id: block.id,
				props: block.props,
				type: block.type,
			})) as BlockNoteBlock[];

			// Always replace the entire document to ensure correct nesting
			editor.replaceBlocks(editor.document, allBlockNoteBlocks);

			// Update tracking references
			const currentFlattened = flattenBlocks(blocks);
			existingBlockIdsRef.current = new Set(currentFlattened.map((b) => b.id));
			lastProcessedBlocksRef.current = blocks;
			prevBlocksRef.current = blocks;

			// Update previous document reference
			prevDocumentRef.current = allBlockNoteBlocks;
		}
	}, [blocks, editor, flattenBlocks]);

	// Set up editor onChange listener for individual block changes
	editor.onChange((_, { getChanges }) => {
		// Skip all changes while loading
		if (!isFullyLoaded) {
			return;
		}

		const changes = getChanges();
		handleBlockChange(changes);
	});

	return (
		<div className="blocknote-editor">
			<BlockNoteView
				editor={editor}
				onChange={handleEditorChange}
				editable={isFullyLoaded}
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
