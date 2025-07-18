"use client";

import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { useBlockEditor } from "./hooks/use-block-editor";
import type { BlockNoteEditorProps } from "./types";

export function BlockEditor({
	blocks,
	parentId,
	parentType,
	isFullyLoaded,
}: BlockNoteEditorProps) {
	const { theme, systemTheme } = useTheme();

	// Use the main editor hook that contains all the logic
	const { editor, handleEditorChange } = useBlockEditor(
		blocks,
		parentId,
		parentType,
		isFullyLoaded,
	);

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
