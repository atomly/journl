"use client";

import type { Block } from "@acme/db/schema";
import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTRPC } from "~/trpc/react";

// Import BlockNote styles
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useTheme } from "next-themes";

type BlockNoteEditorProps = {
	blocks: Block[];
	parentId: string;
	parentType: "page" | "block";
	onBlocksChange?: (blocks: Block[]) => void;
};

export function BlockNoteEditor({
	blocks,
	parentId,
	parentType,
	onBlocksChange,
}: BlockNoteEditorProps) {
	const trpc = useTRPC();
	const { theme, systemTheme } = useTheme();

	// Track if there are unsaved changes
	const hasUnsavedChangesRef = useRef(false);
	const lastSyncVersionRef = useRef<string>("");

	const { mutate: syncPageBlocks } = useMutation(
		trpc.blocks.syncPageBlocks.mutationOptions({
			onError: (error) => {
				console.error("Sync failed:", error);
			},
			onSuccess: (data) => {
				console.log("Sync successful:", data);
				hasUnsavedChangesRef.current = false;
			},
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

	// Debounced sync function
	const debouncedSync = useDebouncedCallback(
		(editorBlocks: PartialBlock[]) => {
			if (parentType !== "page") {
				console.warn("Sync only supported for pages currently");
				return;
			}

			// Create a version hash to avoid duplicate syncs
			const versionHash = JSON.stringify(
				editorBlocks.map((b) => ({
					content: b.content,
					id: b.id,
					type: b.type,
				})),
			);

			// Skip if this is the same version we already synced
			if (versionHash === lastSyncVersionRef.current) {
				return;
			}

			lastSyncVersionRef.current = versionHash;

			// Convert BlockNote blocks to our format
			const syncBlocks = editorBlocks.map((block) => ({
				children: block.children || [],
				content: block.content || [],
				id: block.id,
				props: block.props || {},
				type: block.type,
			}));

			syncPageBlocks({
				blocks: syncBlocks as any,
				pageId: parentId,
			});
		},
		1000, // 1 second debounce
		{ leading: false, trailing: true },
	);

	// Handle editor changes
	const handleChange = useCallback(
		(e: { document: PartialBlock[] }) => {
			const editorBlocks = e.document;

			console.log("Editor blocks changed:", editorBlocks);

			hasUnsavedChangesRef.current = true;

			// Trigger debounced sync
			debouncedSync(editorBlocks);

			// Call parent callback if provided
			if (onBlocksChange) {
				const convertedBlocks = editorBlocks.map((block: any) => ({
					children: block.children || [],
					content: block.content,
					created_at: new Date(),
					created_by: "",
					id: block.id,
					parent_id: parentId,
					parent_type: parentType,
					props: block.props, // Will be set by backend
					type: block.type,
					updated_at: new Date(),
				}));
				onBlocksChange(convertedBlocks);
			}
		},
		[debouncedSync, onBlocksChange, parentId, parentType],
	);

	return (
		<div className="blocknote-editor">
			<BlockNoteView
				editor={editor}
				onChange={handleChange}
				theme={
					theme === "system"
						? (systemTheme as "light" | "dark")
						: (theme as "light" | "dark")
				}
			/>
		</div>
	);
}
