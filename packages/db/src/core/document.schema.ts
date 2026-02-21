import { relations, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.ts";
import { BlockEdge, BlockNode } from "./block-node.schema.ts";

export const Document = pgTable("document", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  user_id: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  created_at: t
    .timestamp({ mode: "string", withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: t
    .timestamp({ mode: "string", withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`now()`),
}));

export type Document = typeof Document.$inferSelect;

export const DocumentRelations = relations(Document, ({ many }) => ({
  block_nodes: many(BlockNode),
  block_edges: many(BlockEdge),
}));

export const zInsertDocument = createInsertSchema(Document).pick({
  user_id: true,
});

export const zDocument = createSelectSchema(Document);
