import type { BlockWithChildren } from "@acme/db/schema";
import type { EditorBlock } from "./hooks/use-block-editor";

export type BlockNoteEditorProps = {
	blocks: BlockWithChildren[];
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	isFullyLoaded: boolean;
	/** Title for the editor - used for pages and journal entries */
	title?: string;
	/** Placeholder text for the title input */
	titlePlaceholder?: string;
};

export type BlockChangeType = "insert" | "update" | "delete";

export type BlockChange = {
	blockId: string;
	type: BlockChangeType;
	timestamp: number;
	data: {
		id: string;
		type: string;
		content: any;
		props: any;
		children: any[];
	};
	newParentId?: string;
	newParentType?: "page" | "journal_entry" | "block";
};

export type FlattenedBlock = {
	blockId: string;
	block: any;
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
