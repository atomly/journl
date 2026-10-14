import { randomUUID } from "node:crypto";
import { eq } from "@acme/db";
import * as schema from "@acme/db/schema";
import { beforeEach, expect, test } from "vitest";
import {
  detachDocumentPageEdges,
  insertEdgeAtPosition,
  moveNode,
  orderedChildren,
} from "~/trpc/procedures/tree-helpers";
import { queueFolderDeletionCleanup } from "~/workflows/folder-deletion-queue";
import { createPostgresFixture } from "../helpers/postgres";

const { client, db, queries } = createPostgresFixture({
  Document: schema.Document,
  Folder: schema.Folder,
  FolderDeletionOutbox: schema.FolderDeletionOutbox,
  Page: schema.Page,
  TreeEdge: schema.TreeEdge,
  TreeNode: schema.TreeNode,
  user: schema.user,
});
const integration = test;
const owner = "tree-order-fixture";
const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const folderId = randomUUID();

beforeEach(async () => {
  await client.unsafe(
    'TRUNCATE tree_edge, tree_node, page, document, folder, folder_deletion_outbox, "user" CASCADE',
  );
  await db
    .insert(schema.user)
    .values({ email: "tree@example.invalid", id: owner, name: "Tree fixture" });
  await client`INSERT INTO folder (id, user_id, name) VALUES (${folderId}, ${owner}, 'Fixture folder')`;
  await client`INSERT INTO tree_node (id, user_id, node_type, folder_id) VALUES (${folderId}, ${owner}, 'folder', ${folderId})`;
  for (const id of ids) {
    await client`INSERT INTO document (id, user_id) VALUES (${id}, ${owner})`;
    await client`INSERT INTO page (id, document_id, user_id, title) VALUES (${id}, ${id}, ${owner}, ${id})`;
    await client`INSERT INTO tree_node (id, user_id, node_type, page_id) VALUES (${id}, ${owner}, 'page', ${id})`;
    await db.transaction((tx) =>
      insertEdgeAtPosition({
        db: tx,
        nodeId: id,
        parentNodeId: null,
        position: "after",
        userId: owner,
      }),
    );
  }
});

async function read(parentNodeId: string | null = null) {
  const result = await orderedChildren({
    db,
    limit: 50,
    parentNodeId,
    userId: owner,
  });
  const edges = result.edges;
  for (const [index, edge] of edges.entries()) {
    expect(edge.prev_edge_id).toBe(edges[index - 1]?.id ?? null);
    expect(edge.next_edge_id).toBe(edges[index + 1]?.id ?? null);
  }
  return edges;
}

integration(
  "a healthy move locks once and repairs each affected container once",
  async () => {
    for (const parentNodeId of [null, folderId]) {
      queries.length = 0;
      await db.transaction((tx) =>
        moveNode({
          db: tx,
          destination: { parent_node_id: parentNodeId, position: "after" },
          nodeId: ids[0] ?? "",
          userId: owner,
        }),
      );
      expect(
        queries.filter((query) => query.includes("for no key update")),
      ).toHaveLength(1);
      expect(
        queries.filter((query) =>
          query.includes('order by "tree_edge"."created_at"'),
        ),
      ).toHaveLength(parentNodeId === null ? 1 : 2);
    }
  },
);

integration(
  "deletion and its durable cleanup request commit or roll back together",
  async () => {
    const documentId = ids[0] ?? "";
    await expect(
      db.transaction(async (tx) => {
        await detachDocumentPageEdges(tx, documentId, owner);
        await tx
          .delete(schema.TreeEdge)
          .where(eq(schema.TreeEdge.node_id, documentId));
        await queueFolderDeletionCleanup(
          tx,
          {
            documentIds: [documentId],
            folderIds: [],
            subtreeNodeIds: [documentId],
          },
          owner,
        );
        throw new Error("Injected transaction failure");
      }),
    ).rejects.toThrow("Injected transaction failure");
    expect((await read()).map((edge) => edge.node_id)).toEqual(ids);
    expect(await db.select().from(schema.FolderDeletionOutbox)).toEqual([]);
    await db.transaction(async (tx) => {
      await detachDocumentPageEdges(tx, documentId, owner);
      await tx
        .delete(schema.TreeEdge)
        .where(eq(schema.TreeEdge.node_id, documentId));
      await queueFolderDeletionCleanup(
        tx,
        {
          documentIds: [documentId],
          folderIds: [],
          subtreeNodeIds: [documentId],
        },
        owner,
      );
    });
    expect((await read()).map((edge) => edge.node_id)).toEqual(ids.slice(1));
    const jobs = await db.select().from(schema.FolderDeletionOutbox);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.payload.documentIds).toEqual([documentId]);
    expect(jobs[0]?.dispatched_at).toBeNull();
  },
);

integration(
  "a concurrent reorder invalidates the next page cursor",
  async () => {
    const first = await orderedChildren({
      db,
      limit: 2,
      parentNodeId: null,
      userId: owner,
    });
    await db.transaction((tx) =>
      moveNode({
        db: tx,
        destination: { parent_node_id: null, position: "after" },
        nodeId: ids[1] ?? "",
        userId: owner,
      }),
    );
    const second = await orderedChildren({
      cursorEdgeId: first.nextCursor,
      db,
      limit: 2,
      parentNodeId: null,
      userId: owner,
    });
    expect(second.resetRequired).toBe(true);
    expect(second.edges.map((edge) => edge.node_id)).toEqual([ids[0], ids[2]]);
  },
);

integration(
  "paginating a fresh read after a bottom move yields every node exactly once",
  async () => {
    await db.transaction((tx) =>
      moveNode({
        db: tx,
        destination: { parent_node_id: null, position: "after" },
        nodeId: ids[0] ?? "",
        userId: owner,
      }),
    );
    const first = await orderedChildren({
      db,
      limit: 2,
      parentNodeId: null,
      userId: owner,
    });
    const second = await orderedChildren({
      cursorEdgeId: first.nextCursor,
      db,
      limit: 2,
      parentNodeId: null,
      userId: owner,
    });
    expect(
      [...first.edges, ...second.edges].map((edge) => edge.node_id),
    ).toEqual([...ids.slice(1), ids[0]]);
    expect(second.nextCursor).toBeUndefined();
  },
);

integration(
  "an invalid destination rolls back without damaging the original chain",
  async () => {
    await expect(
      db.transaction((tx) =>
        moveNode({
          db: tx,
          destination: { parent_node_id: randomUUID(), position: "after" },
          nodeId: ids[0] ?? "",
          userId: owner,
        }),
      ),
    ).rejects.toThrow("Destination parent node not found");
    expect((await read()).map((edge) => edge.node_id)).toEqual(ids);
  },
);

integration(
  "a move repairs strands broken by an older cascading page deletion",
  async () => {
    await db
      .delete(schema.Document)
      .where(eq(schema.Document.id, ids[1] ?? ""));
    await db.transaction((tx) =>
      moveNode({
        db: tx,
        destination: { parent_node_id: null, position: "after" },
        nodeId: ids[2] ?? "",
        userId: owner,
      }),
    );
    expect((await read()).map((edge) => edge.node_id)).toEqual([
      ids[0],
      ids[3],
      ids[2],
    ]);
  },
);

integration(
  "moving the head to the bottom is persisted in a fresh read",
  async () => {
    const original = await read();
    await db.transaction((tx) =>
      moveNode({
        db: tx,
        destination: {
          anchor_edge_id: original[3]?.id,
          parent_node_id: null,
          position: "after",
        },
        nodeId: ids[0] ?? "",
        userId: owner,
      }),
    );
    expect((await read()).map((edge) => edge.node_id)).toEqual([
      ...ids.slice(1),
      ids[0],
    ]);
  },
);

integration(
  "an unanchored bottom drop appends and repeated tail drops are no-ops",
  async () => {
    for (let i = 0; i < 2; i++) {
      await db.transaction((tx) =>
        moveNode({
          db: tx,
          destination: { parent_node_id: null, position: "after" },
          nodeId: ids[0] ?? "",
          userId: owner,
        }),
      );
    }
    expect((await read()).map((edge) => edge.node_id)).toEqual([
      ...ids.slice(1),
      ids[0],
    ]);
  },
);

integration(
  "moving between folders preserves both sibling chains",
  async () => {
    for (const id of ids.slice(0, 2)) {
      await db.transaction((tx) =>
        moveNode({
          db: tx,
          destination: { parent_node_id: folderId, position: "after" },
          nodeId: id,
          userId: owner,
        }),
      );
    }
    expect((await read()).map((edge) => edge.node_id)).toEqual(ids.slice(2));
    expect((await read(folderId)).map((edge) => edge.node_id)).toEqual(
      ids.slice(0, 2),
    );
  },
);

integration(
  "deleting a middle page reconnects siblings before its document cascades",
  async () => {
    const documentId = ids[1] ?? "";
    await db.transaction(async (tx) => {
      await detachDocumentPageEdges(tx, documentId, owner);
      await tx
        .delete(schema.Document)
        .where(eq(schema.Document.id, documentId));
    });
    expect((await read()).map((edge) => edge.node_id)).toEqual([
      ids[0],
      ids[2],
      ids[3],
    ]);
    await db.transaction((tx) =>
      moveNode({
        db: tx,
        destination: { parent_node_id: null, position: "after" },
        nodeId: ids[0] ?? "",
        userId: owner,
      }),
    );
    expect((await read()).map((edge) => edge.node_id)).toEqual([
      ids[2],
      ids[3],
      ids[0],
    ]);
  },
);

integration(
  "overlapping root moves preserve a single complete linked list",
  async () => {
    await Promise.all(
      ids.slice(0, 3).map((id) =>
        db.transaction((tx) =>
          moveNode({
            db: tx,
            destination: { parent_node_id: null, position: "after" },
            nodeId: id,
            userId: owner,
          }),
        ),
      ),
    );
    const edges = await read();
    expect(edges).toHaveLength(4);
    expect(new Set(edges.map((edge) => edge.node_id))).toEqual(new Set(ids));
    expect(edges[0]?.node_id).toBe(ids[3]);
  },
);
