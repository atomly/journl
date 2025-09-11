import { blocknoteBlocks } from "@acme/blocknote/server";
import { eq } from "@acme/db";
import { Document } from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import z from "zod/v4";
import { publicProcedure } from "../trpc.js";

export const documentRouter = {
  getById: publicProcedure
    .input(z.object({ id: z.uuid(), user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const document = await ctx.db.query.Document.findFirst({
          where: eq(Document.id, input.id),
          with: {
            block_edges: true,
            block_nodes: true,
          },
        });

        if (!document) {
          return null;
        }

        return {
          ...document,
          blocks: blocknoteBlocks(document.block_nodes, document.block_edges),
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
