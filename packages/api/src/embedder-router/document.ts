import { sql } from "@acme/db";
import { BlockEdge, BlockNode, Document } from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import z from "zod/v4";
import { blockNoteTree } from "../shared/block-note-tree.js";
import { publicProcedure } from "../trpc.js";

export const documentRouter = {
  getById: publicProcedure
    .input(z.object({ id: z.uuid(), user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const {
          rows: [document],
        } = await ctx.db.execute<
          Document & {
            blocks: BlockNode[];
            edges: BlockEdge[];
          }
        >(sql`
          WITH document AS (
            SELECT * FROM ${Document}
            WHERE ${Document.id} = ${input.id} AND ${Document.user_id} = ${input.user_id}
            LIMIT 1
          )
          SELECT
            document.*,
            COALESCE(
                (SELECT json_agg(${BlockNode}.*) FROM ${BlockNode} WHERE ${BlockNode.document_id} = document.id),
                '[]'::json
            ) as blocks,
            COALESCE(
                (SELECT json_agg(${BlockEdge}.*) FROM ${BlockEdge} WHERE ${BlockEdge.document_id} = document.id),
                '[]'::json
            ) as edges
          FROM document
      `);

        if (!document) {
          return null;
        }

        return {
          ...document,
          tree: blockNoteTree(document.blocks, document.edges),
        };
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
} satisfies TRPCRouterRecord;
