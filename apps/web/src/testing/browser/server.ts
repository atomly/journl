import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import * as schema from "@acme/db/schema";
import { ALGORITHM_VERSION } from "@acme/graph/config";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { hashPassword } from "better-auth/crypto";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { insertEdgeAtPosition } from "../../trpc/procedures/tree-helpers";
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
  const statements = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema, undefined, undefined, "snake_case"),
  );
  const priority = (s: string) =>
    /^ALTER TABLE/.test(s) ? 2 : /^CREATE (UNIQUE )?INDEX/.test(s) ? 1 : 0;
  for (const statement of statements.sort((a, b) => priority(a) - priority(b)))
    await client.unsafe(statement);
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
  ]);
  await db.insert(schema.account).values(
    [data.owner, data.otherOwner].map((id) => ({
      accountId: id,
      createdAt: new Date(),
      id,
      password,
      providerId: "credential",
      updatedAt: new Date(),
      userId: id,
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
        VERCEL_ENV: "",
        VERCEL_PROJECT_PRODUCTION_URL: "",
        VERCEL_URL: "",
      },
      stdio: "inherit",
    },
  );
  const [code] = await once(child, "exit");
  if (!stopping) process.exitCode = typeof code === "number" ? code : 1;
} finally {
  await cleanup();
}
