import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as schema from "@acme/db/schema";
import {
  historicalFixtures,
  inventoryDocumentId,
  inventoryId,
  savedNode,
} from "@acme/document/fixtures";
import { expect, test } from "vitest";
import { createPostgresFixture } from "../postgres";

const { client, db } = createPostgresFixture({
  BlockEdge: schema.BlockEdge,
  BlockNode: schema.BlockNode,
  Document: schema.Document,
  DocumentReference: schema.DocumentReference,
  JournalEntry: schema.JournalEntry,
  Page: schema.Page,
  user: schema.user,
});

test("the production inventory SQL is read-only, valid on current tables, and reports shapes without authored data", async () => {
  await db.insert(schema.user).values({
    email: "inventory@example.invalid",
    id: "synthetic-inventory",
    name: "Synthetic inventory",
  });
  await db
    .insert(schema.Document)
    .values({ id: inventoryDocumentId, user_id: "synthetic-inventory" });
  await db.insert(schema.Page).values({
    document_id: inventoryDocumentId,
    id: inventoryId(888),
    title: "Private synthetic title must not be exported",
    user_id: "synthetic-inventory",
  });
  const nested = historicalFixtures.find(
    (fixture) => fixture.name === "sibling-order-and-nesting",
  );
  if (!nested) throw new Error("Missing fixture");
  // Insert parents before children because the real schema enforces parent foreign keys.
  const ordered = [...nested.nodes].sort(
    (a, b) => Number(a.parent_id !== null) - Number(b.parent_id !== null),
  );
  for (const node of [
    ...ordered,
    savedNode(101, { props: {}, type: "paragraph" }),
    savedNode(121, {
      content: "Private writing must not be exported",
      props: {},
      type: "unsupported-private-content",
    }),
  ])
    await db.insert(schema.BlockNode).values(node);
  await db.insert(schema.BlockEdge).values([...nested.edges]);
  const sql = await readFile(
    fileURLToPath(
      new URL(
        "../../../../../docs/editor-inventory/production-shapes.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  expect(sql).toContain("BEGIN TRANSACTION READ ONLY");
  const connection = await client.reserve();
  const results = await (async () => {
    try {
      return await connection.unsafe(sql).simple();
    } catch (error) {
      await connection.unsafe("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  })();
  const sections = results.flat() as Array<Record<string, unknown>>;
  expect(
    sections.find((row) => row.section === "document_counts"),
  ).toMatchObject({ blocks: "5", documents: "1", pages: "1" });
  expect(
    sections.find(
      (row) => row.section === "block_shapes" && row.block_type === "<unknown>",
    ),
  ).toMatchObject({ blocks: "1" });
  expect(sections.find((row) => row.section === "nesting")).toMatchObject({
    blocks_reaching_cycles: "0",
    maximum_observed_depth: 1,
  });
  expect(JSON.stringify(results)).not.toContain("Private");
  expect(JSON.stringify(results)).not.toContain("unsupported-private-content");
  expect(JSON.stringify(results)).not.toContain(inventoryDocumentId);
  expect(await db.select().from(schema.BlockNode)).toHaveLength(5);
});
