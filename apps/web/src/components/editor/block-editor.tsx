"use client";

import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useBlockEditor } from "./hooks/use-block-editor";
import type { BlockNoteEditorProps } from "./types";

export function BlockEditor({
	blocks,
	parentId,
	parentType,
	isFullyLoaded,
}: BlockNoteEditorProps) {
	const { theme, systemTheme } = useTheme();
	const [isReady, setIsReady] = useState(false);

	// Use the main editor hook that contains all the logic
	const { editor, handleEditorChange } = useBlockEditor(
		blocks,
		parentId,
		parentType,
		isFullyLoaded,
	);

	const resolvedTheme = theme === "system" ? systemTheme : theme;

	useEffect(() => {
		if (editor.document && editor.document.length > 0) {
			setIsReady(true);
		}
	}, [editor.document]);

	if (!isReady) {
		return null;
	}

	return (
		<div className="blocknote-editor" data-color-scheme={resolvedTheme}>
			<BlockNoteView
				editor={editor}
				onChange={isFullyLoaded ? handleEditorChange : undefined}
				editable={isFullyLoaded}
				theme={resolvedTheme as "light" | "dark"}
			/>
			{!isFullyLoaded && (
				<div className="mb-2 text-muted-foreground text-sm">
					Loading blocks...
				</div>
			)}
		</div>
	);
}
