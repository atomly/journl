import { sql } from "drizzle-orm";
import { index, pgTable, text, unique, vector } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";
import { JournalEntry } from "./journal-entry.schema.js";

export const JournalEmbedding = pgTable(
  "journal_embedding",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    journal_entry_id: t
      .uuid()
      .notNull()
      .references(() => JournalEntry.id, { onDelete: "cascade" }),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: t.date({ mode: "string" }).notNull(),
    // Chunk information for managing large page content
    chunk_text: t.text().notNull(), // The actual text content of this chunk
    // The actual embedding vector for this chunk
    embedding: vector({ dimensions: 1536 }).notNull(),
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
  (table) => [
    // Enforce uniqueness: one embedding per journal entry
    unique("unique_journal_embedding_entry").on(table.journal_entry_id),
    // Also maintain uniqueness per user per date for additional constraint
    unique("unique_journal_embedding_user_date").on(table.user_id, table.date),
    // HNSW index for efficient similarity search
    index("hnsw_journal_embedding_index").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type JournalEmbedding = typeof JournalEmbedding.$inferSelect;

export const zJournalEmbedding = createSelectSchema(JournalEmbedding);
