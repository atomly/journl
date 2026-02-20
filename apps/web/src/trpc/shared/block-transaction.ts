import { and, eq, sql } from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  Document,
  zInsertBlockEdge,
  zInsertBlockNode,
} from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { startDocumentEmbedding } from "~/workflows/document-embedding";
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

  // ! TODO: Avoid triggering embedding workflow for non-semantic document edits.
  const [document] = await ctx.db
    .update(Document)
    .set({
      updated_at: sql`now()`,
    })
    .where(
      and(
        eq(Document.id, input.document_id),
        eq(Document.user_id, ctx.session.user.id),
      ),
    )
    .returning({
      id: Document.id,
      updatedAt: Document.updated_at,
    });

  if (!document) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document not found",
    });
  }

  try {
    await startDocumentEmbedding({
      documentId: document.id,
      documentUpdatedAt: document.updatedAt,
      userId: ctx.session.user.id,
    });
  } catch (error) {
    console.error("Failed to start document embedding workflow", {
      documentId: document.id,
      error,
    });
  }

  return document;
}
