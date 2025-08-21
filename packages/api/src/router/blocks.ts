import { and, eq } from "@acme/db";
import {
	BlockEdge,
	BlockNode,
	zInsertBlockEdge,
	zInsertBlockNode,
} from "@acme/db/schema";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";
export type BlockTransaction =
	(typeof blocksRouter)["saveTransactions"]["_def"]["$types"]["input"]["transactions"][number];

export const blocksRouter = {
	saveTransactions: protectedProcedure
		.input(
			z.object({
				document_id: z.uuid(),
				transactions: z.array(
					z.discriminatedUnion("type", [
						z.object({
							args: zInsertBlockEdge.pick({
								from_id: true,
								to_id: true,
							}),
							type: z.literal("edge_remove"),
						}),
						z.object({
							args: zInsertBlockEdge.omit({
								document_id: true,
								user_id: true,
							}),
							type: z.literal("edge_insert"),
						}),
						z.object({
							args: zInsertBlockNode.omit({
								document_id: true,
								user_id: true,
							}),
							type: z.literal("block_upsert"),
						}),
						z.object({
							args: zInsertBlockNode.pick({ id: true }),
							type: z.literal("block_remove"),
						}),
					]),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				for (const change of input.transactions) {
					if (change.type === "edge_remove") {
						await tx
							.delete(BlockEdge)
							.where(
								and(
									eq(BlockEdge.from_id, change.args.from_id),
									eq(BlockEdge.to_id, change.args.to_id),
								),
							);
					}

					if (change.type === "block_remove") {
						await tx
							.delete(BlockNode)
							.where(
								and(
									eq(BlockNode.user_id, ctx.session.user.id),
									eq(BlockNode.id, change.args.id),
								),
							);
					}

					if (change.type === "block_upsert") {
						await tx
							.insert(BlockNode)
							.values({
								...change.args,
								document_id: input.document_id,
								user_id: ctx.session.user.id,
							})
							.onConflictDoUpdate({
								set: change.args,
								target: BlockNode.id,
							});
					}

					if (change.type === "edge_insert") {
						await tx.insert(BlockEdge).values({
							document_id: input.document_id,
							from_id: change.args.from_id,
							to_id: change.args.to_id,
							type: change.args.type,
							user_id: ctx.session.user.id,
						});
					}
				}
			});
		}),
};
