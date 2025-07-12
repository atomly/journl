import { index, pgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "../auth/user.schema.js";

export const Block = pgTable(
	"block",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		type: t.text().notNull(), // paragraph, heading, todo, toggle, code, etc.

		// Properties store the actual content/data for the block
		properties: t.jsonb().notNull().default({}),

		// Content array stores ordered list of child block IDs
		content: t.jsonb().notNull().default([]),

		// Parent relationships
		parent_type: t.text().notNull(), // 'page' | 'journal_entry' | 'block'
		parent_id: t.uuid().notNull(),

		// Metadata
		created_at: t.timestamp().notNull().defaultNow(),
		updated_at: t.timestamp().notNull().defaultNow(),
		created_by: t
			.uuid()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	}),
	(table) => [
		index("block_parent_idx").on(table.parent_type, table.parent_id),
		index("block_created_by_idx").on(table.created_by),
	],
);

// Block type validation
export const blockTypeSchema = z.enum([
	"paragraph",
	"heading_1",
	"heading_2",
	"heading_3",
	"list_item",
	"todo",
	"toggle",
	"code",
	"quote",
	"callout",
	"divider",
	"image",
	"link",
]);

export const blockParentTypeSchema = z.enum(["page", "journal_entry", "block"]);

// Type definitions
export type Block = typeof Block.$inferSelect;
export type NewBlock = typeof Block.$inferInsert;
export type BlockType = z.infer<typeof blockTypeSchema>;
export type BlockParentType = z.infer<typeof blockParentTypeSchema>;

// Common block properties schemas for type safety
export const blockPropertiesSchemas = {
	paragraph: z.object({
		title: z.array(z.array(z.string())).optional(), // Rich text format
	}),
	heading_1: z.object({
		title: z.array(z.array(z.string())).optional(),
	}),
	heading_2: z.object({
		title: z.array(z.array(z.string())).optional(),
	}),
	heading_3: z.object({
		title: z.array(z.array(z.string())).optional(),
	}),
	list_item: z.object({
		title: z.array(z.array(z.string())).optional(),
		list_type: z.enum(["bulleted", "numbered"]).default("bulleted"),
	}),
	todo: z.object({
		title: z.array(z.array(z.string())).optional(),
		checked: z.boolean().default(false),
	}),
	toggle: z.object({
		title: z.array(z.array(z.string())).optional(),
	}),
	code: z.object({
		title: z.array(z.array(z.string())).optional(),
		language: z.string().optional(),
	}),
	quote: z.object({
		title: z.array(z.array(z.string())).optional(),
	}),
	callout: z.object({
		title: z.array(z.array(z.string())).optional(),
		icon: z.string().optional(),
		color: z.string().optional(),
	}),
	divider: z.object({}),
	image: z.object({
		url: z.string(),
		caption: z.array(z.array(z.string())).optional(),
	}),
	link: z.object({
		url: z.string(),
		title: z.string().optional(),
	}),
} as const;
