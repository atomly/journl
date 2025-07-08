import { and, between, eq } from "@acme/db";
import { JournalEntry } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

type PlaceholderEntry = {
	date: string;
};

export const journalRouter = {
	delete: protectedProcedure
		.input(z.object({ id: z.uuid() }))
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.delete(JournalEntry)
					.where(
						and(
							eq(JournalEntry.id, input.id),
							eq(JournalEntry.userId, ctx.session.user.id),
						),
					)
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
				cursor: z.number().default(0),
				limit: z.number().default(7),
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
							eq(JournalEntry.userId, ctx.session.user.id),
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

	getById: protectedProcedure
		.input(z.object({ id: z.uuid() }))
		.query(async ({ ctx, input }) => {
			try {
				const entry = await ctx.db
					.select()
					.from(JournalEntry)
					.where(
						and(
							eq(JournalEntry.id, input.id),
							eq(JournalEntry.userId, ctx.session.user.id),
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
						userId: ctx.session.user.id,
					})
					.onConflictDoUpdate({
						set: {
							content: input.content,
						},
						target: [JournalEntry.userId, JournalEntry.date],
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
