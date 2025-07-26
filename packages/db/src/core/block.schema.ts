import { sql } from "drizzle-orm";
import { index, pgTable } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.js";

export const Block = pgTable(
	"block",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		type: t.text().notNull(), // paragraph, heading, bulletListItem, numberedListItem, checkListItem, etc.

		// Props store the block-specific properties (BlockNote uses 'props' not 'properties')
		props: t.jsonb().notNull().default({}),

		// Content stores the rich text content as InlineContent[] or undefined for void blocks
		content: t.jsonb(), // Can be null for void blocks like divider

		// Children array stores ordered list of child block IDs
		children: t.text().array().notNull().default([]),

		// Parent relationships
		// Note: parent_id references different tables based on parent_type
		// Cascade deletes must be handled at the application level
		parent_type: t.text().notNull(), // 'page' | 'journal_entry' | 'block'
		parent_id: t.uuid().notNull(),

		// Metadata
		created_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => sql`now()`),
		created_by: t
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	}),
	(table) => [
		index("block_parent_idx").on(table.parent_type, table.parent_id),
		index("block_created_by_idx").on(table.created_by),
	],
);

// Block type validation - Updated to match BlockNote's default schema
export const blockTypeSchema = z.enum([
	"paragraph",
	"heading",
	"bulletListItem",
	"numberedListItem",
	"checkListItem",
	"quote",
	"divider",
	"callout",
	"toggleListItem",
	"table",
	"image",
	"video",
	"audio",
	"file",
	"codeBlock",
]);

export const blockParentTypeSchema = z.enum(["page", "journal_entry", "block"]);

// Type definitions
export type Block = typeof Block.$inferSelect;
export type NewBlock = typeof Block.$inferInsert;
export type BlockType = z.infer<typeof blockTypeSchema>;
export type BlockParentType = z.infer<typeof blockParentTypeSchema>;
export type BlockWithChildren = Omit<Block, "children"> & {
	children: BlockWithChildren[];
};

// Rich text content schema - supports BlockNote's InlineContent format
// Content is stored as InlineContent[] or null for void blocks

// Define InlineContent type based on BlockNote structure
export type InlineContent =
	| { type: "text"; text: string; styles?: Record<string, any> }
	| { type: "link"; href: string; content: InlineContent[] }
	| any; // Allow other BlockNote inline content types

// BlockNote-compatible block props schemas
export const blockPropsSchemas = {
	paragraph: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	heading: z.object({
		level: z.number().min(1).max(6).default(1),
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	bulletListItem: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	numberedListItem: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	checkListItem: z.object({
		checked: z.boolean().default(false),
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	quote: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	divider: z.object({}), // Divider blocks have no props
	callout: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
		icon: z.string().optional(), // Emoji or icon identifier
	}),
	toggleListItem: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
		textAlignment: z.enum(["left", "center", "right", "justify"]).optional(),
	}),
	table: z.object({
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
	}),
	image: z.object({
		url: z.string(),
		caption: z.string().optional(),
		width: z.number().optional(),
		textAlignment: z.enum(["left", "center", "right"]).optional(),
	}),
	video: z.object({
		url: z.string(),
		caption: z.string().optional(),
		width: z.number().optional(),
		textAlignment: z.enum(["left", "center", "right"]).optional(),
	}),
	audio: z.object({
		url: z.string(),
		caption: z.string().optional(),
	}),
	file: z.object({
		url: z.string(),
		name: z.string(),
		caption: z.string().optional(),
	}),
	codeBlock: z.object({
		language: z.string().optional(),
		textColor: z.string().optional(),
		backgroundColor: z.string().optional(),
	}),
} as const;

// Type helpers for inferring props based on block type
export type BlockPropsForType<T extends BlockType> = z.infer<
	(typeof blockPropsSchemas)[T]
>;

// Union type for all possible block props
export type BlockProps = {
	[K in BlockType]: BlockPropsForType<K>;
};

// Helper to get the props schema for a specific block type
export const getBlockPropsSchema = <T extends BlockType>(type: T) =>
	blockPropsSchemas[type];

// Type-safe helper functions for creating block inputs
export const createBlockInput = <T extends BlockType>(
	type: T,
	input: {
		parentId: string;
		parentType: "page" | "journal_entry" | "block";
		props: BlockPropsForType<T>;
		content?: InlineContent[];
		insertIndex?: number;
	},
) => ({
	type,
	parentId: input.parentId,
	parentType: input.parentType,
	props: input.props,
	content: input.content,
	insertIndex: input.insertIndex,
});

export const updateBlockInput = <T extends BlockType>(
	blockId: string,
	input: {
		props?: Partial<BlockPropsForType<T>>;
		content?: InlineContent[];
		type?: T;
	},
) => ({
	blockId,
	props: input.props,
	content: input.content,
	type: input.type,
});

// Specific helper functions for common block types
export const createParagraphBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	content?: InlineContent[];
	props?: BlockPropsForType<"paragraph">;
	insertIndex?: number;
}) =>
	createBlockInput("paragraph", {
		...input,
		props: input.props || {},
	});

export const createHeadingBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	content?: InlineContent[];
	level?: 1 | 2 | 3 | 4 | 5 | 6;
	props?: Partial<BlockPropsForType<"heading">>;
	insertIndex?: number;
}) =>
	createBlockInput("heading", {
		...input,
		props: { level: input.level || 1, ...input.props },
	});

export const createCheckListItemBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	content?: InlineContent[];
	checked?: boolean;
	props?: Partial<BlockPropsForType<"checkListItem">>;
	insertIndex?: number;
}) =>
	createBlockInput("checkListItem", {
		...input,
		props: { checked: input.checked ?? false, ...input.props },
	});

export const createQuoteBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	content?: InlineContent[];
	props?: BlockPropsForType<"quote">;
	insertIndex?: number;
}) =>
	createBlockInput("quote", {
		...input,
		props: input.props || {},
	});

export const createDividerBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	insertIndex?: number;
}) =>
	createBlockInput("divider", {
		...input,
		props: {},
		content: undefined, // Divider blocks have no content
	});

export const createCalloutBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	content?: InlineContent[];
	props?: BlockPropsForType<"callout">;
	insertIndex?: number;
}) =>
	createBlockInput("callout", {
		...input,
		props: input.props || {},
	});

export const createToggleListItemBlock = (input: {
	parentId: string;
	parentType: "page" | "journal_entry" | "block";
	content?: InlineContent[];
	props?: BlockPropsForType<"toggleListItem">;
	insertIndex?: number;
}) =>
	createBlockInput("toggleListItem", {
		...input,
		props: input.props || {},
	});

export const updateParagraphBlock = (
	blockId: string,
	input: {
		content?: InlineContent[];
		props?: Partial<BlockPropsForType<"paragraph">>;
	},
) => updateBlockInput(blockId, input);

export const updateCheckListItemBlock = (
	blockId: string,
	input: {
		content?: InlineContent[];
		props?: Partial<BlockPropsForType<"checkListItem">>;
	},
) => updateBlockInput(blockId, input);

export const updateQuoteBlock = (
	blockId: string,
	input: {
		content?: InlineContent[];
		props?: Partial<BlockPropsForType<"quote">>;
	},
) => updateBlockInput(blockId, input);

export const updateDividerBlock = (
	blockId: string,
	input: {
		props?: Partial<BlockPropsForType<"divider">>;
	},
) => updateBlockInput(blockId, input);

export const updateCalloutBlock = (
	blockId: string,
	input: {
		content?: InlineContent[];
		props?: Partial<BlockPropsForType<"callout">>;
	},
) => updateBlockInput(blockId, input);

export const updateToggleListItemBlock = (
	blockId: string,
	input: {
		content?: InlineContent[];
		props?: Partial<BlockPropsForType<"toggleListItem">>;
	},
) => updateBlockInput(blockId, input);

export const zBlock = createSelectSchema(Block);
