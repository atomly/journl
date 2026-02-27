import { and, desc, eq, isNull, lt, lte, or } from "@acme/db";
import { Folder, Page, zInsertFolder } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { protectedProcedure, type TRPCContext } from "../trpc";
import {
  decodeSidebarTreeCursor,
  encodeSidebarTreeCursor,
  sortSidebarTreePositions,
} from "./sidebar-tree-pagination";

const CURSOR_SEPARATOR = "|";

function encodeCursor(updatedAt: string, id: string) {
  return `${updatedAt}${CURSOR_SEPARATOR}${id}`;
}

function decodeCursor(cursor?: string) {
  if (!cursor) {
    return null;
  }

  const [updatedAt, id] = cursor.split(CURSOR_SEPARATOR);
  if (!updatedAt) {
    return null;
  }

  return { id, updatedAt };
}

async function getFolderById({
  db,
  id,
  userId,
}: {
  db: TRPCContext["db"];
  id: string;
  userId: string;
}) {
  return await db.query.Folder.findFirst({
    where: and(eq(Folder.id, id), eq(Folder.user_id, userId)),
  });
}

async function isDescendantOfFolder({
  db,
  folderId,
  userId,
  maybeAncestorId,
}: {
  db: TRPCContext["db"];
  folderId: string;
  userId: string;
  maybeAncestorId: string;
}) {
  let currentFolderId: string | null = folderId;
  const visited = new Set<string>();

  while (currentFolderId) {
    if (currentFolderId === maybeAncestorId) {
      return true;
    }

    if (visited.has(currentFolderId)) {
      return true;
    }
    visited.add(currentFolderId);

    const folder = await getFolderById({
      db,
      id: currentFolderId,
      userId,
    });

    if (!folder) {
      return false;
    }

    currentFolderId = folder.parent_folder_id;
  }

  return false;
}

function getDescendantFolderIds(
  allFolders: Array<
    Pick<(typeof Folder)["$inferSelect"], "id" | "parent_folder_id">
  >,
  folderId: string,
) {
  const childrenByParent = new Map<string, string[]>();

  for (const folder of allFolders) {
    if (!folder.parent_folder_id) {
      continue;
    }

    const children = childrenByParent.get(folder.parent_folder_id) ?? [];
    children.push(folder.id);
    childrenByParent.set(folder.parent_folder_id, children);
  }

  const descendants = new Set<string>([folderId]);
  const queue = [...(childrenByParent.get(folderId) ?? [])];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || descendants.has(currentId)) {
      continue;
    }

    descendants.add(currentId);
    queue.push(...(childrenByParent.get(currentId) ?? []));
  }

  return [...descendants];
}

export const foldersRouter = {
  create: protectedProcedure
    .input(zInsertFolder)
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.parent_folder_id) {
          const parentFolder = await getFolderById({
            db: ctx.db,
            id: input.parent_folder_id,
            userId: ctx.session.user.id,
          });

          if (!parentFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Parent folder not found",
            });
          }
        }

        const [folder] = await ctx.db
          .insert(Folder)
          .values({
            ...input,
            user_id: ctx.session.user.id,
          })
          .returning();

        if (!folder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create folder",
          });
        }

        return folder;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Database error in folders.create:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create folder",
        });
      }
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        move_to_folder_id: z.uuid().nullable().optional(),
        strategy: z.enum(["delete_all", "move"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const folder = await getFolderById({
          db: ctx.db,
          id: input.id,
          userId: ctx.session.user.id,
        });

        if (!folder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder not found",
          });
        }

        if (input.strategy === "delete_all") {
          const [deletedFolder] = await ctx.db
            .delete(Folder)
            .where(
              and(
                eq(Folder.id, input.id),
                eq(Folder.user_id, ctx.session.user.id),
              ),
            )
            .returning();

          if (!deletedFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Folder not found",
            });
          }

          return deletedFolder;
        }

        const destinationFolderId = input.move_to_folder_id ?? null;

        if (destinationFolderId === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Destination folder must be different from source folder",
          });
        }

        if (destinationFolderId) {
          const destinationFolder = await getFolderById({
            db: ctx.db,
            id: destinationFolderId,
            userId: ctx.session.user.id,
          });

          if (!destinationFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Destination folder not found",
            });
          }

          const isDescendant = await isDescendantOfFolder({
            db: ctx.db,
            folderId: destinationFolderId,
            maybeAncestorId: input.id,
            userId: ctx.session.user.id,
          });

          if (isDescendant) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot move folder contents into a descendant of the folder being deleted",
            });
          }
        }

        return await ctx.db.transaction(async (tx) => {
          await tx
            .update(Folder)
            .set({
              parent_folder_id: destinationFolderId,
            })
            .where(
              and(
                eq(Folder.user_id, ctx.session.user.id),
                eq(Folder.parent_folder_id, input.id),
              ),
            );

          await tx
            .update(Page)
            .set({
              folder_id: destinationFolderId,
            })
            .where(
              and(
                eq(Page.user_id, ctx.session.user.id),
                eq(Page.folder_id, input.id),
              ),
            );

          const [deletedFolder] = await tx
            .delete(Folder)
            .where(
              and(
                eq(Folder.id, input.id),
                eq(Folder.user_id, ctx.session.user.id),
              ),
            )
            .returning();

          if (!deletedFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Folder not found",
            });
          }

          return deletedFolder;
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Database error in folders.delete:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete folder",
        });
      }
    }),
  getById: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getFolderById({
          db: ctx.db,
          id: input.id,
          userId: ctx.session.user.id,
        });
      } catch (error) {
        console.error("Database error in folders.getById:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch folder",
        });
      }
    }),
  getByUser: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db
        .select()
        .from(Folder)
        .where(eq(Folder.user_id, ctx.session.user.id))
        .orderBy(desc(Folder.updated_at), desc(Folder.id));
    } catch (error) {
      console.error("Database error in folders.getByUser:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch folders",
      });
    }
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
      try {
        const folder = await getFolderById({
          db: ctx.db,
          id: input.folder_id,
          userId: ctx.session.user.id,
        });

        if (!folder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder not found",
          });
        }

        const decodedCursor = decodeCursor(input.cursor);
        const cursorCondition = decodedCursor
          ? decodedCursor.id
            ? or(
                lt(Page.updated_at, decodedCursor.updatedAt),
                and(
                  eq(Page.updated_at, decodedCursor.updatedAt),
                  lt(Page.id, decodedCursor.id),
                ),
              )
            : lte(Page.updated_at, decodedCursor.updatedAt)
          : undefined;

        const folders = await ctx.db
          .select({
            id: Folder.id,
            parent_folder_id: Folder.parent_folder_id,
          })
          .from(Folder)
          .where(eq(Folder.user_id, ctx.session.user.id));

        const nestedFolderIds = getDescendantFolderIds(
          folders,
          input.folder_id,
        );

        const pages = await ctx.db
          .select()
          .from(Page)
          .where(
            and(
              eq(Page.user_id, ctx.session.user.id),
              inArray(Page.folder_id, nestedFolderIds),
              cursorCondition,
            ),
          )
          .orderBy(desc(Page.updated_at), desc(Page.id))
          .limit(input.limit + 1);

        const hasNextPage = pages.length > input.limit;
        const items = hasNextPage ? pages.slice(0, input.limit) : pages;
        const lastItem = hasNextPage ? items.at(-1) : undefined;

        return {
          items,
          nextCursor: lastItem
            ? encodeCursor(lastItem.updated_at, lastItem.id)
            : undefined,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error(
          "Database error in folders.getNestedPagesPaginated:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch nested folder pages",
        });
      }
    }),
  getPaginated: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
        parent_folder_id: z.uuid().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { limit, cursor, parent_folder_id } = input;
        const decodedCursor = decodeCursor(cursor);

        const cursorCondition = decodedCursor
          ? decodedCursor.id
            ? or(
                lt(Folder.updated_at, decodedCursor.updatedAt),
                and(
                  eq(Folder.updated_at, decodedCursor.updatedAt),
                  lt(Folder.id, decodedCursor.id),
                ),
              )
            : lte(Folder.updated_at, decodedCursor.updatedAt)
          : undefined;

        const folders = await ctx.db
          .select()
          .from(Folder)
          .where(
            and(
              eq(Folder.user_id, ctx.session.user.id),
              parent_folder_id === null
                ? isNull(Folder.parent_folder_id)
                : eq(Folder.parent_folder_id, parent_folder_id),
              cursorCondition,
            ),
          )
          .orderBy(desc(Folder.updated_at), desc(Folder.id))
          .limit(limit + 1);

        const hasNextPage = folders.length > limit;
        const items = hasNextPage ? folders.slice(0, limit) : folders;
        const lastItem = hasNextPage ? items.at(-1) : undefined;

        return {
          items,
          nextCursor: lastItem
            ? encodeCursor(lastItem.updated_at, lastItem.id)
            : undefined,
        };
      } catch (error) {
        console.error("Database error in folders.getPaginated:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch folders",
        });
      }
    }),
  getTreePaginated: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
        parent_folder_id: z.uuid().nullable().default(null),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { cursor, limit, parent_folder_id } = input;
        const decodedCursor = decodeSidebarTreeCursor(cursor);

        const folderCursorCondition = decodedCursor
          ? decodedCursor.kind === "folder"
            ? or(
                lt(Folder.updated_at, decodedCursor.updatedAt),
                and(
                  eq(Folder.updated_at, decodedCursor.updatedAt),
                  lt(Folder.id, decodedCursor.id),
                ),
              )
            : lt(Folder.updated_at, decodedCursor.updatedAt)
          : undefined;

        const pageCursorCondition = decodedCursor
          ? decodedCursor.kind === "folder"
            ? lte(Page.updated_at, decodedCursor.updatedAt)
            : or(
                lt(Page.updated_at, decodedCursor.updatedAt),
                and(
                  eq(Page.updated_at, decodedCursor.updatedAt),
                  lt(Page.id, decodedCursor.id),
                ),
              )
          : undefined;

        const [folders, pages] = await Promise.all([
          ctx.db
            .select()
            .from(Folder)
            .where(
              and(
                eq(Folder.user_id, ctx.session.user.id),
                parent_folder_id === null
                  ? isNull(Folder.parent_folder_id)
                  : eq(Folder.parent_folder_id, parent_folder_id),
                folderCursorCondition,
              ),
            )
            .orderBy(desc(Folder.updated_at), desc(Folder.id))
            .limit(limit + 1),
          ctx.db
            .select()
            .from(Page)
            .where(
              and(
                eq(Page.user_id, ctx.session.user.id),
                parent_folder_id === null
                  ? isNull(Page.folder_id)
                  : eq(Page.folder_id, parent_folder_id),
                pageCursorCondition,
              ),
            )
            .orderBy(desc(Page.updated_at), desc(Page.id))
            .limit(limit + 1),
        ]);

        const mixedItems = sortSidebarTreePositions([
          ...folders.map((folder) => ({
            folder,
            id: folder.id,
            kind: "folder" as const,
            updatedAt: folder.updated_at,
          })),
          ...pages.map((page) => ({
            id: page.id,
            kind: "page" as const,
            page,
            updatedAt: page.updated_at,
          })),
        ]);

        const hasNextPage =
          mixedItems.length > limit ||
          folders.length > limit ||
          pages.length > limit;
        const items = hasNextPage ? mixedItems.slice(0, limit) : mixedItems;
        const lastItem = hasNextPage ? items.at(-1) : undefined;

        return {
          items: items.map((item) =>
            item.kind === "folder"
              ? {
                  folder: item.folder,
                  kind: "folder" as const,
                }
              : {
                  kind: "page" as const,
                  page: item.page,
                },
          ),
          nextCursor: lastItem
            ? encodeSidebarTreeCursor({
                id: lastItem.id,
                kind: lastItem.kind,
                updatedAt: lastItem.updatedAt,
              })
            : undefined,
        };
      } catch (error) {
        console.error("Database error in folders.getTreePaginated:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch sidebar tree",
        });
      }
    }),
  move: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        target_parent_folder_id: z.uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const folder = await getFolderById({
          db: ctx.db,
          id: input.id,
          userId: ctx.session.user.id,
        });

        if (!folder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder not found",
          });
        }

        if (input.target_parent_folder_id === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A folder cannot be moved into itself",
          });
        }

        if (input.target_parent_folder_id) {
          const targetFolder = await getFolderById({
            db: ctx.db,
            id: input.target_parent_folder_id,
            userId: ctx.session.user.id,
          });

          if (!targetFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Target folder not found",
            });
          }

          const isDescendant = await isDescendantOfFolder({
            db: ctx.db,
            folderId: input.target_parent_folder_id,
            maybeAncestorId: input.id,
            userId: ctx.session.user.id,
          });

          if (isDescendant) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A folder cannot be moved into one of its descendants",
            });
          }
        }

        const [updatedFolder] = await ctx.db
          .update(Folder)
          .set({
            parent_folder_id: input.target_parent_folder_id,
          })
          .where(
            and(
              eq(Folder.id, input.id),
              eq(Folder.user_id, ctx.session.user.id),
            ),
          )
          .returning();

        if (!updatedFolder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder not found",
          });
        }

        return updatedFolder;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Database error in folders.move:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to move folder",
        });
      }
    }),
  rename: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [folder] = await ctx.db
          .update(Folder)
          .set({
            name: input.name,
          })
          .where(
            and(
              eq(Folder.id, input.id),
              eq(Folder.user_id, ctx.session.user.id),
            ),
          )
          .returning();

        if (!folder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder not found",
          });
        }

        return folder;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Database error in folders.rename:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rename folder",
        });
      }
    }),
} satisfies TRPCRouterRecord;
