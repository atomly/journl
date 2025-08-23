import { sql } from "drizzle-orm";
import type { DbTransaction } from "../client.js";
import { EmbeddingTokenUsage, LLMTokenUsage, ModelPrices } from "../schema.js";

/**
 * Insert embedding token usage with automatic pricing calculation
 */
export async function insertEmbeddingTokenUsage(
	db: DbTransaction,
	params: {
		provider: string;
		model: string;
		tokenCount: number;
		userId: string;
		metadata?: Record<string, unknown>;
	},
) {
	const { provider, model, tokenCount, userId, metadata } = params;

	return await db
		.insert(EmbeddingTokenUsage)
		.values({
			metadata,
			model_price_id: sql`(
				SELECT id FROM ${ModelPrices} 
				WHERE provider = ${provider} 
				AND model = ${model} 
				AND model_type = 'embedding'
				AND is_active = 'true'
				LIMIT 1
			)`,
			token_count: tokenCount,
			total_cost: sql`(
				SELECT (${tokenCount} * embedding_price_per_1m_tokens / 1000000.0)::decimal(10,6)
				FROM ${ModelPrices} 
				WHERE provider = ${provider} 
				AND model = ${model} 
				AND model_type = 'embedding'
				AND is_active = 'true'
				LIMIT 1
			)`,
			user_id: userId,
		})
		.returning();
}

/**
 * Insert LLM token usage with automatic pricing calculation
 */
export async function insertLLMTokenUsage(
	db: DbTransaction,
	params: {
		provider: string;
		model: string;
		inputTokens: number;
		outputTokens: number;
		userId: string;
		metadata?: Record<string, unknown>;
	},
) {
	const { provider, model, inputTokens, outputTokens, userId, metadata } =
		params;
	const totalTokens = inputTokens + outputTokens;

	return await db
		.insert(LLMTokenUsage)
		.values({
			input_tokens: inputTokens,
			metadata,
			model_price_id: sql`(
				SELECT id FROM ${ModelPrices} 
				WHERE provider = ${provider} 
				AND model = ${model} 
				AND model_type = 'llm'
				AND is_active = 'true'
				LIMIT 1
			)`,
			output_tokens: outputTokens,
			total_cost: sql`(
				SELECT (
					(${inputTokens} * input_price_per_1m_tokens / 1000000.0) + 
					(${outputTokens} * output_price_per_1m_tokens / 1000000.0)
				)::decimal(10,6)
				FROM ${ModelPrices} 
				WHERE provider = ${provider} 
				AND model = ${model} 
				AND model_type = 'llm'
				AND is_active = 'true'
				LIMIT 1
			)`,
			total_tokens: totalTokens,
			user_id: userId,
		})
		.returning();
}
