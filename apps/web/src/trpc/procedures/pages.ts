import {
  and,
  cosineDistance,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  sql,
} from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  Document,
  DocumentEmbedding,
  Folder,
  Page,
  TreeEdge,
  TreeNode,
  zInsertPage,
} from "@acme/db/schema";
import { documentBlocks } from "@acme/document";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { model } from "~/ai/providers/openai/embedding";
import { dispatchExploreRefresh } from "~/explore/dispatch";
import { lockExploreOwner, markExploreDirty } from "~/explore/refresh";
import { startDocumentEmbedding } from "~/workflows/document-embedding";
import {
  rebuildReferenceProjection,
  saveTransactions,
  zBlockTransactions,
} from "../shared/block-transaction";
import { protectedProcedure, usageGuard } from "../trpc";
import { insertEdgeAtPosition, lockTreeOwner } from "./tree-helpers";

export const pagesRouter = {
  create: protectedProcedure
    .input(zInsertPage.omit({ document_id: true, user_id: true }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        await lockTreeOwner(tx, ctx.session.user.id);
        await lockExploreOwner(tx, ctx.session.user.id);
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

        await markExploreDirty(tx, ctx.session.user.id);
        return page;
      });
      await dispatchExploreRefresh(ctx.session.user.id);
      return result;
    }),
  duplicate: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const userId = ctx.session.user.id;
        await lockTreeOwner(tx, userId);
        await lockExploreOwner(tx, userId);

        const [source] = await tx
          .select()
          .from(Page)
          .where(and(eq(Page.id, input.id), eq(Page.user_id, userId)));
        if (!source)
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });

        const sourceNode = await tx.query.TreeNode.findFirst({
          where: and(
            eq(TreeNode.user_id, userId),
            eq(TreeNode.node_type, "page"),
            eq(TreeNode.page_id, source.id),
          ),
        });
        const sourceEdge = sourceNode
          ? await tx.query.TreeEdge.findFirst({
              where: and(
                eq(TreeEdge.user_id, userId),
                eq(TreeEdge.node_id, sourceNode.id),
              ),
            })
          : null;

        const [document] = await tx
          .insert(Document)
          .values({ user_id: userId })
          .returning();
        if (!document)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create document",
          });

        const [page] = await tx
          .insert(Page)
          .values({
            document_id: document.id,
            title: source.title,
            user_id: userId,
          })
          .returning();
        if (!page)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create page",
          });

        const [node] = await tx
          .insert(TreeNode)
          .values({
            node_type: "page",
            page_id: page.id,
            user_id: userId,
          })
          .returning();
        if (!node)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create page node",
          });

        // The copy keeps the original's folder and sits directly after it.
        const edge = await insertEdgeAtPosition({
          anchorEdgeId: sourceEdge?.id,
          db: tx,
          nodeId: node.id,
          parentNodeId: sourceEdge?.parent_node_id ?? null,
          position: "after",
          userId,
        });

        // Blocks duplicate with fresh subtree IDs; references and search text
        // are projected from the copy, never copied as stale rows.
        const sourceBlocks = await tx
          .select()
          .from(BlockNode)
          .where(
            and(
              eq(BlockNode.user_id, userId),
              eq(BlockNode.document_id, source.document_id),
            ),
          );
        const copyIdBySourceId = new Map(
          sourceBlocks.map((block) => [block.id, crypto.randomUUID()]),
        );
        const copiedBlocks = sourceBlocks.map((block) => ({
          ...block,
          document_id: document.id,
          id: copyIdBySourceId.get(block.id) as string,
          parent_id: block.parent_id
            ? (copyIdBySourceId.get(block.parent_id) as string)
            : null,
        }));
        if (copiedBlocks.length > 0) {
          await tx.insert(BlockNode).values(copiedBlocks);

          const sourceEdges = await tx
            .select()
            .from(BlockEdge)
            .where(
              and(
                eq(BlockEdge.user_id, userId),
                eq(BlockEdge.document_id, source.document_id),
              ),
            );
          if (sourceEdges.length > 0) {
            await tx.insert(BlockEdge).values(
              sourceEdges.map((blockEdge) => ({
                ...blockEdge,
                document_id: document.id,
                from_id: copyIdBySourceId.get(blockEdge.from_id) as string,
                to_id: copyIdBySourceId.get(blockEdge.to_id) as string,
              })),
            );
          }
        }
        await rebuildReferenceProjection(tx, userId, document.id, copiedBlocks);

        return {
          document: { id: document.id, updated_at: document.updated_at },
          edge_id: edge.id,
          kind: "page" as const,
          node_id: node.id,
          page: {
            ...page,
            edge_id: edge.id,
            node_id: node.id,
            parent_node_id: edge.parent_node_id,
          },
          parent_node_id: edge.parent_node_id,
        };
      });
      try {
        await startDocumentEmbedding({
          documentId: result.document.id,
          documentUpdatedAt: result.document.updated_at,
          userId: ctx.session.user.id,
        });
      } catch (error) {
        console.error("Failed to start document embedding workflow", {
          documentId: result.document.id,
          error,
        });
      }
      await dispatchExploreRefresh(ctx.session.user.id);
      return result;
    }),
  getAll: protectedProcedure
    .input(z.object({ query: z.string().trim().max(255).default("") }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const pages = await ctx.db
        .select()
        .from(Page)
        .where(
          and(
            eq(Page.user_id, userId),
            input.query ? ilike(Page.title, `%${input.query}%`) : undefined,
          ),
        )
        .orderBy(desc(Page.updated_at), desc(Page.id));
      if (pages.length === 0) return { items: [] };

      // Every page row reports its actual folder membership. Root pages keep
      // a null folder; the Library surface renders them without a badge.
      const pageNodes = await ctx.db
        .select({ id: TreeNode.id, page_id: TreeNode.page_id })
        .from(TreeNode)
        .where(
          and(
            eq(TreeNode.user_id, userId),
            eq(TreeNode.node_type, "page"),
            inArray(
              TreeNode.page_id,
              pages.map((page) => page.id),
            ),
          ),
        );
      const edges =
        pageNodes.length > 0
          ? await ctx.db
              .select({
                id: TreeEdge.id,
                node_id: TreeEdge.node_id,
                parent_node_id: TreeEdge.parent_node_id,
              })
              .from(TreeEdge)
              .where(
                and(
                  eq(TreeEdge.user_id, userId),
                  inArray(
                    TreeEdge.node_id,
                    pageNodes.map((node) => node.id),
                  ),
                ),
              )
          : [];
      const parentNodeIds = [
        ...new Set(
          edges
            .map((edge) => edge.parent_node_id)
            .filter((value): value is string => !!value),
        ),
      ];
      const folderNodes =
        parentNodeIds.length > 0
          ? await ctx.db
              .select({ folder_id: TreeNode.folder_id, id: TreeNode.id })
              .from(TreeNode)
              .where(
                and(
                  eq(TreeNode.user_id, userId),
                  eq(TreeNode.node_type, "folder"),
                  inArray(TreeNode.id, parentNodeIds),
                ),
              )
          : [];
      const folderIds = [
        ...new Set(
          folderNodes
            .map((node) => node.folder_id)
            .filter((value): value is string => !!value),
        ),
      ];
      const folders =
        folderIds.length > 0
          ? await ctx.db
              .select({ id: Folder.id, name: Folder.name })
              .from(Folder)
              .where(
                and(eq(Folder.user_id, userId), inArray(Folder.id, folderIds)),
              )
          : [];

      const nodeByPageId = new Map(
        pageNodes
          .filter(
            (node): node is { id: string; page_id: string } => !!node.page_id,
          )
          .map((node) => [node.page_id, node]),
      );
      const edgeByNodeId = new Map(edges.map((edge) => [edge.node_id, edge]));
      const folderIdByNodeId = new Map(
        folderNodes
          .filter(
            (node): node is { id: string; folder_id: string } =>
              !!node.folder_id,
          )
          .map((node) => [node.id, node.folder_id]),
      );
      const folderById = new Map(folders.map((folder) => [folder.id, folder]));

      return {
        items: pages.map((page) => {
          const node = nodeByPageId.get(page.id);
          const edge = node ? edgeByNodeId.get(node.id) : undefined;
          const parentFolderId = edge?.parent_node_id
            ? folderIdByNodeId.get(edge.parent_node_id)
            : undefined;
          const folder = parentFolderId
            ? folderById.get(parentFolderId)
            : undefined;
          return {
            ...page,
            edge_id: edge?.id ?? null,
            folder_id: folder?.id ?? null,
            folder_name: folder?.name ?? null,
            node_id: node?.id ?? null,
            parent_node_id: edge?.parent_node_id ?? null,
          };
        }),
      };
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
        blocks: documentBlocks(block_nodes, block_edges),
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
            document_id: DocumentEmbedding.document_id,
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
            document_id: distinctMatches.document_id,
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
    .input(zBlockTransactions.extend({ title: z.string().max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.transaction(async (tx) => {
        const saved = await saveTransactions({ ...ctx, db: tx }, input);
        if (input.title !== undefined)
          await tx
            .update(Page)
            .set({ title: input.title, updated_at: saved.updatedAt })
            .where(
              and(
                eq(Page.document_id, input.document_id),
                eq(Page.user_id, ctx.session.user.id),
              ),
            );
        const [page] = await tx
          .select({ title: Page.title })
          .from(Page)
          .where(
            and(
              eq(Page.document_id, input.document_id),
              eq(Page.user_id, ctx.session.user.id),
            ),
          );
        if (!page)
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        return { ...saved, title: page.title };
      });
      try {
        await startDocumentEmbedding({
          documentId: document.id,
          documentUpdatedAt: document.updatedAt,
          userId: ctx.session.user.id,
        });
      } catch (error) {
        console.error("Failed to start document embedding workflow", {
          documentId: document.id,
          error,
        });
      }
      await dispatchExploreRefresh(ctx.session.user.id);
      return document;
    }),
  updateTitle: protectedProcedure
    .input(
      z.object({
        expected_updated_at: z.string(),
        id: z.uuid(),
        title: z.string().max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updatedPage = await ctx.db.transaction(async (tx) => {
        await lockExploreOwner(tx, ctx.session.user.id);
        const [current] = await tx
          .select()
          .from(Page)
          .where(
            and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
          )
          .for("update");
        if (!current)
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        if (current.updated_at !== input.expected_updated_at)
          throw new TRPCError({
            code: "CONFLICT",
            message: "This page changed elsewhere. Your title has been kept.",
          });
        const [page] = await tx
          .update(Page)
          .set({
            title: input.title,
            updated_at: sql`greatest(clock_timestamp(), ${Page.updated_at} + interval '1 microsecond')`,
          })
          .where(
            and(eq(Page.id, input.id), eq(Page.user_id, ctx.session.user.id)),
          )
          .returning();
        if (!page)
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        await markExploreDirty(tx, ctx.session.user.id);
        return page;
      });
      await dispatchExploreRefresh(ctx.session.user.id);

      return updatedPage;
    }),
} satisfies TRPCRouterRecord;
