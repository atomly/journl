import type { BlockWithChildren } from "@acme/db/schema";
import type { Block as BlockNoteBlock } from "@blocknote/core";

export type BlockNoteEditorProps = {
	blocks: BlockWithChildren[];
	parentId: string;
	parentType: "page" | "block";
	isFullyLoaded: boolean;
};

export type BlockChangeType = "insert" | "update" | "delete";

export type BlockChange = {
	type: BlockChangeType;
	blockId: string;
	data: BlockNoteBlock;
	timestamp: number;
	// Optional parent info for when blocks move between parents
	newParentId?: string;
	newParentType?: "page" | "journal_entry" | "block";
};

export type FlattenedBlock = {
	block: BlockNoteBlock;
	parentId: string;
	parentType: string;
};

export type ProcessedBlockChange = {
	blockId: string;
	data: BlockNoteBlock;
	newParentId?: string;
	newParentType?: "page" | "journal_entry" | "block";
	type: BlockChangeType;
};
