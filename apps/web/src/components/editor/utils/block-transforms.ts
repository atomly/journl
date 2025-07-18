import type { BlockWithChildren } from "@acme/db/schema";
import type { Block as BlockNoteBlock } from "@blocknote/core";

/**
 * Converts database blocks to BlockNote format
 */
export function convertToBlockNoteFormat(
	blocks: BlockWithChildren[],
): BlockNoteBlock[] {
	return blocks.map((block) => ({
		children: block.children,
		content: block.content,
		id: block.id,
		props: block.props,
		type: block.type,
	})) as BlockNoteBlock[];
}

/**
 * Flattens nested blocks for comparison and tracking
 */
export function flattenBlocks(
	blocks: BlockWithChildren[],
): BlockWithChildren[] {
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
}

/**
 * Extracts all block IDs from a document in flattened order
 */
export function extractAllBlockIds(blocks: BlockNoteBlock[]): string[] {
	const allIds: string[] = [];

	for (const block of blocks) {
		allIds.push(block.id);
		if (
			block.children &&
			Array.isArray(block.children) &&
			block.children.length > 0
		) {
			const childBlocks = block.children.filter(
				(child: unknown): child is BlockNoteBlock =>
					typeof child === "object" && child !== null && "id" in child,
			);
			allIds.push(...extractAllBlockIds(childBlocks));
		}
	}

	return allIds;
}
