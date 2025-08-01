import {
	and,
	between,
	cosineDistance,
	desc,
	eq,
	gt,
	inArray,
	sql,
} from "@acme/db";
import { Block, JournalEmbedding, JournalEntry } from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod";
import { protectedProcedure } from "../trpc.js";

type PlaceholderEntry = {
	date: string;
};

export const journalRouter = {
	// Delete a journal entry and all its child blocks (cascade delete)
	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.db.transaction(async (tx) => {
					// 1. First, get the journal entry to ensure it exists and belongs to the user
					const [journalToDelete] = await tx
						.select()
						.from(JournalEntry)
						.where(
							and(
								eq(JournalEntry.id, input.id),
								eq(JournalEntry.user_id, ctx.session.user.id),
							),
						)
						.limit(1);

					if (!journalToDelete) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Journal entry not found",
						});
					}

					// 2. Recursively collect all child block IDs
					const collectChildIds = async (
						blockId: string,
					): Promise<string[]> => {
						const [block] = await tx
							.select({ children: Block.children })
							.from(Block)
							.where(eq(Block.id, blockId))
							.limit(1);

						if (!block) return [];

						const childIds = (block.children as string[]) || [];
						const allChildIds = [...childIds];

						// Recursively collect children of children
						for (const childId of childIds) {
							const grandChildIds = await collectChildIds(childId);
							allChildIds.push(...grandChildIds);
						}

						return allChildIds;
					};

					// 3. Get all blocks that belong to this journal entry
					const journalBlocks = await tx
						.select({ id: Block.id })
						.from(Block)
						.where(
							and(
								eq(Block.parent_type, "journal_entry"),
								eq(Block.parent_id, input.id),
							),
						);

					const allChildBlockIds: string[] = [];

					// Collect all nested child block IDs
					for (const block of journalBlocks) {
						allChildBlockIds.push(block.id);
						const nestedChildIds = await collectChildIds(block.id);
						allChildBlockIds.push(...nestedChildIds);
					}

					// 4. Delete all child blocks first
					if (allChildBlockIds.length > 0) {
						await tx.delete(Block).where(inArray(Block.id, allChildBlockIds));
					}

					// 5. Finally, delete the journal entry
					const result = await tx
						.delete(JournalEntry)
						.where(
							and(
								eq(JournalEntry.id, input.id),
								eq(JournalEntry.user_id, ctx.session.user.id),
							),
						)
						.returning();

					return {
						deletedBlocksCount: allChildBlockIds.length,
						deletedJournalEntry: result[0],
					};
				});
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in journal.delete:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete journal entry",
				});
			}
		}),

	getBetween: protectedProcedure
		.input(
			z.object({
				from: z
					.string()
					.describe("The start date of the search in ISO 8601 format"),
				to: z
					.string()
					.describe("The end date of the search in ISO 8601 format"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const entries = await ctx.db
				.select()
				.from(JournalEntry)
				.where(
					and(
						eq(JournalEntry.user_id, ctx.session.user.id),
						between(JournalEntry.date, input.from, input.to),
					),
				);

			return entries;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			try {
				const entry = await ctx.db
					.select()
					.from(JournalEntry)
					.where(
						and(
							eq(JournalEntry.id, input.id),
							eq(JournalEntry.user_id, ctx.session.user.id),
						),
					)
					.limit(1);

				if (entry.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Journal entry not found",
					});
				}

				return entry[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in journal.byId:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch journal entry",
				});
			}
		}),

	getRelevantEntries: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(20).default(5),
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

				const similarity = sql<number>`1 - (${cosineDistance(JournalEmbedding.embedding, embedding)})`;

				const results = await ctx.db
					.select({
						content: JournalEntry.content,
						date: JournalEntry.date,
						id: JournalEntry.id,
						similarity,
					})
					.from(JournalEmbedding)
					.where(
						and(
							eq(JournalEntry.user_id, ctx.session.user.id),
							gt(similarity, input.threshold),
						),
					)
					.innerJoin(
						JournalEntry,
						eq(JournalEmbedding.journal_entry_id, JournalEntry.id),
					)
					.orderBy(desc(similarity))
					.limit(input.limit);

				return results;
			} catch (error) {
				console.error("Database error in journal.getRelevantEntries:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch similar journal entries",
				});
			}
		}),

	getTimeline: protectedProcedure
		.input(
			z.object({
				cursor: z
					.number()
					.default(0)
					.describe("The cursor to start the search from, 0 is today"),
				limit: z
					.number()
					.min(1)
					.max(30)
					.default(7)
					.describe("The number of days to search for, 7 is a week"),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				// Given a limit of 7 days, 1 page will be equivalent to 7 days going backward from today
				const from = new Date(input.cursor);
				const to = new Date(from);
				to.setDate(to.getDate() - (input.limit - 1)); // Subtract (limit - 1) to get exactly 'limit' days
				to.setHours(0, 0, 0, 0); // Start of day

				const actualEntries = await ctx.db
					.select()
					.from(JournalEntry)
					.where(
						and(
							eq(JournalEntry.user_id, ctx.session.user.id),
							between(JournalEntry.date, to.toISOString(), from.toISOString()),
						),
					)
					.orderBy(JournalEntry.date);

				// Create a map of actual entries keyed by date (YYYY-MM-DD format)
				const entriesByDate = new Map();
				actualEntries.forEach((entry) => {
					const dateKey = new Date(entry.date).toISOString().split("T")[0];
					entriesByDate.set(dateKey, entry);
				});

				// Generate all dates in the range and fill missing days with placeholders
				// Start from the newest date and work backwards for descending order
				const allEntries: (PlaceholderEntry | JournalEntry)[] = [];
				const currentDate = new Date(from);
				const endDate = new Date(to);

				while (currentDate >= endDate) {
					const dateKey = currentDate.toISOString().split("T")[0];

					if (!dateKey) continue;

					if (entriesByDate.has(dateKey)) {
						// Use actual entry
						allEntries.push(entriesByDate.get(dateKey));
					} else {
						// Create placeholder entry
						allEntries.push({
							date: dateKey,
						});
					}

					// Move to previous day
					currentDate.setDate(currentDate.getDate() - 1);
				}

				// Calculate next page cursor: continue from where this page ends
				// If current page is July 8th to July 2nd, next page should start July 1st
				const nextPageDate = new Date(from);
				nextPageDate.setDate(nextPageDate.getDate() - input.limit);

				return {
					entries: allEntries,
					nextPage: nextPageDate.getTime(),
				};
			} catch (error) {
				console.error("Database error in journal.byPage:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch journal entries",
				});
			}
		}),

	write: protectedProcedure
		.input(
			z.object({
				content: z.string().max(10000),
				date: z.date(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.insert(JournalEntry)
					.values({
						content: input.content,
						date: input.date.toISOString(),
						user_id: ctx.session.user.id,
					})
					.onConflictDoUpdate({
						set: {
							content: input.content,
						},
						target: [JournalEntry.user_id, JournalEntry.date],
					})
					.returning();

				if (result.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Journal entry not found",
					});
				}

				return result[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in journal.write:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update journal entry",
				});
			}
		}),
} satisfies TRPCRouterRecord;
