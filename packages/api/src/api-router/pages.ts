import { and, cosineDistance, desc, eq, gt, sql } from "@acme/db";
import {
  Document,
  DocumentEmbedding,
  Page,
  zInsertPage,
} from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { blockNoteTree } from "../shared/block-note-tree.js";
import {
  saveTransactions,
  zBlockTransactions,
} from "../shared/block-transaction.js";
import { protectedProcedure } from "../trpc.js";

export const pagesRouter = {
  create: protectedProcedure
    .input(zInsertPage.omit({ document_id: true, user_id: true }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        try {
          const [document] = await tx
            .insert(Document)
            .values({
              user_id: ctx.session.user.id,
            })
            .returning();

          if (!document) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create document",
            });
          }

          const [page] = await tx
            .insert(Page)
            .values({
              ...input,
              children: [],
              document_id: document.id,
              user_id: ctx.session.user.id,
            })
            .returning();

          if (!page) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create page",
            });
          }

          return page;
        } catch (error) {
          console.error("Database error in pages.create:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create page",
          });
        }
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.query.Page.findFirst({
          where: and(
            eq(Page.id, input.id),
            eq(Page.user_id, ctx.session.user.id),
          ),
          with: {
            block_edges: true,
            block_nodes: true,
          },
        });

        if (!result) {
          return null;
        }

        const { block_nodes, block_edges, ...page } = result;

        return {
          ...page,
          document: blockNoteTree(block_nodes, block_edges),
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
  getByUser: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db
        .select()
        .from(Page)
        .where(eq(Page.user_id, ctx.session.user.id))
        .orderBy(desc(Page.updated_at));
    } catch (error) {
      console.error("Database error in pages.all:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch pages",
      });
    }
  }),
  getRelevantPages: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
        query: z.string().max(10000),
        threshold: z.number().min(0).max(1).default(0.3),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { embedding } = await embed({
          // ! TODO: Move this to a shared package called `@acme/ai`.
          model: openai.embedding("text-embedding-3-small"),
          value: input.query,
        });

        const embeddingSimilarity = sql<number>`1 - (${cosineDistance(DocumentEmbedding.vector, embedding)})`;

        const results = await ctx.db
          .selectDistinctOn([DocumentEmbedding.document_id], {
            embedding: DocumentEmbedding,
            page: Page,
            similarity: embeddingSimilarity,
          })
          .from(DocumentEmbedding)
          .where(
            and(
              eq(DocumentEmbedding.user_id, ctx.session.user.id),
              gt(embeddingSimilarity, input.threshold),
            ),
          )
          .innerJoin(Page, eq(DocumentEmbedding.document_id, Page.document_id))
          .orderBy(DocumentEmbedding.document_id, desc(embeddingSimilarity));

        results.sort((a, b) => {
          return b.similarity - a.similarity;
        });

        return results;
      } catch (error) {
        console.error("Database error in journal.getRelevantEntries:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch similar journal entries",
        });
      }
    }),
  saveTransactions: protectedProcedure
    .input(zBlockTransactions)
    .mutation(async ({ ctx, input }) => {
      return await saveTransactions(ctx, input);
    }),
  updateTitle: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db
          .update(Page)
          .set({ title: input.title })
          .where(
            and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
          )
          .returning();

        if (result.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found",
          });
        }

        return result[0];
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Database error in pages.updateTitle:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update page title",
        });
      }
    }),
} satisfies TRPCRouterRecord;
