import type { BlockWithChildren } from "@acme/db/schema";
import type { EditorBlock } from "./hooks/use-block-editor";

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
	data: EditorBlock;
	timestamp: number;
	// Optional parent info for when blocks move between parents
	newParentId?: string;
	newParentType?: "page" | "journal_entry" | "block";
};

export type FlattenedBlock = {
	block: EditorBlock;
	parentId: string;
	parentType: string;
};

export type ProcessedBlockChange = {
	blockId: string;
	data: EditorBlock;
	newParentId?: string;
	newParentType?: "page" | "journal_entry" | "block";
	type: BlockChangeType;
};
