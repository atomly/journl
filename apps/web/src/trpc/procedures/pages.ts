import { blocknoteBlocks } from "@acme/blocknote/server";
import { and, cosineDistance, desc, eq, gt, gte, lte, sql } from "@acme/db";
import {
  Document,
  DocumentEmbedding,
  Page,
  TreeEdge,
  TreeNode,
  zInsertPage,
} from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { model } from "~/ai/providers/openai/embedding";
import {
  saveTransactions,
  zBlockTransactions,
} from "../shared/block-transaction";
import { protectedProcedure, usageGuard } from "../trpc";
import { insertEdgeAtPosition } from "./tree-helpers";

export const pagesRouter = {
  create: protectedProcedure
    .input(zInsertPage.omit({ document_id: true, user_id: true }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
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

        const [node] = await tx
          .insert(TreeNode)
          .values({
            node_type: "page",
            page_id: page.id,
            user_id: ctx.session.user.id,
          })
          .returning();

        if (!node) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create page node",
          });
        }

        await insertEdgeAtPosition({
          db: tx,
          nodeId: node.id,
          parentNodeId: null,
          userId: ctx.session.user.id,
        });

        return page;
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
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

      const node = await ctx.db.query.TreeNode.findFirst({
        where: and(
          eq(TreeNode.user_id, ctx.session.user.id),
          eq(TreeNode.node_type, "page"),
          eq(TreeNode.page_id, result.id),
        ),
      });
      const edge = node
        ? await ctx.db.query.TreeEdge.findFirst({
            where: and(
              eq(TreeEdge.user_id, ctx.session.user.id),
              eq(TreeEdge.node_id, node.id),
            ),
          })
        : null;

      const { block_nodes, block_edges, ...page } = result;
      return {
        ...page,
        blocks: blocknoteBlocks(block_nodes, block_edges),
        edge_id: edge?.id ?? null,
        node_id: node?.id ?? null,
        parent_node_id: edge?.parent_node_id ?? null,
      };
    }),
  getByUser: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select()
      .from(Page)
      .where(eq(Page.user_id, ctx.session.user.id))
      .orderBy(desc(Page.updated_at));
  }),
  getPaginated: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        direction: z.enum(["forward", "backward"]).default("forward"),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pages = await ctx.db
        .select()
        .from(Page)
        .where(
          and(
            eq(Page.user_id, ctx.session.user.id),
            input.cursor
              ? input.direction === "forward"
                ? lte(Page.updated_at, input.cursor)
                : gte(Page.updated_at, input.cursor)
              : undefined,
          ),
        )
        .orderBy(desc(Page.updated_at))
        .limit(input.limit + 1);

      const items =
        pages.length <= 1 ? pages : pages.slice(0, pages.length - 1);
      const [nextPage] = pages.length <= 1 ? [] : pages.slice(-1);

      return {
        items,
        nextCursor: nextPage?.updated_at,
      };
    }),
  getRelevantPages: protectedProcedure
    .use(usageGuard)
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
          model,
          value: input.query,
        });

        const embeddingSimilarity = sql<number>`1 - (${cosineDistance(DocumentEmbedding.vector, embedding)})`;

        const distinctMatches = ctx.db
          .selectDistinctOn([DocumentEmbedding.document_id], {
            chunk_markdown_text: DocumentEmbedding.chunk_markdown_text,
            page_id: Page.id,
            page_title: Page.title,
            similarity: embeddingSimilarity.as("similarity"),
          })
          .from(DocumentEmbedding)
          .where(eq(DocumentEmbedding.user_id, ctx.session.user.id))
          .innerJoin(Page, eq(DocumentEmbedding.document_id, Page.document_id))
          .orderBy(DocumentEmbedding.document_id, desc(embeddingSimilarity))
          .as("distinct_page_matches");

        return await ctx.db
          .select({
            chunk_markdown_text: distinctMatches.chunk_markdown_text,
            page_id: distinctMatches.page_id,
            page_title: distinctMatches.page_title,
            similarity: distinctMatches.similarity,
          })
          .from(distinctMatches)
          .where(gt(distinctMatches.similarity, input.threshold))
          .orderBy(desc(distinctMatches.similarity))
          .limit(input.limit);
      } catch (error) {
        console.error("Database error in pages.getRelevantPages:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch similar pages",
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
      const [updatedPage] = await ctx.db
        .update(Page)
        .set({ title: input.title })
        .where(
          and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
        )
        .returning();

      if (!updatedPage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      return updatedPage;
    }),
} satisfies TRPCRouterRecord;
