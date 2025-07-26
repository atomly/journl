import { sql } from "drizzle-orm";
import { index, pgTable, text, unique, vector } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";
import { Block } from "./block.schema.js";

export const BlockEmbedding = pgTable(
	"block_embedding",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		block_id: t
			.uuid()
			.notNull()
			.references(() => Block.id, { onDelete: "cascade" }),
		user_id: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Parent context for scoped searches
		parent_type: t.text().notNull(), // 'page' | 'journal_entry' | 'block'
		parent_id: t.uuid().notNull(),
		// Hash of the text content for change detection
		text_hash: t.text().notNull(),
		// The actual embedding vector for the text content
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
		// Primary uniqueness: one embedding per block
		unique("unique_block_embedding_block").on(table.block_id),

		// Prevent duplicate embeddings for identical text content
		unique("unique_block_embedding_text_hash").on(
			table.user_id,
			table.text_hash,
		),

		// Indexes for efficient scoped searches
		index("block_embedding_parent_idx").on(table.parent_type, table.parent_id),
		index("block_embedding_user_parent_idx").on(
			table.user_id,
			table.parent_type,
			table.parent_id,
		),
		index("block_embedding_text_hash_idx").on(table.text_hash),

		// HNSW index for general similarity search
		index("hnsw_block_embedding_index").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),

		// Filtered HNSW indexes for scoped similarity search
		index("hnsw_block_embedding_page_index")
			.using("hnsw", table.embedding.op("vector_cosine_ops"))
			.where(sql`parent_type = 'page'`),

		index("hnsw_block_embedding_journal_index")
			.using("hnsw", table.embedding.op("vector_cosine_ops"))
			.where(sql`parent_type = 'journal_entry'`),
	],
);

export type BlockEmbedding = typeof BlockEmbedding.$inferSelect;

export const zBlockEmbedding = createSelectSchema(BlockEmbedding);
