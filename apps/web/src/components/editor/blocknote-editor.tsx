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

	// Track all changes per block ID and current page children order
	const blockChangesRef = useRef<Map<string, BlockChange[]>>(new Map());
	const currentPageChildrenRef = useRef<string[]>([]);
	const hasUnsavedChangesRef = useRef(false);
	const isUpdatingProgrammaticallyRef = useRef(false);

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

	// Process all batched changes - both blocks and page children
	const processAllChanges = useCallback(() => {
		const changes = blockChangesRef.current;
		const pageChildren = currentPageChildrenRef.current;

		if (changes.size === 0 && pageChildren.length === 0) return;

		// Convert block changes to the format expected by the API
		const blockChanges: any[] = [];
		for (const [_, blockChangeList] of changes.entries()) {
			for (const change of blockChangeList) {
				blockChanges.push({
					blockId: change.blockId,
					data: change.data,
					type: change.type,
				});
			}
		}

		// Call the combined API
		processEditorChanges({
			blockChanges,
			pageChildren, // Only relevant for pages
			pageId: parentType === "page" ? parentId : "",
			parentId,
			parentType,
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
	const handleBlockChange = useCallback((change: any) => {
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

		// Don't trigger processing here - wait for handleEditorChange
	}, []);

	// Handle editor changes - captures both block changes and page children order
	const handleEditorChange = useCallback(
		(e: { document: any[] }) => {
			// Skip if we're updating programmatically or not fully loaded
			if (isUpdatingProgrammaticallyRef.current || !isFullyLoaded) {
				return;
			}

			// Extract block IDs from the current document order
			const blockIds = e.document.map((block) => block.id);
			currentPageChildrenRef.current = blockIds;

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

			// Process all changes (blocks + page children) together
			debouncedProcessAllChanges();
		},
		[
			isFullyLoaded,
			onBlocksChange,
			parentId,
			parentType,
			debouncedProcessAllChanges,
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

		// Store the block change but don't process it yet
		const lastChange = changes[changes.length - 1];
		if (lastChange) {
			handleBlockChange(lastChange);
		}
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
