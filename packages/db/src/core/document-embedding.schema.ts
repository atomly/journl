import { sql } from "drizzle-orm";
import { check, index, pgTable, text, vector } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";
import { JSONB_LIMITS } from "../constants/resource-limits.js";
import { Document } from "./document.schema.js";

const VECTOR_DIMENSIONS = 1536;

export const DocumentEmbedding = pgTable(
  "document_embedding",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document_id: t
      .uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    vector: vector({ dimensions: VECTOR_DIMENSIONS }).notNull(),
    chunk_id: t.integer().notNull(),
    chunk_markdown_text: text("chunk_markdown_text").notNull(),
    chunk_raw_text: text("chunk_raw_text").notNull(),
    metadata: t.jsonb().notNull().$type<{
      sectionSummary: string;
      excerptKeywords: string;
      documentTitle: string;
    }>(),
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
    // HNSW index for efficient similarity search
    index("document_embedding_hnsw_index").using(
      "hnsw",
      t.vector.op("vector_cosine_ops"),
    ),
    // Resource protection constraints
    check(
      "chunk_markdown_text_length",
      sql`length(${t.chunk_markdown_text}) <= ${JSONB_LIMITS.CHUNK_TEXT}`,
    ),
    check(
      "chunk_raw_text_length",
      sql`length(${t.chunk_raw_text}) <= ${JSONB_LIMITS.CHUNK_TEXT}`,
    ),
  ],
);

export type DocumentEmbedding = typeof DocumentEmbedding.$inferSelect;

export const zInsertDocumentEmbedding = createInsertSchema(
  DocumentEmbedding,
).pick({
  user_id: true,
  document_id: true,
  vector: true,
  chunk_id: true,
  chunk_markdown_text: true,
  chunk_raw_text: true,
  metadata: true,
});

export const zDocumentEmbedding = createSelectSchema(DocumentEmbedding);
