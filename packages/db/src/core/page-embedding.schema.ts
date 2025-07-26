import { sql } from "drizzle-orm";
import { index, pgTable, text, unique, vector } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";
import { Page } from "./page.schema.js";

export const PageEmbedding = pgTable(
	"page_embedding",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		page_id: t
			.uuid()
			.notNull()
			.references(() => Page.id, { onDelete: "cascade" }),
		user_id: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Chunk information for managing large page content
		chunk_index: t.integer().notNull(), // 0-based index of the chunk within the page
		chunk_text: t.text().notNull(), // The actual text content of this chunk
		// Metadata about the chunk stored as JSONB
		metadata: t.jsonb().notNull(), // Contains block_ids, chunk_size, etc.
		// Hash of the entire page's text content for change detection
		page_text_hash: t.text().notNull(),
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
		// Ensure unique chunk indices per page
		unique("unique_page_embedding_chunk").on(table.page_id, table.chunk_index),

		// Prevent duplicate embeddings for identical page content
		unique("unique_page_embedding_text_hash").on(
			table.user_id,
			table.page_text_hash,
			table.chunk_index,
		),

		// Indexes for efficient page-based searches
		index("page_embedding_page_idx").on(table.page_id),
		index("page_embedding_user_idx").on(table.user_id),
		index("page_embedding_user_page_idx").on(table.user_id, table.page_id),
		index("page_embedding_text_hash_idx").on(table.page_text_hash),

		// GIN index for JSONB metadata queries
		index("page_embedding_metadata_gin_idx").using("gin", table.metadata),

		// HNSW index for similarity search
		index("hnsw_page_embedding_index").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),

		// Filtered HNSW index for user-specific similarity search
		index("hnsw_page_embedding_user_index")
			.using("hnsw", table.embedding.op("vector_cosine_ops"))
			.where(sql`user_id IS NOT NULL`),
	],
);

export type PageEmbedding = typeof PageEmbedding.$inferSelect;

export const zPageEmbedding = createSelectSchema(PageEmbedding);
