import { sql } from "drizzle-orm";
import {
	foreignKey,
	pgEnum,
	pgTable,
	primaryKey,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.js";
import { Document } from "./document.schema.js";

export const BlockNode = pgTable(
	"block_node",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		user_id: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		document_id: t
			.uuid()
			.notNull()
			.references(() => Document.id, { onDelete: "cascade" }),
		parent_id: t.uuid(),
		data: t.jsonb().notNull().default({}),
		created_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => sql`now()`),
	}),
	(t) => [
		/**
		 * We have to write self-references in here, otherwise drizzle runs into TypeScript errors.
		 * @see {@link https://github.com/drizzle-team/drizzle-orm/issues/4308 | [BUG]: Self referencing Foreign Key causes any type}
		 */
		foreignKey({
			columns: [t.parent_id],
			foreignColumns: [t.id],
		}).onDelete("cascade"),
	],
);
export type BlockNode = typeof BlockNode.$inferSelect;

export const zInsertBlockNode = createInsertSchema(BlockNode, {
	id: z.uuid(),
	data: z.record(z.string(), z.unknown()),
}).omit({
	created_at: true,
	updated_at: true,
});

export const BlockEdgeType = pgEnum("block_edge_type", ["sibling"]);

export const BlockEdge = pgTable(
	"block_edge",
	(t) => ({
		type: BlockEdgeType(),
		user_id: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		document_id: t
			.uuid()
			.notNull()
			.references(() => Document.id, { onDelete: "cascade" }),
		from_id: t
			.uuid()
			.notNull()
			.references(() => BlockNode.id, { onDelete: "cascade" }),
		to_id: t
			.uuid()
			.notNull()
			.references(() => BlockNode.id, { onDelete: "cascade" }),
		created_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => sql`now()`),
	}),
	(t) => [primaryKey({ columns: [t.from_id, t.to_id] })],
);
export type BlockEdge = typeof BlockEdge.$inferSelect;

export const zInsertBlockEdge = createInsertSchema(BlockEdge, {
	from_id: z.string(),
	to_id: z.string(),
}).omit({
	created_at: true,
	updated_at: true,
});
