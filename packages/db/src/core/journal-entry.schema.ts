import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import z from "zod/v4";
import { user } from "../auth/user.schema.ts";
import { BlockEdge, BlockNode } from "./block-node.schema.ts";
import { Document } from "./document.schema.ts";

export const JournalEntry = pgTable(
  "journal_entry",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document_id: t
      .uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    date: t.date({ mode: "string" }).notNull(),
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
    // Enforce uniqueness: one journal entry per user per day
    unique("journal_entry_unique_user_date").on(t.user_id, t.date),
    index("journal_entry_user_id_date_desc_index").on(t.user_id, t.date.desc()),
  ],
);

export const JournalEntryRelations = relations(JournalEntry, ({ many }) => ({
  block_nodes: many(BlockNode),
  block_edges: many(BlockEdge),
}));

export type JournalEntry = typeof JournalEntry.$inferSelect;

export const zJournalEntry = createSelectSchema(JournalEntry);

export const zJournalEntryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("The date of the journal entry in YYYY-MM-DD format.");
