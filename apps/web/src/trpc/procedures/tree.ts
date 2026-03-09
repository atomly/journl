import { and, desc, eq, inArray } from "@acme/db";
import {
  Document,
  Folder,
  Page,
  TreeEdge,
  TreeNode,
  zInsertFolder,
} from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { startFolderContentDeletion } from "~/workflows/folder-content-deletion";
import { protectedProcedure, type TRPCContext } from "../trpc";
import {
  detachEdge,
  insertEdgeAtPosition,
  moveNode,
  orderedChildren,
  type TreeDestination,
} from "./tree-helpers";

const CURSOR_SEPARATOR = "|";

function encodeTimestampCursor(updatedAt: string, id: string) {
  return `${updatedAt}${CURSOR_SEPARATOR}${id}`;
}

function decodeTimestampCursor(cursor?: string) {
  if (!cursor) {
    return null;
  }

  const [updatedAt, id] = cursor.split(CURSOR_SEPARATOR);
  if (!updatedAt || !id) {
    return null;
  }

  return {
    id,
    updatedAt,
  };
}

const zDestination = z.object({
  anchor_edge_id: z.uuid().optional(),
  parent_node_id: z.uuid().nullable(),
  position: z.enum(["before", "after"]).optional(),
});

async function getFolderNodeByFolderId({
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

export const treeRouter = {
  createFolder: protectedProcedure
    .input(
      z.object({
        destination: zDestination,
        name: zInsertFolder.shape.name,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const userId = ctx.session.user.id;

        const [folder] = await tx
          .insert(Folder)
          .values({
            name: input.name,
            user_id: userId,
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
            user_id: userId,
          })
          .returning();

        if (!node) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create folder node",
          });
        }

        const edge = await insertEdgeAtPosition({
          anchorEdgeId: input.destination.anchor_edge_id,
          db: tx,
          nodeId: node.id,
          parentNodeId: input.destination.parent_node_id,
          position: input.destination.position,
          userId,
        });

        return {
          edge_id: edge.id,
          folder: {
            ...folder,
            edge_id: edge.id,
            node_id: node.id,
            parent_node_id: edge.parent_node_id,
          },
          kind: "folder" as const,
          node_id: node.id,
          parent_node_id: edge.parent_node_id,
        };
      });
    }),
  createPage: protectedProcedure
    .input(
      z.object({
        destination: zDestination,
        title: z.string().max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const userId = ctx.session.user.id;

        const [document] = await tx
          .insert(Document)
          .values({
            user_id: userId,
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
            document_id: document.id,
            title: input.title,
            user_id: userId,
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
            user_id: userId,
          })
          .returning();

        if (!node) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create page node",
          });
        }

        const edge = await insertEdgeAtPosition({
          anchorEdgeId: input.destination.anchor_edge_id,
          db: tx,
          nodeId: node.id,
          parentNodeId: input.destination.parent_node_id,
          position: input.destination.position,
          userId,
        });

        return {
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
    }),
  deleteFolder: protectedProcedure
    .input(
      z.object({
        folder_id: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Phase 1: Synchronous — detach edges so subtree is invisible
      const asyncPayload = await ctx.db.transaction(async (tx) => {
        const userId = ctx.session.user.id;
        const folderNode = await getFolderNodeByFolderId({
          db: tx,
          folderId: input.folder_id,
          userId,
        });

        if (!folderNode) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder node not found",
          });
        }

        // BFS to collect all subtree node IDs
        const edges = await tx
          .select({
            id: TreeEdge.id,
            node_id: TreeEdge.node_id,
            parent_node_id: TreeEdge.parent_node_id,
          })
          .from(TreeEdge)
          .where(eq(TreeEdge.user_id, userId));

        const childrenByParent = new Map<string, string[]>();
        const edgeByNodeId = new Map<string, string>();
        for (const edge of edges) {
          edgeByNodeId.set(edge.node_id, edge.id);
          if (!edge.parent_node_id) {
            continue;
          }
          const children = childrenByParent.get(edge.parent_node_id) ?? [];
          children.push(edge.node_id);
          childrenByParent.set(edge.parent_node_id, children);
        }

        const subtreeNodeIds = new Set<string>([folderNode.id]);
        const queue = [...(childrenByParent.get(folderNode.id) ?? [])];

        while (queue.length > 0) {
          const nodeId = queue.shift();
          if (!nodeId || subtreeNodeIds.has(nodeId)) {
            continue;
          }
          subtreeNodeIds.add(nodeId);
          queue.push(...(childrenByParent.get(nodeId) ?? []));
        }

        // Detach the root folder's edge (re-links external siblings)
        const rootEdgeId = edgeByNodeId.get(folderNode.id);
        if (rootEdgeId) {
          await detachEdge({ db: tx, edgeId: rootEdgeId, userId });
          // Delete the detached root edge separately from subtree bulk deletion.
          await tx
            .delete(TreeEdge)
            .where(
              and(eq(TreeEdge.id, rootEdgeId), eq(TreeEdge.user_id, userId)),
            );
        }

        // Bulk delete remaining inner subtree edges
        const innerSubtreeNodeIds = [...subtreeNodeIds].filter(
          (id) => id !== folderNode.id,
        );
        if (innerSubtreeNodeIds.length > 0) {
          // Null out sibling pointers before bulk deletion to avoid
          // cross-row link conflicts during the delete statement.
          await tx
            .update(TreeEdge)
            .set({
              next_edge_id: null,
              parent_node_id: null,
              prev_edge_id: null,
            })
            .where(
              and(
                eq(TreeEdge.user_id, userId),
                inArray(TreeEdge.node_id, innerSubtreeNodeIds),
              ),
            );

          await tx
            .delete(TreeEdge)
            .where(
              and(
                eq(TreeEdge.user_id, userId),
                inArray(TreeEdge.node_id, innerSubtreeNodeIds),
              ),
            );
        }

        // Collect page IDs and folder IDs from subtree nodes
        const subtreeNodes = await tx
          .select({
            folder_id: TreeNode.folder_id,
            id: TreeNode.id,
            page_id: TreeNode.page_id,
          })
          .from(TreeNode)
          .where(
            and(
              eq(TreeNode.user_id, userId),
              inArray(TreeNode.id, [...subtreeNodeIds]),
            ),
          );

        const pageIds = subtreeNodes
          .map((node) => node.page_id)
          .filter((value): value is string => !!value);
        const folderIds = subtreeNodes
          .map((node) => node.folder_id)
          .filter((value): value is string => !!value);

        let documentIds: string[] = [];
        if (pageIds.length > 0) {
          const pages = await tx
            .select({ document_id: Page.document_id })
            .from(Page)
            .where(and(eq(Page.user_id, userId), inArray(Page.id, pageIds)));
          documentIds = pages.map((page) => page.document_id);
        }

        // Delete root folder's TreeNode and Folder record synchronously
        await tx
          .delete(TreeNode)
          .where(
            and(eq(TreeNode.id, folderNode.id), eq(TreeNode.user_id, userId)),
          );

        await tx
          .delete(Folder)
          .where(
            and(eq(Folder.id, input.folder_id), eq(Folder.user_id, userId)),
          );

        // Exclude root node/folder from async cleanup (already deleted)
        const innerNodeIds = [...subtreeNodeIds].filter(
          (id) => id !== folderNode.id,
        );
        const innerFolderIds = folderIds.filter((id) => id !== input.folder_id);

        return { documentIds, folderIds: innerFolderIds, innerNodeIds };
      });

      // Phase 2: Async — delegate content cleanup to background workflow
      const userId = ctx.session.user.id;
      const { documentIds, folderIds, innerNodeIds } = asyncPayload;

      if (
        documentIds.length > 0 ||
        folderIds.length > 0 ||
        innerNodeIds.length > 0
      ) {
        try {
          await startFolderContentDeletion({
            documentIds,
            folderIds,
            subtreeNodeIds: innerNodeIds,
            userId,
          });
        } catch (error) {
          console.error(
            "Failed to start folder content deletion workflow:",
            error,
          );
          throw new TRPCError({
            cause: error,
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Folder was removed from the tree but cleanup could not be queued. Please contact support if descendant content is missing.",
          });
        }
      }

      return {
        deleted_folder_id: input.folder_id,
      };
    }),
  getAncestorPath: protectedProcedure
    .input(
      z.object({
        folder_id: z.uuid().optional(),
        node_id: z.uuid().optional(),
        page_id: z.uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. Resolve starting node_id from folder_id or page_id
      let startNodeId: string | null = input.node_id ?? null;

      if (!startNodeId && input.folder_id) {
        const folderNode = await getFolderNodeByFolderId({
          db: ctx.db,
          folderId: input.folder_id,
          userId,
        });
        startNodeId = folderNode?.id ?? null;
      }

      if (!startNodeId && input.page_id) {
        const pageNode = await ctx.db.query.TreeNode.findFirst({
          where: and(
            eq(TreeNode.user_id, userId),
            eq(TreeNode.node_type, "page"),
            eq(TreeNode.page_id, input.page_id),
          ),
        });
        startNodeId = pageNode?.id ?? null;
      }

      if (!startNodeId) {
        return [];
      }

      // 2. Load all edges for this user and build a parent map in memory
      const edges = await ctx.db
        .select({
          node_id: TreeEdge.node_id,
          parent_node_id: TreeEdge.parent_node_id,
        })
        .from(TreeEdge)
        .where(eq(TreeEdge.user_id, userId));

      const parentByNodeId = new Map<string, string | null>();
      for (const edge of edges) {
        parentByNodeId.set(edge.node_id, edge.parent_node_id);
      }

      // 3. Walk up the chain to collect ancestor node IDs
      const ancestorNodeIds: string[] = [];
      let currentNodeId: string | null = startNodeId;
      const visited = new Set<string>();

      while (currentNodeId) {
        if (visited.has(currentNodeId)) {
          break;
        }
        visited.add(currentNodeId);
        ancestorNodeIds.push(currentNodeId);
        currentNodeId = parentByNodeId.get(currentNodeId) ?? null;
      }

      if (ancestorNodeIds.length === 0) {
        return [];
      }

      // 4. Batch-fetch all tree nodes, then batch-fetch folders and pages
      const nodes = await ctx.db
        .select()
        .from(TreeNode)
        .where(
          and(
            eq(TreeNode.user_id, userId),
            inArray(TreeNode.id, ancestorNodeIds),
          ),
        );
      const nodesById = new Map(nodes.map((n) => [n.id, n]));

      const folderIds = nodes
        .filter((n) => n.node_type === "folder" && n.folder_id)
        .map((n) => n.folder_id!);
      const pageIds = nodes
        .filter((n) => n.node_type === "page" && n.page_id)
        .map((n) => n.page_id!);

      const [folders, pages] = await Promise.all([
        folderIds.length > 0
          ? ctx.db
              .select()
              .from(Folder)
              .where(
                and(eq(Folder.user_id, userId), inArray(Folder.id, folderIds)),
              )
          : Promise.resolve([]),
        pageIds.length > 0
          ? ctx.db
              .select()
              .from(Page)
              .where(and(eq(Page.user_id, userId), inArray(Page.id, pageIds)))
          : Promise.resolve([]),
      ]);
      const foldersById = new Map(folders.map((f) => [f.id, f]));
      const pagesById = new Map(pages.map((p) => [p.id, p]));

      // 5. Build the ancestor list in root → current order
      const ancestors: Array<{
        node_id: string;
        node_type: "folder" | "page";
        id: string;
        name: string;
      }> = [];

      // ancestorNodeIds is current → root, so iterate in reverse
      for (let i = ancestorNodeIds.length - 1; i >= 0; i--) {
        const nodeId = ancestorNodeIds[i]!;
        const node = nodesById.get(nodeId);
        if (!node) {
          continue;
        }

        if (node.node_type === "folder" && node.folder_id) {
          const folder = foldersById.get(node.folder_id);
          if (folder) {
            ancestors.push({
              id: folder.id,
              name: folder.name,
              node_id: node.id,
              node_type: "folder",
            });
          }
        } else if (node.node_type === "page" && node.page_id) {
          const page = pagesById.get(node.page_id);
          if (page) {
            ancestors.push({
              id: page.id,
              name: page.title,
              node_id: node.id,
              node_type: "page",
            });
          }
        }
      }

      return ancestors;
    }),
  getChildrenPaginated: protectedProcedure
    .input(
      z.object({
        cursor: z.uuid().optional(),
        cursor_edge_id: z.uuid().optional(),
        limit: z.number().min(1).max(50).default(10),
        parent_node_id: z.uuid().nullable().default(null),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { edges, nextCursor } = await orderedChildren({
        cursorEdgeId: input.cursor ?? input.cursor_edge_id,
        db: ctx.db,
        limit: input.limit,
        parentNodeId: input.parent_node_id,
        userId,
      });

      if (edges.length === 0) {
        return {
          items: [],
          nextCursor: undefined,
        };
      }

      const nodeIds = edges.map((edge) => edge.node_id);
      const nodes = await ctx.db
        .select()
        .from(TreeNode)
        .where(
          and(eq(TreeNode.user_id, userId), inArray(TreeNode.id, nodeIds)),
        );
      const nodesById = new Map(nodes.map((node) => [node.id, node]));

      const folderIds = nodes
        .map((node) => node.folder_id)
        .filter((value): value is string => !!value);
      const pageIds = nodes
        .map((node) => node.page_id)
        .filter((value): value is string => !!value);

      const [folders, pages] = await Promise.all([
        folderIds.length > 0
          ? ctx.db
              .select()
              .from(Folder)
              .where(
                and(eq(Folder.user_id, userId), inArray(Folder.id, folderIds)),
              )
          : Promise.resolve([]),
        pageIds.length > 0
          ? ctx.db
              .select()
              .from(Page)
              .where(and(eq(Page.user_id, userId), inArray(Page.id, pageIds)))
          : Promise.resolve([]),
      ]);
      const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
      const pagesById = new Map(pages.map((page) => [page.id, page]));

      const items = edges
        .map((edge) => {
          const node = nodesById.get(edge.node_id);
          if (!node) {
            return null;
          }

          if (node.node_type === "folder" && node.folder_id) {
            const folder = foldersById.get(node.folder_id);
            if (!folder) {
              return null;
            }

            return {
              edge_id: edge.id,
              folder: {
                ...folder,
                edge_id: edge.id,
                node_id: node.id,
                parent_node_id: edge.parent_node_id,
              },
              kind: "folder" as const,
              node_id: node.id,
              parent_node_id: edge.parent_node_id,
            };
          }

          if (node.node_type === "page" && node.page_id) {
            const page = pagesById.get(node.page_id);
            if (!page) {
              return null;
            }

            return {
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
          }

          return null;
        })
        .filter((item): item is NonNullable<typeof item> => !!item);

      return {
        items,
        nextCursor,
      };
    }),
  getNestedPagesPaginated: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        folder_id: z.uuid(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const folderNode = await getFolderNodeByFolderId({
        db: ctx.db,
        folderId: input.folder_id,
        userId,
      });

      if (!folderNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found",
        });
      }

      const edges = await ctx.db
        .select({
          id: TreeEdge.id,
          node_id: TreeEdge.node_id,
          parent_node_id: TreeEdge.parent_node_id,
        })
        .from(TreeEdge)
        .where(eq(TreeEdge.user_id, userId));

      const allFolderNodes = await ctx.db
        .select({
          id: TreeNode.id,
        })
        .from(TreeNode)
        .where(
          and(eq(TreeNode.user_id, userId), eq(TreeNode.node_type, "folder")),
        );
      const folderNodeIdSet = new Set(allFolderNodes.map((node) => node.id));

      const folderChildrenByParent = new Map<string, string[]>();
      for (const edge of edges) {
        if (!edge.parent_node_id) {
          continue;
        }

        if (!folderNodeIdSet.has(edge.node_id)) {
          continue;
        }

        const children = folderChildrenByParent.get(edge.parent_node_id) ?? [];
        children.push(edge.node_id);
        folderChildrenByParent.set(edge.parent_node_id, children);
      }

      const descendantFolderNodeIds = new Set<string>([folderNode.id]);
      const queue = [...(folderChildrenByParent.get(folderNode.id) ?? [])];

      while (queue.length > 0) {
        const nodeId = queue.shift();
        if (!nodeId || descendantFolderNodeIds.has(nodeId)) {
          continue;
        }

        descendantFolderNodeIds.add(nodeId);
        queue.push(...(folderChildrenByParent.get(nodeId) ?? []));
      }

      const pageEdges = edges.filter((edge) => {
        if (!edge.parent_node_id) {
          return false;
        }

        return descendantFolderNodeIds.has(edge.parent_node_id);
      });
      const pageNodeIds = pageEdges.map((edge) => edge.node_id);

      if (pageNodeIds.length === 0) {
        return {
          items: [],
          nextCursor: undefined,
        };
      }

      const pageNodes = await ctx.db
        .select({
          id: TreeNode.id,
          page_id: TreeNode.page_id,
        })
        .from(TreeNode)
        .where(
          and(
            eq(TreeNode.user_id, userId),
            eq(TreeNode.node_type, "page"),
            inArray(TreeNode.id, pageNodeIds),
          ),
        );

      const pageIdToNodeId = new Map<string, string>();
      for (const pageNode of pageNodes) {
        if (pageNode.page_id) {
          pageIdToNodeId.set(pageNode.page_id, pageNode.id);
        }
      }

      const pages = await ctx.db
        .select()
        .from(Page)
        .where(
          and(
            eq(Page.user_id, userId),
            inArray(Page.id, [...pageIdToNodeId.keys()]),
          ),
        )
        .orderBy(desc(Page.updated_at), desc(Page.id));

      const edgeByNodeId = new Map(
        pageEdges.map((edge) => [edge.node_id, edge]),
      );
      const decodedCursor = decodeTimestampCursor(input.cursor);
      const filteredPages = pages.filter((page) => {
        if (!decodedCursor) {
          return true;
        }

        if (page.updated_at < decodedCursor.updatedAt) {
          return true;
        }

        if (page.updated_at > decodedCursor.updatedAt) {
          return false;
        }

        return page.id < decodedCursor.id;
      });

      const items = filteredPages.slice(0, input.limit + 1).map((page) => {
        const nodeId = pageIdToNodeId.get(page.id);
        const edge = nodeId ? edgeByNodeId.get(nodeId) : undefined;

        return {
          ...page,
          edge_id: edge?.id ?? null,
          node_id: nodeId ?? null,
          parent_node_id: edge?.parent_node_id ?? null,
        };
      });

      const hasNextPage = items.length > input.limit;
      const pageItems = hasNextPage ? items.slice(0, input.limit) : items;
      const lastItem = hasNextPage ? pageItems.at(-1) : undefined;

      return {
        items: pageItems,
        nextCursor: lastItem
          ? encodeTimestampCursor(lastItem.updated_at, lastItem.id)
          : undefined,
      };
    }),
  moveItem: protectedProcedure
    .input(
      z.object({
        destination: zDestination,
        node_id: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const destination: TreeDestination = {
        anchor_edge_id: input.destination.anchor_edge_id,
        parent_node_id: input.destination.parent_node_id,
        position: input.destination.position,
      };

      const edge = await (async () => {
        try {
          return await ctx.db.transaction(async (tx) => {
            return await moveNode({
              db: tx,
              destination,
              nodeId: input.node_id,
              userId: ctx.session.user.id,
            });
          });
        } catch (error) {
          const dbErrorCode =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string"
              ? error.code
              : null;

          if (dbErrorCode === "23505") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid move destination",
            });
          }

          throw error;
        }
      })();

      return {
        edge_id: edge.id,
        node_id: edge.node_id,
        parent_node_id: edge.parent_node_id,
      };
    }),
} satisfies TRPCRouterRecord;
