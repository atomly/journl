import { eq } from "@acme/db";
import { DocumentEmbeddingTask, zDocumentEmbeddingTask } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../trpc.js";

export const documentEmbeddingTaskRouter = {
  updateStatus: publicProcedure
    .input(zDocumentEmbeddingTask.pick({ id: true, status: true }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(DocumentEmbeddingTask)
        .set({
          status: input.status,
        })
        .where(eq(DocumentEmbeddingTask.id, input.id));
    }),
} satisfies TRPCRouterRecord;
