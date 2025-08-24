import { sql } from "@acme/db";
import {
  EmbeddingTokenUsage,
  JournalEmbedding,
  LLMTokenUsage,
  ModelPrices,
} from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { protectedProcedure, publicProcedure } from "../trpc.js";

export const aiRouter = {
  createJournalEmbedding: publicProcedure
    .input(
      z.object({
        content: z.string(),
        date: z.string(),
        journalEntryId: z.string().uuid(),
        model: z.string(),
        provider: z.string(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { embedding, usage } = await embed({
          maxRetries: 5,
          model: openai.embedding("text-embedding-3-small"),
          value: input.content,
        });

        return await ctx.db.transaction(async (tx) => {
          // Store token usage with automatic pricing calculation
          await tx.insert(EmbeddingTokenUsage).values({
            metadata: {
              content_id: input.journalEntryId,
              content_type: "journal_entry",
            },
            model_price_id: sql`(
                SELECT id FROM ${ModelPrices} 
                WHERE provider = ${input.provider}
                AND model = ${input.model}
                AND model_type = 'embedding'
                AND is_active = 'true'
                LIMIT 1
              )`,
            token_count: usage.tokens,
            total_cost: sql`(
                SELECT (${usage.tokens} * embedding_price_per_1m_tokens / 1000000.0)::decimal(10,6)
                FROM ${ModelPrices} 
                WHERE provider = ${input.provider}
                AND model = ${input.model}
                AND model_type = 'embedding'
                AND is_active = 'true'
                LIMIT 1
              )`,
            user_id: input.userId,
          });

          // Store the embedding
          const [journalEmbedding] = await tx
            .insert(JournalEmbedding)
            .values({
              chunk_text: input.content,
              date: input.date,
              embedding,
              journal_entry_id: input.journalEntryId,
              user_id: input.userId,
            })
            .onConflictDoUpdate({
              set: {
                chunk_text: input.content,
                embedding,
              },
              target: [JournalEmbedding.journal_entry_id],
            })
            .returning();

          return journalEmbedding;
        });
      } catch (error) {
        console.error("Error creating journal embedding:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journal embedding",
        });
      }
    }),
  // Procedure for tracking LLM token usage
  trackLLMUsage: protectedProcedure
    .input(
      z.object({
        inputTokens: z.number(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        model: z.string(),
        outputTokens: z.number(),
        provider: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const totalTokens = input.inputTokens + input.outputTokens;

          return await tx
            .insert(LLMTokenUsage)
            .values({
              input_tokens: input.inputTokens,
              metadata: input.metadata,
              model_price_id: sql`(
                SELECT id FROM ${ModelPrices} 
                WHERE provider = ${input.provider}
                AND model = ${input.model}
                AND model_type = 'llm'
                AND is_active = 'true'
                LIMIT 1
              )`,
              output_tokens: input.outputTokens,
              total_cost: sql`(
                SELECT (
                  (${input.inputTokens} * input_price_per_1m_tokens / 1000000.0) + 
                  (${input.outputTokens} * output_price_per_1m_tokens / 1000000.0)
                )::decimal(10,6)
                FROM ${ModelPrices} 
                WHERE provider = ${input.provider}
                AND model = ${input.model}
                AND model_type = 'llm'
                AND is_active = 'true'
                LIMIT 1
              )`,
              total_tokens: totalTokens,
              user_id: ctx.session.user.id,
            })
            .returning();
        });
      } catch (error) {
        console.error("Error tracking LLM usage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to track LLM usage",
        });
      }
    }),
} satisfies TRPCRouterRecord;
