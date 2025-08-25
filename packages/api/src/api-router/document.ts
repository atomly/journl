import { and, eq } from "@acme/db";
import { Document, zDocument } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../trpc.js";

export const documentRouter = {
  delete: protectedProcedure
    .input(zDocument.pick({ id: true }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db
        .delete(Document)
        .where(
          and(
            eq(Document.id, input.id),
            eq(Document.user_id, ctx.session.user.id),
          ),
        )
        .returning();
    }),
} satisfies TRPCRouterRecord;
