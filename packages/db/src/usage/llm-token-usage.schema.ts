import {
	decimal,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { ModelPrices } from "./model-prices.schema.js";

export const LLMTokenUsage = pgTable("llm_token_usage", (t) => ({
	id: t.uuid().notNull().primaryKey().defaultRandom(),
	created_at: timestamp().defaultNow(),
	updated_at: timestamp()
		.defaultNow()
		.$onUpdateFn(() => new Date()),

	// Usage data
	input_tokens: integer().notNull(),
	output_tokens: integer().notNull(),
	total_tokens: integer().notNull(), // input + output for convenience
	user_id: text().notNull(),

	// Reference to model pricing
	model_price_id: t
		.uuid()
		.notNull()
		.references(() => ModelPrices.id),

	total_cost: decimal({ precision: 10, scale: 6 }).notNull(), // cents

	// Context metadata
	metadata: jsonb(), // { conversation_id?: string, tool_calls?: string[], request_type: "chat" | "tool_search" }
}));

export type LLMTokenUsage = typeof LLMTokenUsage.$inferSelect;
export type InsertLLMTokenUsage = typeof LLMTokenUsage.$inferInsert;
