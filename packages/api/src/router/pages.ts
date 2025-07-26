import { and, desc, eq, inArray } from "@acme/db";
import { Block, Page, zInsertPage, zUpdatePage } from "@acme/db/schema";
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

				return page[0] ?? null;
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
		.input(zInsertPage.omit({ user_id: true }))
		.mutation(async ({ ctx, input }) => {
			try {
				const pageData = {
					...input,
					children: input.children ?? [],
					user_id: ctx.session.user.id,
				};

				const result = await ctx.db.insert(Page).values(pageData).returning();

				if (!result[0]) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create page",
					});
				}

				return result[0];
			} catch (error) {
				console.error("Database error in pages.create:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create page",
				});
			}
		}),

	// Delete a page and all its child blocks (cascade delete)
	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.db.transaction(async (tx) => {
					// 1. First, get the page to ensure it exists and belongs to the user
					const [pageToDelete] = await tx
						.select()
						.from(Page)
						.where(
							and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
						)
						.limit(1);

					if (!pageToDelete) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Page not found",
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

					// 3. Get all direct child blocks of the page
					const pageChildren = (pageToDelete.children as string[]) || [];
					const allChildBlockIds: string[] = [];

					// Collect all nested child block IDs
					for (const childId of pageChildren) {
						allChildBlockIds.push(childId);
						const nestedChildIds = await collectChildIds(childId);
						allChildBlockIds.push(...nestedChildIds);
					}

					// 4. Delete all child blocks first
					if (allChildBlockIds.length > 0) {
						await tx.delete(Block).where(inArray(Block.id, allChildBlockIds));
					}

					// 5. Finally, delete the page
					const result = await tx
						.delete(Page)
						.where(
							and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
						)
						.returning();

					if (!result[0]) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Page not found or already deleted",
						});
					}

					return {
						deletedBlocksCount: allChildBlockIds.length,
						deletedPage: result[0],
					};
				});
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

	// Update embed timestamp to trigger embedding generation
	updateEmbedTimestamp: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.db
					.update(Page)
					.set({ embed_updated_at: new Date().toISOString() })
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
				console.error("Database error in pages.updateEmbedTimestamp:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update page embed timestamp",
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
