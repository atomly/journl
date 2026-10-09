vi.mock("~/explore/refresh", () => ({
  lockExploreOwner: vi.fn(),
  markExploreDirty: vi.fn(),
}));

import { Document } from "@acme/db/schema";
import { initTRPC } from "@trpc/server";
import { beforeEach, expect, test, vi } from "vitest";
import { journalRouter } from "../src/trpc/procedures/journal";
import type { TRPCContext } from "../src/trpc/trpc";

vi.mock("~/env", () => ({ env: { PUBLIC_WEB_URL: "https://journl.example" } }));

const mocks = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@acme/blocknote/server", () => ({ blocknoteBlocks: vi.fn() }));
vi.mock("../src/workflows/document-embedding", () => ({
  startDocumentEmbedding: vi.fn(),
}));
vi.mock("../src/trpc/shared/block-transaction", async (original) => ({
  ...(await original<typeof import("../src/trpc/shared/block-transaction")>()),
  saveTransactions: mocks.persist,
}));
vi.mock("../src/trpc/trpc", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.context<TRPCContext>().create();
  return {
    protectedProcedure: t.procedure,
    usageGuard: t.middleware(({ next }) => next()),
  };
});

vi.mock("../src/explore/dispatch", () => ({
  dispatchExploreRefresh: vi.fn(),
}));

const v1 = "2026-09-29 12:00:00.000001+00";
const v2 = "2026-09-29 12:00:00.000002+00";
const metadata = {
  created_at: v1,
  date: "2026-09-29",
  document_id: "b196fb5d-6e49-4fe6-8184-85165f595097",
  id: "3c469dbd-6b5c-4cbd-ac7d-9481849bd0ce",
  updated_at: v1,
  user_id: "user",
};

function setup(current: typeof metadata | undefined = metadata) {
  const read = vi.fn(async () => current);
  const execute = vi.fn(async () => {});
  const insert = vi.fn((table) => ({
    values: () => ({
      returning: async () => [
        table === Document ? { id: metadata.document_id } : metadata,
      ],
    }),
  }));
  const update = vi.fn(() => ({
    set: () => ({
      where: () => ({
        returning: async () => [{ ...metadata, updated_at: v2 }],
      }),
    }),
  }));
  const tx = {
    execute,
    insert,
    query: { JournalEntry: { findFirst: read } },
    update,
  };
  const db = {
    transaction: async (fn: (transaction: typeof tx) => Promise<unknown>) =>
      fn(tx),
  };
  const caller = initTRPC
    .context<TRPCContext>()
    .create()
    .router(journalRouter)
    .createCaller({
      db,
      session: { user: { id: "user" } },
    } as unknown as TRPCContext);
  return { caller, execute, insert, read, update };
}

beforeEach(() =>
  mocks.persist
    .mockReset()
    .mockResolvedValue({ id: metadata.document_id, updatedAt: v2 }),
);

test("a successful save checks the version under the lock and returns its new version", async () => {
  const { caller, execute, read } = setup();
  const result = await caller.saveTransactions({
    date: metadata.date,
    document_id: metadata.document_id,
    expected_updated_at: v1,
    transactions: [],
  });
  expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
    read.mock.invocationCallOrder[0] ?? 0,
  );
  expect(mocks.persist).toHaveBeenCalledTimes(1);
  expect(result.updated_at).toBe(v2);
});

test("replaying a committed request fails before applying any block or edge operations", async () => {
  const { caller, update } = setup({ ...metadata, updated_at: v2 });
  await expect(
    caller.saveTransactions({
      date: metadata.date,
      document_id: metadata.document_id,
      expected_updated_at: v1,
      transactions: [],
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(mocks.persist).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test("a lost creation response cannot cause duplicate document creation on retry", async () => {
  const { caller, insert } = setup();
  await expect(
    caller.saveTransactions({
      date: metadata.date,
      document_id: null,
      expected_updated_at: null,
      transactions: [],
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(insert).not.toHaveBeenCalled();
  expect(mocks.persist).not.toHaveBeenCalled();
});

test("a document ID must belong to the requested journal entry", async () => {
  const { caller } = setup();
  await expect(
    caller.saveTransactions({
      date: metadata.date,
      document_id: "05fa77de-c497-44c7-a8e4-6267a92483e0",
      expected_updated_at: v1,
      transactions: [],
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.persist).not.toHaveBeenCalled();
});
