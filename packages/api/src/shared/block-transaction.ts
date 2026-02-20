import { and, eq, sql } from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  DocumentEmbeddingTask,
  zInsertBlockEdge,
  zInsertBlockNode,
} from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import type { TRPCContext } from "../trpc";

export const zBlockTransactions = z.object({
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
});

/**
 * Saves a list of block transactions to the database.
 * @param driver - The database driver to use.
 * @param userId - The user ID to use.
 * @param input - The input to save.
 */
export async function saveTransactions(
  ctx: TRPCContext,
  input: z.infer<typeof zBlockTransactions>,
) {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  for (const change of input.transactions) {
    if (change.type === "edge_remove") {
      await ctx.db
        .delete(BlockEdge)
        .where(
          and(
            eq(BlockEdge.from_id, change.args.from_id),
            eq(BlockEdge.to_id, change.args.to_id),
          ),
        );
    }

    if (change.type === "block_remove") {
      await ctx.db
        .delete(BlockNode)
        .where(
          and(
            eq(BlockNode.user_id, ctx.session.user.id),
            eq(BlockNode.id, change.args.id),
          ),
        );
    }

    if (change.type === "block_upsert") {
      await ctx.db
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
      await ctx.db.insert(BlockEdge).values({
        document_id: input.document_id,
        from_id: change.args.from_id,
        to_id: change.args.to_id,
        type: change.args.type,
        user_id: ctx.session.user.id,
      });
    }
  }

  // ! TODO: Optimize the way we are creating the document embedding task.
  // ! There are some changes we could potentially avoid triggering the document embedding task.
  const [task] = await ctx.db
    .insert(DocumentEmbeddingTask)
    .values({
      document_id: input.document_id,
      user_id: ctx.session.user.id,
    })
    .onConflictDoUpdate({
      set: {
        status: "debounced",
      },
      target: [DocumentEmbeddingTask.document_id],
      targetWhere: sql`${DocumentEmbeddingTask.status} != 'completed'`,
    })
    .returning({
      id: DocumentEmbeddingTask.id,
      updatedAt: DocumentEmbeddingTask.updated_at,
    });

  if (!task) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create document embedding task",
    });
  }

  if (ctx.startDocumentEmbeddingTaskWorkflow) {
    try {
      await ctx.startDocumentEmbeddingTaskWorkflow({
        taskId: task.id,
        taskUpdatedAt: task.updatedAt,
      });
    } catch (error) {
      console.error("Failed to start document embedding workflow", {
        error,
        taskId: task.id,
      });
    }
  }

  return task;
}
