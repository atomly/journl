"use client";

import { useState } from "react";
import { type BlockData, BlockInput } from "./block-input";

export function BlockArea() {
	const [blocks, setBlocks] = useState<BlockData[]>([
		{
			content: "",
			id: "1",
			type: "paragraph",
		},
	]);
	const [focusedBlockId, setFocusedBlockId] = useState<string | null>("1");

	const generateId = () => {
		return Date.now().toString() + Math.random().toString(36).substr(2, 9);
	};

	const updateBlock = (id: string, content: string) => {
		setBlocks(
			blocks.map((block) => (block.id === id ? { ...block, content } : block)),
		);
	};

	const addBlock = (afterId: string) => {
		const afterIndex = blocks.findIndex((block) => block.id === afterId);
		const newBlock: BlockData = {
			content: "",
			id: generateId(),
			type: "paragraph",
		};

		const newBlocks = [
			...blocks.slice(0, afterIndex + 1),
			newBlock,
			...blocks.slice(afterIndex + 1),
		];

		setBlocks(newBlocks);
		setFocusedBlockId(newBlock.id);
	};

	const deleteBlock = (id: string) => {
		if (blocks.length === 1) return; // Don't delete the last block

		const blockIndex = blocks.findIndex((block) => block.id === id);
		const newBlocks = blocks.filter((block) => block.id !== id);

		setBlocks(newBlocks);

		// Focus the previous block or the next one if it was the first
		if (blockIndex > 0) {
			setFocusedBlockId(newBlocks[blockIndex - 1]?.id ?? "");
		} else if (newBlocks.length > 0) {
			setFocusedBlockId(newBlocks[0]?.id ?? "");
		}
	};

	const handleFocus = (id: string) => {
		setFocusedBlockId(id);
	};

	return (
		<div className="min-h-screen">
			<div className="mx-auto max-w-4xl px-6 py-12">
				<div className="space-y-1">
					{blocks.map((block, index) => (
						<BlockInput
							key={block.id}
							block={block}
							index={index}
							isLast={index === blocks.length - 1}
							onUpdate={updateBlock}
							onDelete={deleteBlock}
							onAddBlock={addBlock}
							onFocus={handleFocus}
							focusedBlockId={focusedBlockId}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
