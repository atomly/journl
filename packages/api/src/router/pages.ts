import { and, desc, eq } from "@acme/db";
import { Page, zInsertPage, zUpdatePage } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

export const pagesRouter = {
	// Get all pages for the authenticated user
	all: protectedProcedure.query(async ({ ctx }) => {
		try {
			return await ctx.db
				.select()
				.from(Page)
				.where(eq(Page.user_id, ctx.session.user.id))
				.orderBy(desc(Page.updated_at));
		} catch (error) {
			console.error("Database error in pages.all:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch pages",
			});
		}
	}),

	// Get a single page by ID
	byId: protectedProcedure
		.input(z.object({ id: z.uuid() }))
		.query(async ({ ctx, input }) => {
			try {
				const page = await ctx.db
					.select()
					.from(Page)
					.where(
						and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
					)
					.limit(1);

				if (page.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Page not found",
					});
				}

				return page[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in pages.byId:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch page",
				});
			}
		}),

	// Create a new page
	create: protectedProcedure
		.input(zInsertPage)
		.mutation(async ({ ctx, input }) => {
			try {
				const pageData = {
					...input,
					content: input.content ?? "",
					userId: ctx.session.user.id,
				};

				const result = await ctx.db.insert(Page).values(pageData).returning();

				return result[0];
			} catch (error) {
				console.error("Database error in pages.create:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create page",
				});
			}
		}),

	// Delete a page
	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.delete(Page)
					.where(
						and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
					)
					.returning();

				if (result.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Page not found",
					});
				}

				return result[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in pages.delete:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete page",
				});
			}
		}),

	// Update an existing page
	update: protectedProcedure
		.input(
			z.object({
				data: zUpdatePage,
				id: z.uuid(),
				title: z.string().min(1).max(255).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const { id, ...updateData } = input;

				// Only update fields that are provided
				const fieldsToUpdate = Object.fromEntries(
					Object.entries(updateData).filter(
						([_, value]) => value !== undefined,
					),
				);

				if (Object.keys(fieldsToUpdate).length === 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "No fields to update",
					});
				}

				const result = await ctx.db
					.update(Page)
					.set(fieldsToUpdate)
					.where(and(eq(Page.id, id), eq(Page.user_id, ctx.session.user.id)))
					.returning();

				if (result.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Page not found",
					});
				}

				return result[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in pages.update:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update page",
				});
			}
		}),

	updateContent: protectedProcedure
		.input(
			z.object({
				content: z.string().min(0).max(50000),
				id: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.update(Page)
					.set({ content: input.content })
					.where(
						and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
					)
					.returning();

				if (result.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Page not found",
					});
				}

				return result[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in pages.updateContent:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update page content",
				});
			}
		}),

	updateTitle: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				title: z.string().min(1).max(255),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.update(Page)
					.set({ title: input.title })
					.where(
						and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
					)
					.returning();

				if (result.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Page not found",
					});
				}

				return result[0];
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error("Database error in pages.updateTitle:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update page title",
				});
			}
		}),
} satisfies TRPCRouterRecord;
