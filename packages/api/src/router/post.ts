import { desc, eq } from "@acme/db";
import { CreatePostSchema, Post } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure, publicProcedure } from "../trpc";

export const postRouter = {
	all: publicProcedure.query(async ({ ctx }) => {
		try {
			return await ctx.db.query.Post.findMany({
				limit: 10,
				orderBy: desc(Post.id),
			});
		} catch (error) {
			console.error("Database error in post.all:", error);
			// Return empty array when database is not available
			return [];
		}
	}),

	byId: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			try {
				return await ctx.db.query.Post.findFirst({
					where: eq(Post.id, input.id),
				});
			} catch (error) {
				console.error("Database error in post.byId:", error);
				// Return null when database is not available
				return null;
			}
		}),

	create: protectedProcedure
		.input(CreatePostSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.db.insert(Post).values(input);
			} catch (error) {
				console.error("Database error in post.create:", error);
				throw new Error("Failed to create post. Please try again later.");
			}
		}),

	delete: protectedProcedure
		.input(z.string())
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.db.delete(Post).where(eq(Post.id, input));
			} catch (error) {
				console.error("Database error in post.delete:", error);
				throw new Error("Failed to delete post. Please try again later.");
			}
		}),
} satisfies TRPCRouterRecord;
