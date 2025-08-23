import { and, cosineDistance, desc, eq, gt, sql } from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  Document,
  Page,
  PageEmbedding,
  zInsertPage,
} from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { blockNoteTree } from "../shared/block-note-tree.js";
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
  getAll: protectedProcedure.query(async ({ ctx }) => {
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
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const {
          rows: [page],
        } = await ctx.db.execute<
          Page & {
            blocks: BlockNode[];
            edges: BlockEdge[];
          }
        >(sql`
               WITH page AS (
                  SELECT * FROM ${Page}
                  WHERE ${Page.id} = ${input.id} AND ${Page.user_id} = ${ctx.session.user.id}
                  LIMIT 1
               )
               SELECT
                  page.*,
                  COALESCE(
                     (SELECT json_agg(${BlockNode}.*) FROM ${BlockNode} WHERE ${BlockNode.document_id} = page.document_id),
                     '[]'::json
                  ) as blocks,
                  COALESCE(
                     (SELECT json_agg(${BlockEdge}.*) FROM ${BlockEdge} WHERE ${BlockEdge.document_id} = page.document_id),
                     '[]'::json
                  ) as edges
               FROM page
            `);

        if (!page) {
          return null;
        }

        return {
          ...page,
          document: blockNoteTree(page.blocks, page.edges),
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
  getRelevantPageChunks: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
        query: z.string().max(10000),
        threshold: z.number().min(0).max(1).default(0.3),
      }),
    )
    .query(async ({ ctx, input }) => {
      // embed the query
      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: input.query,
      });

      // https://orm.drizzle.team/docs/guides/vector-similarity-search
      const similarity = sql<number>`1 - (${cosineDistance(PageEmbedding.embedding, embedding)})`;

      const similarPages = await ctx.db
        .select({
          content: PageEmbedding.chunk_text,
          page_id: Page.id,
          page_title: Page.title,
          similarity,
        })
        .from(PageEmbedding)
        .where(
          and(
            eq(Page.user_id, ctx.session.user.id),
            gt(similarity, input.threshold),
          ),
        )
        .innerJoin(Page, eq(PageEmbedding.page_id, Page.id))
        .orderBy(desc(similarity))
        .limit(input.limit);

      return similarPages;
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
