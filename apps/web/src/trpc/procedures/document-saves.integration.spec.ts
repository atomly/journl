import { randomUUID } from "node:crypto";
import { eq } from "@acme/db";
import * as schema from "@acme/db/schema";
import { initTRPC } from "@trpc/server";
import { beforeEach, expect, test, vi } from "vitest";
import { createPostgresFixture } from "~/testing/postgres";
import type { TRPCContext } from "../trpc";
import { journalRouter } from "./journal";
import { pagesRouter } from "./pages";

vi.mock("~/env", () => ({ env: { PUBLIC_WEB_URL: "https://journl.example" } }));
vi.mock("~/workflows/document-embedding", () => ({
  startDocumentEmbedding: vi.fn(),
}));
vi.mock("~/explore/dispatch", () => ({ dispatchExploreRefresh: vi.fn() }));
vi.mock("../trpc", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.context<TRPCContext>().create();
  return {
    protectedProcedure: t.procedure,
    usageGuard: t.middleware(({ next }) => next()),
  };
});

const { db, client } = createPostgresFixture(
  Object.fromEntries(
    Object.entries(schema).filter(
      ([name]) =>
        name.startsWith("Explore") ||
        [
          "user",
          "Document",
          "Page",
          "JournalEntry",
          "BlockNode",
          "BlockEdge",
          "BlockSearchText",
          "DocumentReference",
        ].includes(name),
    ),
  ),
);
const owner = "save-safety-fixture";
const caller = initTRPC
  .context<TRPCContext>()
  .create()
  .router({
    journal: initTRPC.context<TRPCContext>().create().router(journalRouter),
    pages: initTRPC.context<TRPCContext>().create().router(pagesRouter),
  })
  .createCaller({ db, session: { user: { id: owner } } } as TRPCContext);
const date = "2026-10-01";
const changes = (id: string, text: string) => [
  {
    args: {
      data: { content: [{ text, type: "text" }], props: {}, type: "paragraph" },
      id,
      parent_id: null,
    },
    type: "block_upsert" as const,
  },
];

beforeEach(async () => {
  await client.unsafe('TRUNCATE "user" CASCADE');
  await db
    .insert(schema.user)
    .values({ email: "save@example.invalid", id: owner, name: "Save fixture" });
});

async function pageFixture() {
  const [document] = await db
    .insert(schema.Document)
    .values({ user_id: owner })
    .returning();
  if (!document) throw new Error("Document fixture missing");
  const [page] = await db
    .insert(schema.Page)
    .values({ document_id: document.id, title: "Before", user_id: owner })
    .returning();
  if (!page) throw new Error("Page fixture missing");
  return page;
}

function oneWinner(results: PromiseSettledResult<unknown>[]) {
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
}

test("simultaneous page saves from one version commit exactly one complete change", async () => {
  const page = await pageFixture();
  const block = randomUUID();
  const input = {
    document_id: page.document_id,
    expected_updated_at: page.updated_at,
  };
  oneWinner(
    await Promise.allSettled(
      ["first", "second"].map((text) =>
        caller.pages.saveTransactions({
          ...input,
          title: text,
          transactions: changes(block, text),
        }),
      ),
    ),
  );
  const [saved] = await db
    .select()
    .from(schema.Page)
    .where(eq(schema.Page.id, page.id));
  const [savedBlock] = await db
    .select()
    .from(schema.BlockNode)
    .where(eq(schema.BlockNode.id, block));
  expect(savedBlock?.data).toMatchObject({ content: [{ text: saved?.title }] });
  expect(saved?.updated_at).not.toBe(page.updated_at);
});

test("simultaneous first journal saves create one document and reject the stale creator", async () => {
  const input = { date, document_id: null, expected_updated_at: null };
  oneWinner(
    await Promise.allSettled(
      ["first", "second"].map((text) =>
        caller.journal.saveTransactions({
          ...input,
          transactions: changes(randomUUID(), text),
        }),
      ),
    ),
  );
  expect(await db.select().from(schema.Document)).toHaveLength(1);
  expect(await db.select().from(schema.JournalEntry)).toHaveLength(1);
  expect(await db.select().from(schema.BlockNode)).toHaveLength(1);
});

test("simultaneous existing journal saves reject the stale writer", async () => {
  const saved = await caller.journal.saveTransactions({
    date,
    document_id: null,
    expected_updated_at: null,
    transactions: [],
  });
  oneWinner(
    await Promise.allSettled(
      ["first", "second"].map((text) =>
        caller.journal.saveTransactions({
          date,
          document_id: saved.document_id,
          expected_updated_at: saved.updated_at,
          transactions: changes(randomUUID(), text),
        }),
      ),
    ),
  );
  expect(await db.select().from(schema.BlockNode)).toHaveLength(1);
});

test("replaying a lost page response never inserts the same edge twice", async () => {
  const page = await pageFixture();
  const first = randomUUID();
  const second = randomUUID();
  const input = {
    document_id: page.document_id,
    expected_updated_at: page.updated_at,
    transactions: [
      ...changes(first, "first"),
      ...changes(second, "second"),
      {
        args: { from_id: first, to_id: second, type: "sibling" as const },
        type: "edge_insert" as const,
      },
    ],
  };
  await caller.pages.saveTransactions(input);
  await expect(caller.pages.saveTransactions(input)).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(await db.select().from(schema.BlockEdge)).toHaveLength(1);
});

test("replaying a lost journal creation response cannot create or apply it twice", async () => {
  const input = {
    date,
    document_id: null,
    expected_updated_at: null,
    transactions: changes(randomUUID(), "first"),
  };
  await caller.journal.saveTransactions(input);
  await expect(caller.journal.saveTransactions(input)).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(await db.select().from(schema.Document)).toHaveLength(1);
  expect(await db.select().from(schema.BlockNode)).toHaveLength(1);
});

test("a stale title save cannot overwrite newer page writing", async () => {
  const page = await pageFixture();
  await caller.pages.saveTransactions({
    document_id: page.document_id,
    expected_updated_at: page.updated_at,
    title: "New title",
    transactions: [],
  });
  await expect(
    caller.pages.updateTitle({
      expected_updated_at: page.updated_at,
      id: page.id,
      title: "Stale title",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const [saved] = await db
    .select()
    .from(schema.Page)
    .where(eq(schema.Page.id, page.id));
  expect(saved?.title).toBe("New title");
});

test("requests without a version fail before touching the database", async () => {
  const page = await pageFixture();
  await expect(
    caller.pages.saveTransactions({
      document_id: page.document_id,
      transactions: [],
    } as never),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    caller.journal.saveTransactions({
      date,
      document_id: null,
      transactions: [],
    } as never),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(await db.select().from(schema.BlockNode)).toHaveLength(0);
});
