import { and, eq } from "@acme/db";
import { Document, DocumentReference, zDocument } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../trpc";

export const documentRouter = {
  delete: protectedProcedure
    .input(zDocument.pick({ id: true }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ id: Document.id })
          .from(Document)
          .where(
            and(
              eq(Document.id, input.id),
              eq(Document.user_id, ctx.session.user.id),
            ),
          )
          .for("update");
        if (!owned) return [];

        await tx
          .delete(DocumentReference)
          .where(
            and(
              eq(DocumentReference.user_id, ctx.session.user.id),
              eq(DocumentReference.target_document_id, input.id),
              eq(DocumentReference.target_identity, "route"),
            ),
          );
        return await tx
          .delete(Document)
          .where(
            and(
              eq(Document.id, input.id),
              eq(Document.user_id, ctx.session.user.id),
            ),
          )
          .returning();
      });
    }),
} satisfies TRPCRouterRecord;
