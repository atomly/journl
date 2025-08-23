import {
	decimal,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { ModelPrices } from "./model-prices.schema.js";

export const EmbeddingTokenUsage = pgTable("embedding_token_usage", (t) => ({
	id: t.uuid().notNull().primaryKey().defaultRandom(),
	created_at: timestamp().defaultNow(),
	updated_at: timestamp()
		.defaultNow()
		.$onUpdateFn(() => new Date()),

	// Usage data
	token_count: integer().notNull(),
	user_id: text().notNull(),

	// Reference to model pricing
	model_price_id: t
		.uuid()
		.notNull()
		.references(() => ModelPrices.id),

	total_cost: decimal({ precision: 10, scale: 6 }).notNull(), // cents

	// Context metadata
	metadata: jsonb(), // { content_type: "journal_entry" | "page_chunk", content_id: string, chunk_index?: number }
}));

export type EmbeddingTokenUsage = typeof EmbeddingTokenUsage.$inferSelect;
export type InsertEmbeddingTokenUsage = typeof EmbeddingTokenUsage.$inferInsert;
