import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "../auth/user.schema.ts";
import { BlockNode } from "./block-node.schema.ts";
import { Document } from "./document.schema.ts";

export const DocumentReference = pgTable(
  "document_reference",
  () => ({
    id: uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source_document_id: uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    source_block_id: uuid().notNull(),
    occurrence_path: varchar({ length: 256 }).notNull(),
    target_kind: text().notNull(),
    target_document_id: uuid(),
    target_block_id: uuid(),
    target_url: varchar({ length: 2048 }),
    target_key: text().notNull(),
    presentation: text().notNull(),
    created_at: timestamp({ mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp({ mode: "string", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  }),
  (t) => [
    foreignKey({
      columns: [t.source_block_id],
      foreignColumns: [BlockNode.id],
    }).onDelete("cascade"),
    check(
      "document_reference_target_kind_check",
      sql`(${t.target_kind} = 'document' AND ${t.target_document_id} IS NOT NULL AND ${t.target_url} IS NULL) OR (${t.target_kind} = 'external' AND ${t.target_document_id} IS NULL AND ${t.target_block_id} IS NULL AND ${t.target_url} IS NOT NULL)`,
    ),
    check(
      "document_reference_presentation_check",
      sql`${t.presentation} IN ('link', 'badge', 'card', 'embed')`,
    ),
    check(
      "document_reference_block_target_check",
      sql`${t.target_block_id} IS NULL OR ${t.target_kind} = 'document'`,
    ),
    uniqueIndex("document_reference_source_path_unique").on(
      t.source_block_id,
      t.occurrence_path,
    ),
    index("document_reference_incoming_index").on(
      t.user_id,
      t.target_document_id,
      t.target_block_id,
      t.source_document_id,
      t.source_block_id,
    ),
    index("document_reference_outgoing_index").on(
      t.user_id,
      t.source_document_id,
      t.source_block_id,
    ),
    index("document_reference_external_index").on(t.user_id, t.target_key),
  ],
);

export const DocumentReferenceRelations = relations(
  DocumentReference,
  ({ one }) => ({
    source_document: one(Document, {
      fields: [DocumentReference.source_document_id],
      references: [Document.id],
    }),
    source_block: one(BlockNode, {
      fields: [DocumentReference.source_block_id],
      references: [BlockNode.id],
    }),
  }),
);

export const BlockSearchText = pgTable(
  "block_search_text",
  () => ({
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    document_id: uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    block_id: uuid()
      .notNull()
      .references(() => BlockNode.id, { onDelete: "cascade" }),
    search_text: text().notNull(),
    updated_at: timestamp({ mode: "string", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  }),
  (t) => [
    index("block_search_text_owner_document_block_index").on(
      t.user_id,
      t.document_id,
      t.block_id,
    ),
    uniqueIndex("block_search_text_block_unique").on(t.block_id),
  ],
);
