import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import * as schema from "@acme/db/schema";
import { documentRows } from "@acme/document";
import { parityBlocks } from "@acme/document/fixtures";
import { ALGORITHM_VERSION } from "@acme/graph/config";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { insertEdgeAtPosition } from "../../trpc/procedures/tree-helpers";
import { createTestTables } from "../postgres-schema";
import { browserFixture as data, fixtureId } from "./data";

// No environment file or supplied database URL is consulted. This server owns its database.
const container = await new PostgreSqlContainer("pgvector/pgvector:pg17")
  .withDatabase("journl_browser")
  .withStartupTimeout(120000)
  .start();
const client = postgres(container.getConnectionUri(), { max: 1 });
let child: ReturnType<typeof spawn> | undefined;
let stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await once(child, "exit");
  }
  try {
    await client.end({ timeout: 5 });
  } finally {
    await container.stop();
  }
}
process.once("SIGTERM", () => {
  void cleanup().then(() => process.exit(0));
});
process.once("SIGINT", () => {
  void cleanup().then(() => process.exit(0));
});
try {
  await client.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
  await createTestTables(client, schema);
  const db = drizzle(client, { casing: "snake_case", schema });
  const password = await hashPassword(data.password);
  await db.insert(schema.user).values([
    {
      email: data.email,
      emailVerified: true,
      id: data.owner,
      name: "Browser owner",
    },
    {
      email: data.otherEmail,
      emailVerified: true,
      id: data.otherOwner,
      name: "Other owner",
    },
    {
      email: data.paginationEmail,
      emailVerified: true,
      id: data.paginationOwner,
      name: "Pagination owner",
    },
  ]);
  await db.insert(schema.Plan).values({
    displayName: "Browser Pro",
    id: "browser-pro",
    name: "browser-pro",
    quota: 1000000,
  });
  await db.insert(schema.Price).values({
    currency: "usd",
    id: "browser-pro-price",
    planId: "browser-pro",
    recurring: { interval: "month", intervalCount: 1 },
    type: "recurring",
    unitAmount: 1000,
  });
  await db.insert(schema.Subscription).values({
    id: "browser-subscription",
    periodEnd: new Date("2099-01-01"),
    periodStart: new Date("2026-01-01"),
    planName: "browser-pro",
    referenceId: data.owner,
    status: "active",
  });
  await db.insert(schema.account).values(
    [data.owner, data.otherOwner, data.paginationOwner].map((id) => ({
      accountId: id,
      createdAt: new Date(),
      id,
      password,
      providerId: "credential",
      updatedAt: new Date(),
      userId: id,
    })),
  );
  // The second Entries page contains a real unsupported stored document, followed
  // by healthy content. It must not fail the page or mount an empty writable editor.
  for (let index = 0; index < 12; index++) {
    const documentId = fixtureId(900 + index);
    await db
      .insert(schema.Document)
      .values({ id: documentId, user_id: data.paginationOwner });
    await db.insert(schema.JournalEntry).values({
      date: `2020-01-${String(31 - index).padStart(2, "0")}`,
      document_id: documentId,
      user_id: data.paginationOwner,
    });
    await db.insert(schema.BlockNode).values({
      data: {
        content: `Pagination entry ${index + 1}`,
        type: index === 10 ? "futureBlock" : "paragraph",
      },
      document_id: documentId,
      id: fixtureId(950 + index),
      user_id: data.paginationOwner,
    });
  }
  // A real stored long document keeps browser acceptance focused on editing,
  // scrolling and persistence instead of racing dozens of synthetic key presses.
  const longDocumentId = fixtureId(700);
  const inventoryId = fixtureId(980);
  await db
    .insert(schema.Document)
    .values({ id: inventoryId, user_id: data.paginationOwner });
  await db.insert(schema.Page).values({
    document_id: inventoryId,
    id: inventoryId,
    title: "Tiptap preservation inventory",
    user_id: data.paginationOwner,
  });
  await db.insert(schema.TreeNode).values({
    id: inventoryId,
    node_type: "page",
    page_id: inventoryId,
    user_id: data.paginationOwner,
  });
  await db.insert(schema.TreeEdge).values({
    id: fixtureId(981),
    node_id: inventoryId,
    user_id: data.paginationOwner,
  });
  const inventory = documentRows(parityBlocks);
  for (const block of inventory.blocks)
    await db.insert(schema.BlockNode).values({
      ...block,
      document_id: inventoryId,
      user_id: data.paginationOwner,
    });
  await db.insert(schema.BlockEdge).values(
    inventory.edges.map((edge) => ({
      ...edge,
      document_id: inventoryId,
      user_id: data.paginationOwner,
    })),
  );
  const structuralId = fixtureId(982);
  await db
    .insert(schema.Document)
    .values({ id: structuralId, user_id: data.paginationOwner });
  await db.insert(schema.Page).values({
    document_id: structuralId,
    id: structuralId,
    title: "Structural editing",
    user_id: data.paginationOwner,
  });
  await db.insert(schema.TreeNode).values({
    id: structuralId,
    node_type: "page",
    page_id: structuralId,
    user_id: data.paginationOwner,
  });
  await db.transaction((tx) =>
    insertEdgeAtPosition({
      db: tx,
      nodeId: structuralId,
      parentNodeId: null,
      position: "after",
      userId: data.paginationOwner,
    }),
  );
  const structural = documentRows([
    {
      content: "Original heading",
      id: fixtureId(983),
      props: { level: 1 },
      type: "heading",
    },
    {
      children: [
        { content: "Existing child", id: fixtureId(985), type: "paragraph" },
      ],
      content: [
        {
          props: {
            blockId: parityBlocks[0].id,
            documentId: inventoryId,
            label: "Stored reference",
            resolutionToken: "",
            targetKind: "document",
            url: `/pages/${inventoryId}#block=${parityBlocks[0].id}`,
            version: 1,
          },
          type: "contentReference",
        },
      ],
      id: fixtureId(984),
      type: "paragraph",
    },
    {
      content: {
        rows: [
          { cells: ["First cell", "Second cell"] },
          { cells: ["Third cell", "Fourth cell"] },
        ],
        type: "tableContent",
      },
      id: fixtureId(987),
      type: "table",
    },
  ]);
  for (const block of structural.blocks)
    await db.insert(schema.BlockNode).values({
      ...block,
      document_id: structuralId,
      user_id: data.paginationOwner,
    });
  await db.insert(schema.BlockEdge).values(
    structural.edges.map((edge) => ({
      ...edge,
      document_id: structuralId,
      user_id: data.paginationOwner,
    })),
  );
  for (const pageNumber of [1000, 1010]) {
    const id = fixtureId(pageNumber);
    const ids = new Map(
      [983, 984, 985, 987].map((source, index) => [
        fixtureId(source),
        fixtureId(pageNumber + index + 1),
      ]),
    );
    const remap = (source: string) => {
      const target = ids.get(source);
      if (!target) throw new Error("Writing fixture block is missing");
      return target;
    };
    await db
      .insert(schema.Document)
      .values({ id, user_id: data.paginationOwner });
    await db.insert(schema.Page).values({
      document_id: id,
      id,
      title: "Writing controls",
      user_id: data.paginationOwner,
    });
    await db.insert(schema.TreeNode).values({
      id,
      node_type: "page",
      page_id: id,
      user_id: data.paginationOwner,
    });
    await db.transaction((tx) =>
      insertEdgeAtPosition({
        db: tx,
        nodeId: id,
        parentNodeId: null,
        position: "after",
        userId: data.paginationOwner,
      }),
    );
    for (const row of structural.blocks)
      await db.insert(schema.BlockNode).values({
        ...row,
        document_id: id,
        id: remap(row.id),
        parent_id: row.parent_id ? remap(row.parent_id) : null,
        user_id: data.paginationOwner,
      });
    await db.insert(schema.BlockEdge).values(
      structural.edges.map((edge) => ({
        ...edge,
        document_id: id,
        from_id: remap(edge.from_id),
        to_id: remap(edge.to_id),
        user_id: data.paginationOwner,
      })),
    );
  }
  await db
    .insert(schema.Document)
    .values({ id: longDocumentId, user_id: data.owner });
  await db.insert(schema.JournalEntry).values({
    date: data.longJournalDate,
    document_id: longDocumentId,
    user_id: data.owner,
  });
  const journalBlocks = Array.from({ length: 60 }, (_, index) =>
    fixtureId(701 + index),
  );
  await db.insert(schema.BlockNode).values(
    journalBlocks.map((id, index) => ({
      data: {
        content: [
          {
            styles: {},
            text: `Paragraph ${index + 1}: a long journal entry for real editor acceptance.`,
            type: "text",
          },
        ],
        props: {},
        type: "paragraph",
      },
      document_id: longDocumentId,
      id,
      user_id: data.owner,
    })),
  );
  await db.insert(schema.BlockEdge).values(
    journalBlocks.slice(1).map((id, index) => ({
      document_id: longDocumentId,
      from_id: fixtureId(701 + index),
      to_id: id,
      type: "sibling" as const,
      user_id: data.owner,
    })),
  );
  const notes = Array.from({ length: 28 }, (_, n) => fixtureId(n + 1));
  await db
    .insert(schema.Document)
    .values(notes.map((id) => ({ id, user_id: data.owner })));
  await db.insert(schema.Page).values(
    notes.map((id, n) => ({
      document_id: id,
      id,
      title: `Browser note ${String(n + 1).padStart(2, "0")}`,
      user_id: data.owner,
    })),
  );
  await db.insert(schema.BlockNode).values(
    notes.map((id, n) => ({
      data: {
        content: [{ text: `Authored passage ${n + 1}`, type: "text" }],
        props: {},
        type: "paragraph",
      },
      document_id: id,
      id: fixtureId(n + 101),
      user_id: data.owner,
    })),
  );
  await db.insert(schema.BlockSearchText).values(
    notes.map((id, n) => ({
      block_id: fixtureId(n + 101),
      document_id: id,
      search_text: `Authored passage ${n + 1}`,
      user_id: data.owner,
    })),
  );
  await db.insert(schema.DocumentReference).values({
    id: fixtureId(201),
    occurrence_path: "/0",
    presentation: "link",
    source_block_id: fixtureId(101),
    source_document_id: fixtureId(1),
    target_document_id: fixtureId(2),
    target_key: `document:${notes[1]}`,
    target_kind: "document",
    user_id: data.owner,
  });
  for (const [owner, snapshot] of [
    [data.owner, fixtureId(301)],
    [data.otherOwner, fixtureId(302)],
  ] as const) {
    await db.insert(schema.ExploreSnapshot).values({
      algorithm_version: ALGORITHM_VERSION,
      id: snapshot,
      source_revision: 1,
      user_id: owner,
    });
    await db.insert(schema.ExploreState).values({
      active_snapshot_id: snapshot,
      published_revision: 1,
      source_revision: 1,
      user_id: owner,
    });
  }
  await db
    .insert(schema.ExploreCluster)
    .values({ id: data.cluster, user_id: data.owner });
  await db.insert(schema.ExploreClusterSnapshot).values({
    cluster_id: data.cluster,
    generated_name: "Browser thread",
    primary_count: 2,
    related_count: 0,
    representatives: notes.slice(0, 2),
    snapshot_id: fixtureId(301),
    source_count: 0,
    user_id: data.owner,
  });
  await db.insert(schema.ExploreClusterMember).values(
    notes.slice(0, 2).map((id) => ({
      cluster_id: data.cluster,
      document_id: id,
      evidence_ids: [fixtureId(201)],
      role: "primary",
      snapshot_id: fixtureId(301),
      user_id: data.owner,
    })),
  );
  await db.insert(schema.Folder).values({
    id: fixtureId(401),
    name: "Browser folder",
    user_id: data.owner,
  });
  await db.insert(schema.TreeNode).values({
    folder_id: fixtureId(401),
    id: fixtureId(401),
    node_type: "folder",
    user_id: data.owner,
  });
  await db.insert(schema.TreeNode).values(
    notes.map((id) => ({
      id,
      node_type: "page" as const,
      page_id: id,
      user_id: data.owner,
    })),
  );
  await db.insert(schema.TreeEdge).values({
    id: fixtureId(501),
    node_id: fixtureId(401),
    user_id: data.owner,
  });
  for (const id of notes)
    await db.transaction((tx) =>
      insertEdgeAtPosition({
        db: tx,
        nodeId: id,
        parentNodeId: fixtureId(401),
        position: "after",
        userId: data.owner,
      }),
    );
  const require = createRequire(import.meta.url);
  child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    {
      env: {
        // biome-ignore lint/style/noProcessEnv: Preserve runtime PATH while replacing every application credential below.
        ...process.env,
        AUTH_DEV_ORIGINS: "",
        AUTH_DEV_PROXY_URL: "",
        AUTH_GITHUB_ID: "fixture",
        AUTH_GITHUB_SECRET: "fixture",
        AUTH_GOOGLE_ID: "fixture",
        AUTH_GOOGLE_SECRET: "fixture",
        AUTH_SECRET: "disposable-browser-auth-secret-at-least-32-characters",
        CI: "1",
        CRON_SECRET: "disposable-browser-cron-secret",
        NODE_ENV: "development",
        OPENAI_API_KEY: "fixture",
        OPENAI_API_URL: "https://api.openai.com/v1/",
        POSTGRES_SSL_MODE: "disable",
        POSTGRES_URL: container.getConnectionUri(),
        PUBLIC_WEB_URL: "http://127.0.0.1:3100",
        STRIPE_SECRET_KEY: "sk_test_placeholder_for_build",
        STRIPE_WEBHOOK_SECRET: "whsec_build_placeholder",
        VERCEL_BRANCH_URL: "",
        VERCEL_ENV: "development",
        VERCEL_PROJECT_PRODUCTION_URL: "",
        VERCEL_URL: "",
      },
      stdio: "inherit",
    },
  );
  const [code, signal] = await once(child, "exit");
  if (!stopping) {
    process.stderr.write(
      `Browser dev server exited unexpectedly (code: ${String(code)}, signal: ${String(signal)})\n`,
    );
    process.exitCode = typeof code === "number" && code !== 0 ? code : 1;
  }
} finally {
  await cleanup();
}
