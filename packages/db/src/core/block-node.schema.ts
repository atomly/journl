import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.ts";
import { JSONB_LIMITS } from "../constants/resource-limits.ts";
import { Document } from "./document.schema.ts";
import { JournalEntry } from "./journal-entry.schema.ts";
import { Page } from "./page.schema.ts";

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
    // Resource protection constraint for JSONB data
    check(
      "block_data_size",
      sql`length(${t.data}::text) <= ${sql.raw(String(JSONB_LIMITS.BLOCK_DATA))}`,
    ),
  ],
);
export type BlockNode = typeof BlockNode.$inferSelect;

export const BlockNodeRelations = relations(BlockNode, ({ one }) => ({
  document: one(Document, {
    fields: [BlockNode.document_id],
    references: [Document.id],
  }),
  page: one(Page, {
    fields: [BlockNode.document_id],
    references: [Page.document_id],
  }),
  journal_entry: one(JournalEntry, {
    fields: [BlockNode.document_id],
    references: [JournalEntry.document_id],
  }),
}));

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

export const BlockEdgeRelations = relations(BlockEdge, ({ one }) => ({
  document: one(Document, {
    fields: [BlockEdge.document_id],
    references: [Document.id],
  }),
  page: one(Page, {
    fields: [BlockEdge.document_id],
    references: [Page.document_id],
  }),
  journal_entry: one(JournalEntry, {
    fields: [BlockEdge.document_id],
    references: [JournalEntry.document_id],
  }),
  from_node: one(BlockNode, {
    fields: [BlockEdge.from_id],
    references: [BlockNode.id],
  }),
  to_node: one(BlockNode, {
    fields: [BlockEdge.to_id],
    references: [BlockNode.id],
  }),
}));

export const zInsertBlockEdge = createInsertSchema(BlockEdge, {
  from_id: z.string(),
  to_id: z.string(),
}).omit({
  created_at: true,
  updated_at: true,
});
