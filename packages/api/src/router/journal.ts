import { and, between, eq } from "@acme/db";
import { InsertJournalEntry, JournalEntry } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

export const journalRouter = {
	between: protectedProcedure
		.input(z.object({ end: z.date(), start: z.date() }))
		.query(async ({ ctx, input }) => {
			try {
				return await ctx.db
					.select()
					.from(JournalEntry)
					.where(
						and(
							eq(JournalEntry.userId, ctx.session.user.id),
							between(JournalEntry.createdAt, input.start, input.end),
						),
					)
					.orderBy(JournalEntry.date);
			} catch (error) {
				console.error("Database error in journal.between:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch journal entries",
				});
			}
		}),

	byId: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
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

	create: protectedProcedure
		.input(InsertJournalEntry)
		.mutation(async ({ ctx, input }) => {
			try {
				const entryData = {
					...input,
					userId: ctx.session.user.id,
				};

				const result = await ctx.db
					.insert(JournalEntry)
					.values(entryData)
					.returning();

				return result[0];
			} catch (error) {
				console.error("Database error in journal.create:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create journal entry",
				});
			}
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
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

	write: protectedProcedure
		.input(
			z.object({
				content: z.string().min(1).max(10000),
				id: z.uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.update(JournalEntry)
					.set({ content: input.content })
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
				console.error("Database error in journal.write:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update journal entry",
				});
			}
		}),
} satisfies TRPCRouterRecord;
