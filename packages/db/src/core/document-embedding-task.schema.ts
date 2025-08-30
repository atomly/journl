import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.js";
import { Document } from "./document.schema.js";

export const DocumentEmbeddingTaskStatus = pgEnum(
  "document_embedding_task_status",
  ["debounced", "ready", "completed", "failed"],
);

export const DocumentEmbeddingTask = pgTable(
  "document_embedding_task",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document_id: t
      .uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    status: DocumentEmbeddingTaskStatus().notNull().default("debounced"),
    retries: t.integer().notNull().default(0),
    metadata: t.jsonb().$type<{
      message?: string;
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
    // Unique constraint: only one non-completed task per page
    // This allows multiple completed tasks but prevents multiple active tasks
    uniqueIndex("document_embedding_task_unique_non_completed_task_per_page")
      .on(t.document_id)
      .where(sql`${t.status} != 'completed'`),
  ],
);

export type DocumentEmbeddingTask = typeof DocumentEmbeddingTask.$inferSelect;

export const zInsertDocumentEmbeddingTask = createInsertSchema(
  DocumentEmbeddingTask,
  {
    document_id: z.uuid(),
  },
).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zUpdateDocumentEmbeddingTask = createInsertSchema(
  DocumentEmbeddingTask,
  {
    document_id: z.uuid(),
  },
).omit({
  created_at: true,
  id: true,
  updated_at: true,
  user_id: true,
});

export const zDocumentEmbeddingTask = createSelectSchema(DocumentEmbeddingTask);
