"use client";

import type { BlockIdentifier } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { useMemo, useRef } from "react";
import { EditorTitle } from "~/components/editor/editor-title";
import { useBlockEditor } from "./hooks/use-block-editor";
import type { BlockNoteEditorProps } from "./types";

export function BlockEditor({
	blocks,
	parentId,
	parentType,
	isFullyLoaded,
	title,
	titlePlaceholder = "New page",
}: BlockNoteEditorProps) {
	const { theme, systemTheme } = useTheme();
	const titleRef = useRef<HTMLInputElement>(null);

	// Use the main editor hook that contains all the logic
	const { editor, handleEditorChange } = useBlockEditor(
		blocks,
		parentId,
		parentType,
		isFullyLoaded,
	);

	const firstBlock = useMemo(() => {
		return editor.document[0];
	}, [editor.document]);

	const resolvedTheme = theme === "system" ? systemTheme : theme;

	const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === "ArrowDown") {
			e.preventDefault();
			if (editor && firstBlock) {
				editor.setTextCursorPosition(firstBlock.id as BlockIdentifier, "end");
				editor.focus();
			}
		}
	};

	const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "ArrowUp" && parentType === "page") {
			const cursorPos = editor.getTextCursorPosition();
			if (cursorPos.block.id === firstBlock?.id) {
				titleRef.current?.focus();
				setTimeout(() => {
					const length = titleRef.current?.value.length || 0;
					titleRef.current?.setSelectionRange(length, length);
				}, 0);
			}
		}
	};

	return (
		<>
			<EditorTitle
				ref={titleRef}
				parentId={parentId}
				parentType={parentType}
				title={title}
				placeholder={titlePlaceholder}
				onKeyDown={handleTitleKeyDown}
				className="mb-4 pl-13"
			/>
			<div className="blocknote-editor" data-color-scheme={resolvedTheme}>
				<BlockNoteView
					editor={editor}
					onChange={isFullyLoaded ? handleEditorChange : undefined}
					editable={isFullyLoaded}
					theme={resolvedTheme as "light" | "dark"}
					onKeyDown={handleEditorKeyDown}
				/>
			</div>
		</>
	);
}
