"use client";

import { Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { Button } from "../ui/button";

export type BlockData = {
	id: string;
	type: "paragraph" | "heading1" | "heading2" | "heading3";
	content: string;
};

type BlockProps = {
	block: BlockData;
	index: number;
	isLast: boolean;
	onUpdate: (id: string, content: string) => void;
	onDelete: (id: string) => void;
	onAddBlock: (afterId: string) => void;
	onFocus: (id: string) => void;
	focusedBlockId: string | null;
};

export function BlockInput({
	block,
	index,
	onUpdate,
	onDelete,
	onAddBlock,
	onFocus,
	focusedBlockId,
}: BlockProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isFocused = focusedBlockId === block.id;

	useEffect(() => {
		if (isFocused && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [isFocused]);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, []);

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		// Auto-resize on input
		e.target.style.height = "auto";
		e.target.style.height = `${e.target.scrollHeight}px`;

		// Update content
		onUpdate(block.id, e.target.value);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onAddBlock(block.id);
		} else if (e.key === "Backspace" && block.content === "") {
			e.preventDefault();
			onDelete(block.id);
		}
	};

	const getPlaceholder = () => {
		switch (block.type) {
			case "heading1":
				return "Heading 1";
			case "heading2":
				return "Heading 2";
			case "heading3":
				return "Heading 3";
			default:
				return index === 0 ? "Start writing..." : "";
		}
	};

	const getTextareaClass = () => {
		const baseClass =
			"w-full bg-transparent border-none outline-none resize-none overflow-hidden placeholder-gray-400";

		switch (block.type) {
			case "heading1":
				return `${baseClass} text-3xl font-bold leading-tight`;
			case "heading2":
				return `${baseClass} text-2xl font-semibold leading-tight`;
			case "heading3":
				return `${baseClass} text-xl font-medium leading-tight`;
			default:
				return `${baseClass} text-base leading-relaxed`;
		}
	};

	return (
		<div className="group relative">
			<div className="flex items-start gap-2">
				<div className="flex-1">
					<textarea
						ref={textareaRef}
						value={block.content}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						onFocus={() => onFocus(block.id)}
						placeholder={getPlaceholder()}
						className={getTextareaClass()}
						rows={1}
					/>
				</div>
				<div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					<Button
						type="button"
						onClick={() => onAddBlock(block.id)}
						variant="ghost"
						title="Add block below"
					>
						<Plus className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						onClick={() => onDelete(block.id)}
						variant="ghost"
						title="Delete block"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
