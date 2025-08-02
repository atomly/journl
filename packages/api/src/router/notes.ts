import { and, cosineDistance, desc, eq, gt, sql } from "@acme/db";
import { JournalEmbedding, Page, PageEmbedding } from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod";
import { protectedProcedure } from "../trpc.js";

// TODO: Implement a Relevance Scorer/ReRanker once Vercel's `ai` package supports it. It's coming in ~v5.2.0.
export const notesRouter = {
	getRelevantNotes: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(20).default(5),
				offset: z.number().min(0).default(0),
				query: z.string().max(10000),
				threshold: z.number().min(0).max(1).default(0.3),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const { embedding } = await embed({
					model: openai.embedding("text-embedding-3-small"),
					value: input.query,
				});

				const journalEmbeddingSimilarity = sql<number>`1 - (${cosineDistance(JournalEmbedding.embedding, embedding)})`;
				const pageEmbeddingSimilarity = sql<number>`1 - (${cosineDistance(PageEmbedding.embedding, embedding)})`;

				const results = await ctx.db
					.select({
						content: JournalEmbedding.chunk_text,
						date: JournalEmbedding.date,
						entry_id: JournalEmbedding.journal_entry_id,
						header: sql<string>`''`,
						id: JournalEmbedding.id,
						similarity: journalEmbeddingSimilarity,
						type: sql<"journal" | "page">`'journal'`,
					})
					.from(JournalEmbedding)
					.where(
						and(
							eq(JournalEmbedding.user_id, ctx.session.user.id),
							gt(journalEmbeddingSimilarity, input.threshold),
						),
					)
					.orderBy(desc(journalEmbeddingSimilarity))
					.limit(input.limit)
					.union(
						ctx.db
							.select({
								content: PageEmbedding.chunk_text,
								date: PageEmbedding.updated_at,
								entry_id: PageEmbedding.page_id,
								header: Page.title,
								id: PageEmbedding.id,
								similarity: pageEmbeddingSimilarity,
								type: sql<"journal" | "page">`'page'`,
							})
							.from(PageEmbedding)
							.where(
								and(
									eq(PageEmbedding.user_id, ctx.session.user.id),
									gt(pageEmbeddingSimilarity, input.threshold),
								),
							)
							.innerJoin(Page, eq(PageEmbedding.page_id, Page.id))
							.orderBy(desc(pageEmbeddingSimilarity))
							.limit(input.limit),
					);

				// Sorting the results of both tables by similarity and header.
				results.sort((a, b) => {
					if (a.similarity === b.similarity) {
						return a.type === "journal" ? -1 : 1;
					}
					return b.similarity - a.similarity;
				});

				return results;
			} catch (error) {
				console.error("Database error in journal.getRelevantEntries:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch similar journal entries",
				});
			}
		}),
} satisfies TRPCRouterRecord;
