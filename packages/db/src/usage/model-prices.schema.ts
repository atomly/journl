import {
	decimal,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const modelTypeEnum = pgEnum("model_type", ["llm", "embedding"]);

export const ModelPrices = pgTable(
	"model_prices",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		created_at: timestamp().defaultNow(),
		updated_at: timestamp()
			.defaultNow()
			.$onUpdateFn(() => new Date()),

		// Model identification
		provider: text().notNull(),
		model: text().notNull(), // e.g., "gpt-4o-mini", "text-embedding-3-small"
		model_type: modelTypeEnum().notNull(),

		// Pricing (in cents per 1M tokens)
		input_price_per_1m_tokens: decimal({ precision: 10, scale: 6 }), // For LLM models
		output_price_per_1m_tokens: decimal({ precision: 10, scale: 6 }), // For LLM models
		embedding_price_per_1m_tokens: decimal({ precision: 10, scale: 6 }), // For embedding models

		// Metadata
		is_active: text().default("true").notNull(), // "true" or "false" as text
		description: text(), // Optional description of the model
	}),
	(t) => ({
		// Ensure unique provider + model combination
		providerModelIdx: uniqueIndex("provider_model_idx").on(t.provider, t.model),
	}),
);

export type ModelPrices = typeof ModelPrices.$inferSelect;
export type InsertModelPrices = typeof ModelPrices.$inferInsert;
