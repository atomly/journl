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

// Determine final operation for a block based on change history
function collapseBlockChanges(
	changes: BlockChange[],
): { operation: "create" | "update" | "delete"; data: any } | null {
	if (changes.length === 0) return null;

	const hasInsert = changes.some((c) => c.type === "insert");
	const hasDelete = changes.some((c) => c.type === "delete");
	const lastChange = changes[changes.length - 1];

	if (!lastChange) return null;

	// If insert then delete → do nothing
	if (hasInsert && hasDelete) {
		return null;
	}

	// If insert (with or without updates) → create with final state
	if (hasInsert) {
		return { data: lastChange.data, operation: "create" };
	}

	// If delete → delete
	if (hasDelete) {
		return { data: lastChange.data, operation: "delete" };
	}

	// If only updates → update with final state
	return { data: lastChange.data, operation: "update" };
}

export function BlockNoteEditor({
	blocks,
	parentId,
	parentType,
	isFullyLoaded,
	onBlocksChange,
}: BlockNoteEditorProps) {
	const trpc = useTRPC();
	const { theme, systemTheme } = useTheme();

	// Track all changes per block ID to determine final operation
	const blockChangesRef = useRef<Map<string, BlockChange[]>>(new Map());
	const hasUnsavedChangesRef = useRef(false);
	const isUpdatingProgrammaticallyRef = useRef(false);

	// Bulk mutations
	const { mutate: bulkCreateBlocks } = useMutation(
		trpc.blocks.bulkCreate.mutationOptions({
			onError: (error) => console.error("Bulk create failed:", error),
			onSuccess: (data) => console.log("Bulk create successful:", data),
		}),
	);

	const { mutate: bulkUpdateBlocks } = useMutation(
		trpc.blocks.bulkUpdate.mutationOptions({
			onError: (error) => console.error("Bulk update failed:", error),
			onSuccess: (data) => console.log("Bulk update successful:", data),
		}),
	);

	const { mutate: bulkDeleteBlocks } = useMutation(
		trpc.blocks.bulkDelete.mutationOptions({
			onError: (error) => console.error("Bulk delete failed:", error),
			onSuccess: (data) => console.log("Bulk delete successful:", data),
		}),
	);

	// Update page children order
	const { mutate: updatePageChildren } = useMutation(
		trpc.pages.updateChildren.mutationOptions({
			onError: (error) => console.error("Update page children failed:", error),
			onSuccess: (data) =>
				console.log("Update page children successful:", data),
		}),
	);

	// TODO: Re-enable page sync once API is fixed
	// Sync page children order after bulk operations
	// const { mutate: syncPageBlocks } = useMutation(
	// 	trpc.blocks.syncPageBlocks.mutationOptions({
	// 		onError: (error) => console.error("Page sync failed:", error),
	// 		onSuccess: (data) => {
	// 			console.log("Page sync successful:", data);
	// 		},
	// 	}),
	// );

	// TODO: Re-enable page sync once API is fixed
	// const debouncedPageSync = useDebouncedCallback(
	// 	(blocks: any[], pageId: string) => {
	// 		syncPageBlocks({ blocks, pageId });
	// 	},
	// 	500, // 500ms debounce
	// 	{ leading: false, trailing: true },
	// );

	// Convert blocks to BlockNote format
	const initialBlocks = useMemo(() => {
		if (blocks.length === 0) {
			return undefined;
		}

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
	});

	// Process batched changes
	const processBatchedChanges = useCallback(() => {
		const changes = blockChangesRef.current;
		if (changes.size === 0) return;

		const toCreate: any[] = [];
		const toUpdate: any[] = [];
		const toDelete: string[] = [];

		// Get current block IDs to determine if blocks exist
		const existingBlockIds = new Set(blocks.map((block) => block.id));

		// Process each block's changes
		for (const [blockId, blockChanges] of changes.entries()) {
			const result = collapseBlockChanges(blockChanges);
			if (!result) continue;

			switch (result.operation) {
				case "create":
					toCreate.push({
						content: result.data.content || [],
						id: blockId,
						parentId,
						parentType,
						props: result.data.props || {},
						type: result.data.type,
					});
					break;
				case "update":
					// If block doesn't exist in our current blocks, treat as create
					if (!existingBlockIds.has(blockId)) {
						toCreate.push({
							content: result.data.content || [],
							id: blockId,
							parentId,
							parentType,
							props: result.data.props || {},
							type: result.data.type,
						});
					} else {
						toUpdate.push({
							content: result.data.content,
							id: blockId,
							props: result.data.props,
							type: result.data.type,
						});
					}
					break;
				case "delete":
					toDelete.push(blockId);
					break;
			}
		}

		// Execute bulk operations
		const promises = [];
		if (toCreate.length > 0) {
			promises.push(bulkCreateBlocks({ blocks: toCreate }));
		}
		if (toUpdate.length > 0) {
			promises.push(bulkUpdateBlocks({ blocks: toUpdate }));
		}
		if (toDelete.length > 0) {
			promises.push(bulkDeleteBlocks({ blockIds: toDelete }));
		}

		// Note: Page children ordering is handled separately via BlockNoteView onChange
		// when the document is fully loaded and user makes changes that affect ordering

		// Clear processed changes
		blockChangesRef.current.clear();
		hasUnsavedChangesRef.current = false;
	}, [
		bulkCreateBlocks,
		bulkUpdateBlocks,
		bulkDeleteBlocks,
		parentId,
		parentType,
		blocks,
	]);

	// Debounced batch processing
	const debouncedProcessChanges = useDebouncedCallback(
		processBatchedChanges,
		1000, // 1 second debounce
		{ leading: false, trailing: true },
	);

	// Debounced page children update
	const debouncedUpdatePageChildren = useDebouncedCallback(
		(blockIds: string[]) => {
			if (parentType === "page") {
				updatePageChildren({ children: blockIds, id: parentId });
			}
		},
		500, // 500ms debounce
		{ leading: false, trailing: true },
	);

	// Handle individual block changes from editor
	const handleBlockChange = useCallback(
		(change: any) => {
			// Skip if we're updating programmatically
			if (isUpdatingProgrammaticallyRef.current) {
				return;
			}

			const { block, type } = change;

			// Track the change
			const blockId = block.id;
			const existingChanges = blockChangesRef.current.get(blockId) || [];

			const newChange: BlockChange = {
				blockId,
				data: { ...block },
				timestamp: Date.now(),
				type: type as BlockChangeType,
			};

			blockChangesRef.current.set(blockId, [...existingChanges, newChange]);
			hasUnsavedChangesRef.current = true;

			// Trigger debounced processing
			debouncedProcessChanges();
		},
		[debouncedProcessChanges],
	);

	// Handle editor changes - primarily for parent callback and ordering
	const handleEditorChange = useCallback(
		(e: { document: any[] }) => {
			// Skip if we're updating programmatically
			if (!isFullyLoaded) {
				return;
			}

			// Extract block IDs from the current document order
			const blockIds = e.document.map((block) => block.id);

			// Update page children order if this is a page
			debouncedUpdatePageChildren(blockIds);

			// Call parent callback if provided
			if (onBlocksChange) {
				const blocksData = e.document.map((block) => ({
					children: block.children || [],
					content: block.content,
					created_at: new Date(),
					created_by: "",
					id: block.id,
					parent_id: parentId,
					parent_type: parentType,
					props: block.props,
					type: block.type,
					updated_at: new Date(),
				})) as Block[];
				onBlocksChange(blocksData);
			}
		},
		[
			isFullyLoaded,
			debouncedUpdatePageChildren,
			onBlocksChange,
			parentId,
			parentType,
		],
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

			// Check if blocks have actually changed by comparing IDs
			const currentBlocks = editor.document;
			const currentBlockIds = currentBlocks.map((block) => block.id);
			const newBlockIds = blockNoteBlocks.map((block) => block.id);

			const hasChanged =
				currentBlockIds.length !== newBlockIds.length ||
				!currentBlockIds.every((id, index) => id === newBlockIds[index]);

			if (hasChanged) {
				// Set flag to prevent onChange handlers from firing during programmatic update
				isUpdatingProgrammaticallyRef.current = true;

				// Update the editor content
				editor.replaceBlocks(editor.document, blockNoteBlocks as any);

				// Reset flag after a short delay to allow the update to complete
				setTimeout(() => {
					isUpdatingProgrammaticallyRef.current = false;
				}, 100);
			}
		}
	}, [blocks, editor]);

	// Set up editor onChange listener for individual block changes
	editor.onChange((_, { getChanges }) => {
		// Skip if we're updating programmatically
		if (isUpdatingProgrammaticallyRef.current) {
			return;
		}

		const changes = getChanges();
		if (
			!isFullyLoaded &&
			changes.find(
				(change) => change.type === "insert" || change.type === "delete",
			)
		) {
			return;
		}

		handleBlockChange(changes[changes.length - 1]);
	});

	return (
		<div className="blocknote-editor">
			{!isFullyLoaded && (
				<div className="mb-2 text-muted-foreground text-sm">
					Loading blocks...
				</div>
			)}
			<BlockNoteView
				editor={editor}
				onChange={handleEditorChange}
				theme={
					theme === "system"
						? (systemTheme as "light" | "dark")
						: (theme as "light" | "dark")
				}
			/>
		</div>
	);
}
