import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, ne } from "@acme/db";
import { Page, TreeEdge, TreeNode, user } from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import type { TRPCContext } from "../trpc";

type Db = TRPCContext["db"];

/** Call within a transaction, before other owner/document locks or tree reads. */
export async function lockTreeOwner(db: Db, userId: string) {
  await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .for("no key update");
}

export async function detachDocumentPageEdges(
  db: Db,
  documentId: string,
  userId: string,
) {
  await lockTreeOwner(db, userId);
  const pageEdges = await db
    .select({ id: TreeEdge.id })
    .from(TreeEdge)
    .innerJoin(TreeNode, eq(TreeNode.id, TreeEdge.node_id))
    .innerJoin(Page, eq(Page.id, TreeNode.page_id))
    .where(and(eq(Page.document_id, documentId), eq(TreeEdge.user_id, userId)));
  for (const edge of pageEdges) {
    await detachEdge({ db, edgeId: edge.id, userId });
  }
}

export type TreeDestination = {
  anchor_edge_id?: string;
  parent_node_id: string | null;
  position?: "after" | "before";
};

type OrderedEdge = Pick<
  typeof TreeEdge.$inferSelect,
  "id" | "next_edge_id" | "node_id" | "parent_node_id" | "prev_edge_id"
>;

function orderSiblingEdges(edges: OrderedEdge[]) {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const visited = new Set<string>();
  const ordered: OrderedEdge[] = [];
  // Preserve intact strands, including multiple heads left by old cascade deletes.
  for (const start of [
    ...edges.filter((edge) => edge.prev_edge_id === null),
    ...edges,
  ]) {
    let edge: OrderedEdge | undefined = start;
    while (edge && !visited.has(edge.id)) {
      visited.add(edge.id);
      ordered.push(edge);
      edge = edge.next_edge_id ? byId.get(edge.next_edge_id) : undefined;
    }
  }
  return ordered;
}

async function repairSiblingOrder(
  db: Db,
  userId: string,
  parentNodeId: string | null,
  excludeEdgeId?: string,
) {
  const edges = await db
    .select()
    .from(TreeEdge)
    .where(
      and(
        eq(TreeEdge.user_id, userId),
        parentNodeId === null
          ? isNull(TreeEdge.parent_node_id)
          : eq(TreeEdge.parent_node_id, parentNodeId),
        excludeEdgeId ? ne(TreeEdge.id, excludeEdgeId) : undefined,
      ),
    )
    .orderBy(TreeEdge.created_at, TreeEdge.id);
  const ordered = orderSiblingEdges(edges);
  if (
    ordered.every(
      (edge, index) =>
        edge.prev_edge_id === (ordered[index - 1]?.id ?? null) &&
        edge.next_edge_id === (ordered[index + 1]?.id ?? null),
    )
  )
    return;

  // Clear both directions first to respect the immediate unique-pointer indexes.
  await db
    .update(TreeEdge)
    .set({ next_edge_id: null, prev_edge_id: null })
    .where(
      and(
        eq(TreeEdge.user_id, userId),
        inArray(
          TreeEdge.id,
          ordered.map((edge) => edge.id),
        ),
      ),
    );
  for (const [index, edge] of ordered.entries()) {
    await db
      .update(TreeEdge)
      .set({
        next_edge_id: ordered[index + 1]?.id ?? null,
        prev_edge_id: ordered[index - 1]?.id ?? null,
      })
      .where(and(eq(TreeEdge.id, edge.id), eq(TreeEdge.user_id, userId)));
  }
}

async function getNodeById({
  db,
  nodeId,
  userId,
}: {
  db: Db;
  nodeId: string;
  userId: string;
}) {
  return await db.query.TreeNode.findFirst({
    where: and(eq(TreeNode.id, nodeId), eq(TreeNode.user_id, userId)),
  });
}

async function getEdgeById({
  db,
  edgeId,
  userId,
}: {
  db: Db;
  edgeId: string;
  userId: string;
}) {
  return await db.query.TreeEdge.findFirst({
    where: and(eq(TreeEdge.id, edgeId), eq(TreeEdge.user_id, userId)),
  });
}

async function findHeadEdge({
  db,
  excludeEdgeId,
  parentNodeId,
  userId,
}: {
  db: Db;
  excludeEdgeId?: string;
  parentNodeId: string | null;
  userId: string;
}) {
  return await db.query.TreeEdge.findFirst({
    columns: {
      id: true,
    },
    where: and(
      eq(TreeEdge.user_id, userId),
      isNull(TreeEdge.prev_edge_id),
      parentNodeId === null
        ? isNull(TreeEdge.parent_node_id)
        : eq(TreeEdge.parent_node_id, parentNodeId),
      excludeEdgeId ? ne(TreeEdge.id, excludeEdgeId) : undefined,
    ),
  });
}

async function assertDestinationParent({
  db,
  parentNodeId,
  userId,
}: {
  db: Db;
  parentNodeId: string | null;
  userId: string;
}) {
  if (!parentNodeId) {
    return;
  }

  const parent = await getNodeById({
    db,
    nodeId: parentNodeId,
    userId,
  });

  if (!parent) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Destination parent node not found",
    });
  }

  if (parent.node_type !== "folder") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Destination parent node must be a folder",
    });
  }
}

async function writeEdgePlacement({
  db,
  edgeId,
  nodeId,
  parentNodeId,
  prevEdgeId,
  nextEdgeId,
  userId,
}: {
  db: Db;
  edgeId?: string;
  nodeId: string;
  parentNodeId: string | null;
  prevEdgeId: string | null;
  nextEdgeId: string | null;
  userId: string;
}) {
  if (edgeId) {
    const [updatedEdge] = await db
      .update(TreeEdge)
      .set({
        next_edge_id: nextEdgeId,
        node_id: nodeId,
        parent_node_id: parentNodeId,
        prev_edge_id: prevEdgeId,
      })
      .where(and(eq(TreeEdge.id, edgeId), eq(TreeEdge.user_id, userId)))
      .returning();

    if (!updatedEdge) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Edge not found",
      });
    }

    return updatedEdge;
  }

  const [insertedEdge] = await db
    .insert(TreeEdge)
    .values({
      next_edge_id: nextEdgeId,
      node_id: nodeId,
      parent_node_id: parentNodeId,
      prev_edge_id: prevEdgeId,
      user_id: userId,
    })
    .returning();

  if (!insertedEdge) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to place tree edge",
    });
  }

  return insertedEdge;
}

export async function insertEdgeAtPosition(
  input: Parameters<typeof insertPreparedEdge>[0],
) {
  await lockTreeOwner(input.db, input.userId);
  await assertDestinationParent({
    db: input.db,
    parentNodeId: input.parentNodeId,
    userId: input.userId,
  });
  await repairSiblingOrder(
    input.db,
    input.userId,
    input.parentNodeId,
    input.edgeId,
  );
  return insertPreparedEdge(input);
}

async function insertPreparedEdge({
  anchorEdgeId,
  db,
  edgeId,
  nodeId,
  parentNodeId,
  position = "before",
  userId,
}: {
  anchorEdgeId?: string;
  db: Db;
  edgeId?: string;
  nodeId: string;
  parentNodeId: string | null;
  position?: "after" | "before";
  userId: string;
}) {
  let placingEdgeId = edgeId;
  if (!placingEdgeId) {
    const [insertedEdge] = await db
      .insert(TreeEdge)
      .values({
        next_edge_id: null,
        node_id: nodeId,
        parent_node_id: parentNodeId,
        prev_edge_id: null,
        user_id: userId,
      })
      .returning({
        id: TreeEdge.id,
      });

    if (!insertedEdge) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to initialize tree edge",
      });
    }

    placingEdgeId = insertedEdge.id;
  }

  if (!anchorEdgeId) {
    const boundaryEdge =
      position === "after"
        ? await db.query.TreeEdge.findFirst({
            columns: { id: true },
            where: and(
              eq(TreeEdge.user_id, userId),
              isNull(TreeEdge.next_edge_id),
              parentNodeId === null
                ? isNull(TreeEdge.parent_node_id)
                : eq(TreeEdge.parent_node_id, parentNodeId),
              ne(TreeEdge.id, placingEdgeId),
            ),
          })
        : await findHeadEdge({
            db,
            excludeEdgeId: placingEdgeId,
            parentNodeId,
            userId,
          });

    if (boundaryEdge) {
      await db
        .update(TreeEdge)
        .set({
          ...(position === "after"
            ? { next_edge_id: placingEdgeId }
            : { prev_edge_id: placingEdgeId }),
        })
        .where(
          and(eq(TreeEdge.id, boundaryEdge.id), eq(TreeEdge.user_id, userId)),
        );
    }

    return await writeEdgePlacement({
      db,
      edgeId: placingEdgeId,
      nextEdgeId: position === "after" ? null : (boundaryEdge?.id ?? null),
      nodeId,
      parentNodeId,
      prevEdgeId: position === "after" ? (boundaryEdge?.id ?? null) : null,
      userId,
    });
  }

  const anchorEdge = await getEdgeById({
    db,
    edgeId: anchorEdgeId,
    userId,
  });

  if (!anchorEdge) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Anchor edge not found",
    });
  }

  if (edgeId && anchorEdge.id === edgeId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Anchor edge must differ from moving edge",
    });
  }

  if (anchorEdge.parent_node_id !== parentNodeId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Anchor edge parent does not match destination",
    });
  }

  if (position === "before") {
    if (anchorEdge.prev_edge_id) {
      await db
        .update(TreeEdge)
        .set({
          next_edge_id: placingEdgeId,
        })
        .where(
          and(
            eq(TreeEdge.id, anchorEdge.prev_edge_id),
            eq(TreeEdge.user_id, userId),
          ),
        );
    }

    await db
      .update(TreeEdge)
      .set({
        prev_edge_id: placingEdgeId,
      })
      .where(and(eq(TreeEdge.id, anchorEdge.id), eq(TreeEdge.user_id, userId)));

    return await writeEdgePlacement({
      db,
      edgeId: placingEdgeId,
      nextEdgeId: anchorEdge.id,
      nodeId,
      parentNodeId,
      prevEdgeId: anchorEdge.prev_edge_id ?? null,
      userId,
    });
  }

  if (anchorEdge.next_edge_id) {
    await db
      .update(TreeEdge)
      .set({
        prev_edge_id: placingEdgeId,
      })
      .where(
        and(
          eq(TreeEdge.id, anchorEdge.next_edge_id),
          eq(TreeEdge.user_id, userId),
        ),
      );
  }

  await db
    .update(TreeEdge)
    .set({
      next_edge_id: placingEdgeId,
    })
    .where(and(eq(TreeEdge.id, anchorEdge.id), eq(TreeEdge.user_id, userId)));

  return await writeEdgePlacement({
    db,
    edgeId: placingEdgeId,
    nextEdgeId: anchorEdge.next_edge_id ?? null,
    nodeId,
    parentNodeId,
    prevEdgeId: anchorEdge.id,
    userId,
  });
}

export async function detachEdge({
  db,
  edgeId,
  userId,
}: {
  db: Db;
  edgeId: string;
  userId: string;
}) {
  await lockTreeOwner(db, userId);
  const edge = await getEdgeById({
    db,
    edgeId,
    userId,
  });

  if (!edge) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tree edge not found",
    });
  }

  await repairSiblingOrder(db, userId, edge.parent_node_id);
  const currentEdge = (await getEdgeById({ db, edgeId, userId })) ?? edge;

  return detachPreparedEdge(db, currentEdge, userId);
}

async function detachPreparedEdge(
  db: Db,
  currentEdge: OrderedEdge,
  userId: string,
) {
  const edgeId = currentEdge.id;

  await db
    .update(TreeEdge)
    .set({
      next_edge_id: null,
      parent_node_id: null,
      prev_edge_id: null,
    })
    .where(and(eq(TreeEdge.id, edgeId), eq(TreeEdge.user_id, userId)));

  if (currentEdge.prev_edge_id) {
    await db
      .update(TreeEdge)
      .set({
        next_edge_id: currentEdge.next_edge_id,
      })
      .where(
        and(
          eq(TreeEdge.id, currentEdge.prev_edge_id),
          eq(TreeEdge.user_id, userId),
        ),
      );
  }

  if (currentEdge.next_edge_id) {
    await db
      .update(TreeEdge)
      .set({
        prev_edge_id: currentEdge.prev_edge_id,
      })
      .where(
        and(
          eq(TreeEdge.id, currentEdge.next_edge_id),
          eq(TreeEdge.user_id, userId),
        ),
      );
  }

  // Steps 4-5: Clean up any remaining stale references to the detached edge.
  // In clean data these match zero rows. With bidirectional inconsistencies,
  // they prevent cascading self-reference / unique constraint violations during moveItem.

  // Step 4: Null out stale next_edge_id pointing to detached edge
  await db
    .update(TreeEdge)
    .set({ next_edge_id: null })
    .where(
      and(eq(TreeEdge.next_edge_id, edgeId), eq(TreeEdge.user_id, userId)),
    );

  // Step 5: Null out stale prev_edge_id pointing to detached edge
  await db
    .update(TreeEdge)
    .set({ prev_edge_id: null })
    .where(
      and(eq(TreeEdge.prev_edge_id, edgeId), eq(TreeEdge.user_id, userId)),
    );

  return currentEdge;
}

async function isNodeDescendantOf({
  db,
  maybeDescendantNodeId,
  maybeAncestorNodeId,
  userId,
}: {
  db: Db;
  maybeDescendantNodeId: string;
  maybeAncestorNodeId: string;
  userId: string;
}) {
  let currentNodeId: string | null = maybeDescendantNodeId;
  const visited = new Set<string>();

  while (currentNodeId) {
    if (currentNodeId === maybeAncestorNodeId) {
      return true;
    }

    if (visited.has(currentNodeId)) {
      return true;
    }
    visited.add(currentNodeId);

    const parentEdge:
      | Pick<typeof TreeEdge.$inferSelect, "parent_node_id">
      | undefined = await db.query.TreeEdge.findFirst({
      columns: {
        parent_node_id: true,
      },
      where: and(
        eq(TreeEdge.user_id, userId),
        eq(TreeEdge.node_id, currentNodeId),
      ),
    });

    currentNodeId = parentEdge?.parent_node_id ?? null;
  }

  return false;
}

export async function moveNode({
  db,
  destination,
  nodeId,
  userId,
}: {
  db: Db;
  destination: TreeDestination;
  nodeId: string;
  userId: string;
}) {
  await lockTreeOwner(db, userId);
  const node = await getNodeById({
    db,
    nodeId,
    userId,
  });

  if (!node) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tree node not found",
    });
  }

  let existingEdge = await db.query.TreeEdge.findFirst({
    where: and(eq(TreeEdge.user_id, userId), eq(TreeEdge.node_id, nodeId)),
  });

  if (!existingEdge) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tree node edge not found",
    });
  }

  await repairSiblingOrder(db, userId, existingEdge.parent_node_id);
  existingEdge =
    (await getEdgeById({ db, edgeId: existingEdge.id, userId })) ??
    existingEdge;

  if (node.node_type === "folder" && destination.parent_node_id) {
    if (destination.parent_node_id === nodeId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A folder cannot be moved into itself",
      });
    }

    const destinationIsDescendant = await isNodeDescendantOf({
      db,
      maybeAncestorNodeId: nodeId,
      maybeDescendantNodeId: destination.parent_node_id,
      userId,
    });

    if (destinationIsDescendant) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A folder cannot be moved into one of its descendants",
      });
    }
  }

  const isNoopMove =
    !destination.anchor_edge_id &&
    existingEdge.parent_node_id === destination.parent_node_id &&
    (destination.position === "after"
      ? existingEdge.next_edge_id === null
      : existingEdge.prev_edge_id === null);
  if (isNoopMove) {
    return existingEdge;
  }

  if (destination.anchor_edge_id) {
    const anchorEdge = await getEdgeById({
      db,
      edgeId: destination.anchor_edge_id,
      userId,
    });

    if (!anchorEdge) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Anchor edge not found",
      });
    }

    if (
      anchorEdge.parent_node_id === destination.parent_node_id &&
      existingEdge.parent_node_id === destination.parent_node_id
    ) {
      if (
        destination.position === "before" &&
        (existingEdge.next_edge_id === anchorEdge.id ||
          existingEdge.id === anchorEdge.id)
      ) {
        return existingEdge;
      }

      if (
        destination.position === "after" &&
        (existingEdge.prev_edge_id === anchorEdge.id ||
          existingEdge.id === anchorEdge.id)
      ) {
        return existingEdge;
      }
    }
  }

  await assertDestinationParent({
    db,
    parentNodeId: destination.parent_node_id,
    userId,
  });
  if (destination.parent_node_id !== existingEdge.parent_node_id) {
    await repairSiblingOrder(db, userId, destination.parent_node_id);
  }
  await detachPreparedEdge(db, existingEdge, userId);

  return await insertPreparedEdge({
    anchorEdgeId: destination.anchor_edge_id,
    db,
    edgeId: existingEdge.id,
    nodeId,
    parentNodeId: destination.parent_node_id,
    position: destination.position,
    userId,
  });
}

export async function orderedChildren({
  cursorEdgeId,
  db,
  limit,
  parentNodeId,
  userId,
}: {
  cursorEdgeId?: string;
  db: Db;
  limit: number;
  parentNodeId: string | null;
  userId: string;
}) {
  const edges = await db
    .select({
      id: TreeEdge.id,
      next_edge_id: TreeEdge.next_edge_id,
      node_id: TreeEdge.node_id,
      parent_node_id: TreeEdge.parent_node_id,
      prev_edge_id: TreeEdge.prev_edge_id,
    })
    .from(TreeEdge)
    .where(
      and(
        eq(TreeEdge.user_id, userId),
        parentNodeId === null
          ? isNull(TreeEdge.parent_node_id)
          : eq(TreeEdge.parent_node_id, parentNodeId),
      ),
    )
    .orderBy(TreeEdge.created_at, TreeEdge.id);

  const ordered = orderSiblingEdges(edges);
  return paginateOrderedEdges(ordered, cursorEdgeId, limit);
}

/** Cursor revision detects changes between requests, including moves in another tab. */
export function paginateOrderedEdges<T extends { id: string }>(
  ordered: T[],
  cursor: string | undefined,
  limit: number,
) {
  const revision = createHash("sha256")
    .update(ordered.map((edge) => edge.id).join(","))
    .digest("hex");
  const [edgeId, cursorRevision] = cursor?.split("|") ?? [];
  const cursorIndex = edgeId
    ? ordered.findIndex((edge) => edge.id === edgeId)
    : -1;
  const resetRequired =
    !!cursor &&
    (cursorIndex < 0 || (!!cursorRevision && cursorRevision !== revision));
  const startIndex = cursor && !resetRequired ? cursorIndex + 1 : 0;
  const paginated = ordered.slice(startIndex, startIndex + limit + 1);
  const hasNextPage = paginated.length > limit;
  const items = hasNextPage ? paginated.slice(0, limit) : paginated;

  return {
    edges: items,
    nextCursor: hasNextPage ? `${items.at(-1)?.id}|${revision}` : undefined,
    resetRequired,
  };
}
