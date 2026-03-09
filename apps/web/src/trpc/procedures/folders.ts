import { and, eq, inArray } from "@acme/db";
import { Folder, TreeEdge, TreeNode, zInsertFolder } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure, type TRPCContext } from "../trpc";
import { insertEdgeAtPosition } from "./tree-helpers";

async function getFolderNode({
  db,
  folderId,
  userId,
}: {
  db: TRPCContext["db"];
  folderId: string;
  userId: string;
}) {
  return await db.query.TreeNode.findFirst({
    where: and(
      eq(TreeNode.user_id, userId),
      eq(TreeNode.node_type, "folder"),
      eq(TreeNode.folder_id, folderId),
    ),
  });
}

export const foldersRouter = {
  create: protectedProcedure
    .input(zInsertFolder)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const [folder] = await tx
          .insert(Folder)
          .values({
            name: input.name,
            user_id: ctx.session.user.id,
          })
          .returning();

        if (!folder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create folder",
          });
        }

        const [node] = await tx
          .insert(TreeNode)
          .values({
            folder_id: folder.id,
            node_type: "folder",
            user_id: ctx.session.user.id,
          })
          .returning();

        if (!node) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create folder node",
          });
        }

        const edge = await insertEdgeAtPosition({
          db: tx,
          nodeId: node.id,
          parentNodeId: null,
          userId: ctx.session.user.id,
        });

        return {
          ...folder,
          edge_id: edge.id,
          node_id: node.id,
          parent_node_id: edge.parent_node_id,
        };
      });
    }),
  getById: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const folder = await ctx.db.query.Folder.findFirst({
        where: and(
          eq(Folder.id, input.id),
          eq(Folder.user_id, ctx.session.user.id),
        ),
      });

      if (!folder) {
        return null;
      }

      const node = await getFolderNode({
        db: ctx.db,
        folderId: folder.id,
        userId: ctx.session.user.id,
      });
      const edge = node
        ? await ctx.db.query.TreeEdge.findFirst({
            where: and(
              eq(TreeEdge.user_id, ctx.session.user.id),
              eq(TreeEdge.node_id, node.id),
            ),
          })
        : null;

      return {
        ...folder,
        edge_id: edge?.id ?? null,
        node_id: node?.id ?? null,
        parent_node_id: edge?.parent_node_id ?? null,
      };
    }),
  getByUser: protectedProcedure.query(async ({ ctx }) => {
    const folders = await ctx.db
      .select()
      .from(Folder)
      .where(eq(Folder.user_id, ctx.session.user.id));

    if (folders.length === 0) {
      return [];
    }

    const nodes = await ctx.db
      .select({
        folder_id: TreeNode.folder_id,
        id: TreeNode.id,
      })
      .from(TreeNode)
      .where(
        and(
          eq(TreeNode.user_id, ctx.session.user.id),
          eq(TreeNode.node_type, "folder"),
          inArray(
            TreeNode.folder_id,
            folders.map((folder) => folder.id),
          ),
        ),
      );
    const nodeIds = nodes.map((node) => node.id);
    const edges =
      nodeIds.length === 0
        ? []
        : await ctx.db
            .select({
              id: TreeEdge.id,
              node_id: TreeEdge.node_id,
              parent_node_id: TreeEdge.parent_node_id,
            })
            .from(TreeEdge)
            .where(
              and(
                eq(TreeEdge.user_id, ctx.session.user.id),
                inArray(TreeEdge.node_id, nodeIds),
              ),
            );

    const nodeByFolderId = new Map(
      nodes
        .filter(
          (node): node is { folder_id: string; id: string } => !!node.folder_id,
        )
        .map((node) => [node.folder_id, node]),
    );
    const edgeByNodeId = new Map(edges.map((edge) => [edge.node_id, edge]));

    return folders.map((folder) => {
      const node = nodeByFolderId.get(folder.id);
      const edge = node ? edgeByNodeId.get(node.id) : undefined;

      return {
        ...folder,
        edge_id: edge?.id ?? null,
        node_id: node?.id ?? null,
        parent_node_id: edge?.parent_node_id ?? null,
      };
    });
  }),
  rename: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [folder] = await ctx.db
        .update(Folder)
        .set({
          name: input.name,
        })
        .where(
          and(eq(Folder.id, input.id), eq(Folder.user_id, ctx.session.user.id)),
        )
        .returning();

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found",
        });
      }

      return folder;
    }),
} satisfies TRPCRouterRecord;
