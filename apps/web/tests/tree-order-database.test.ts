import { randomUUID } from "node:crypto";
import { eq } from "@acme/db";
import * as schema from "@acme/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import {
  detachDocumentPageEdges,
  insertEdgeAtPosition,
  moveNode,
  orderedChildren,
} from "~/trpc/procedures/tree-helpers";

// biome-ignore lint/style/noProcessEnv: opt-in disposable PostgreSQL integration fixture.
const url = process.env.TREE_TEST_POSTGRES_URL;
const integration = test.skipIf(!url);
const namespace = `tree_test_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url ?? "postgres://localhost/unused", {
  connection: { search_path: namespace },
  max: 8,
});
const db = drizzle(client, { casing: "snake_case", schema });
const owner = "tree-order-fixture";
const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const folderId = randomUUID();

beforeAll(async () => {
  if (!url) return;
  await client.unsafe(`CREATE SCHEMA ${namespace}`);
  // Minimal tables with the same tree pointer, uniqueness, and cascade constraints.
  await client.unsafe(`
    CREATE TABLE "user" (id text PRIMARY KEY);
    CREATE TABLE document (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user");
    CREATE TABLE page (id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES document ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES "user", title text NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE folder (id uuid PRIMARY KEY);
    CREATE TABLE tree_node (id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user", node_type text NOT NULL,
      page_id uuid REFERENCES page ON DELETE CASCADE, folder_id uuid REFERENCES folder ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE tree_edge (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES "user",
      node_id uuid NOT NULL REFERENCES tree_node ON DELETE CASCADE, parent_node_id uuid REFERENCES tree_node ON DELETE CASCADE,
      prev_edge_id uuid REFERENCES tree_edge ON DELETE SET NULL, next_edge_id uuid REFERENCES tree_edge ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
      UNIQUE(user_id, node_id), CHECK(id <> prev_edge_id), CHECK(id <> next_edge_id));
    CREATE UNIQUE INDEX tree_prev_unique ON tree_edge(user_id, parent_node_id, prev_edge_id) WHERE prev_edge_id IS NOT NULL;
    CREATE UNIQUE INDEX tree_next_unique ON tree_edge(user_id, parent_node_id, next_edge_id) WHERE next_edge_id IS NOT NULL;
  `);
});

beforeEach(async () => {
  if (!url) return;
  await client.unsafe(
    'TRUNCATE tree_edge, tree_node, page, document, folder, "user" CASCADE',
  );
  await client`INSERT INTO "user" VALUES (${owner})`;
  await client`INSERT INTO folder VALUES (${folderId})`;
  await client`INSERT INTO tree_node (id, user_id, node_type, folder_id) VALUES (${folderId}, ${owner}, 'folder', ${folderId})`;
  for (const id of ids) {
    await client`INSERT INTO document VALUES (${id}, ${owner})`;
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

afterAll(async () => {
  if (url) await client.unsafe(`DROP SCHEMA ${namespace} CASCADE`);
  await client.end();
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
