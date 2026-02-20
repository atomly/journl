import { eq } from "@acme/db";
import { DocumentEmbedding, zInsertDocumentEmbedding } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import z from "zod/v4";
import { publicProcedure } from "../trpc.js";

export const documentEmbeddingRouter = {
  embedDocument: publicProcedure
    .input(
      z.object({
        document_id: z.string(),
        embeddings: z.array(zInsertDocumentEmbedding).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await tx
            .delete(DocumentEmbedding)
            .where(eq(DocumentEmbedding.document_id, input.document_id));

          await tx.insert(DocumentEmbedding).values(input.embeddings);
        });
      } catch (error) {
        console.error("Error embedding document 👀", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to embed document",
        });
      }
    }),
} satisfies TRPCRouterRecord;
