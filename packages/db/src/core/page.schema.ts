import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.ts";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";
import { BlockEdge, BlockNode } from "./block-node.schema.ts";
import { Document } from "./document.schema.ts";

export const Page = pgTable(
  "page",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document_id: t
      .uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    title: varchar("title", { length: TEXT_LIMITS.PAGE_TITLE }).notNull(),
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
    index("page_user_id_updated_at_desc_index").on(
      t.user_id,
      t.updated_at.desc(),
    ),
  ],
);

export const PageRelations = relations(Page, ({ many }) => ({
  block_nodes: many(BlockNode),
  block_edges: many(BlockEdge),
}));

export type Page = typeof Page.$inferSelect;

export const zInsertPage = createInsertSchema(Page, {
  title: z.string().max(TEXT_LIMITS.PAGE_TITLE),
}).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zUpdatePage = createInsertSchema(Page, {
  title: z.string().min(1).max(TEXT_LIMITS.PAGE_TITLE),
}).omit({
  created_at: true,
  id: true,
  updated_at: true,
  user_id: true,
});

export const zPage = createSelectSchema(Page);
