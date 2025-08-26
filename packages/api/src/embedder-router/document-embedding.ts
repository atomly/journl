import { eq } from "@acme/db";
import {
  DocumentEmbedding,
  DocumentEmbeddingTask,
  zInsertDocumentEmbedding,
} from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import z from "zod/v4";
import { publicProcedure } from "../trpc.js";

export const documentEmbeddingRouter = {
  embedDocument: publicProcedure
    .input(
      z.object({
        document_id: z.string(),
        embeddings: z.array(zInsertDocumentEmbedding),
        task_id: z.string(),
        user_id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await tx
            .delete(DocumentEmbedding)
            .where(eq(DocumentEmbedding.document_id, input.document_id));

          await tx.insert(DocumentEmbedding).values(input.embeddings);

          await tx
            .update(DocumentEmbeddingTask)
            .set({
              status: "completed",
            })
            .where(eq(DocumentEmbeddingTask.id, input.task_id));
        });
      } catch (error) {
        console.error("Error embedding document 👀", error);

        await ctx.db
          .update(DocumentEmbeddingTask)
          .set({
            status: "failed",
          })
          .where(eq(DocumentEmbeddingTask.id, input.task_id));
      }
    }),
} satisfies TRPCRouterRecord;
