import { UsageLimitError } from "@acme/db/usage";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  quota: vi.fn(),
  session: vi.fn(),
  stream: vi.fn(),
}));
vi.mock("~/auth/server", () => ({ getSession: mocks.session }));
vi.mock("@acme/db/client", () => ({
  db: { query: { Page: { findFirst: mocks.page } } },
}));
vi.mock("@acme/db/usage", async (original) => ({
  ...(await original<typeof import("@acme/db/usage")>()),
  assertUsageQuota: mocks.quota,
}));
vi.mock("~/ai/server/document-writer", () => ({
  streamDocumentWriter: mocks.stream,
}));
vi.mock("~/env", () => ({ env: { NODE_ENV: "test" } }));

import { POST } from "./route";

const owner = { id: "owner", name: "Owner" };
const input = {
  blocks: [{ content: "Unsaved draft", id: "a", type: "paragraph" }],
  instruction: "Improve the phrasing",
  scope: "document",
  targetEditor: "page:00000000-0000-4000-8000-000000000001",
};
const request = (body: unknown = input, signal?: AbortSignal) =>
  new Request("http://localhost/api/ai/document-writer", {
    body: JSON.stringify(body),
    method: "POST",
    signal,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: owner });
  mocks.quota.mockResolvedValue(undefined);
  mocks.page.mockResolvedValue({ id: input.targetEditor.slice(5) });
  mocks.stream.mockResolvedValue(new Response("generation"));
});

test("requires authentication before quota, document lookup, or generation", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.quota).not.toHaveBeenCalled();
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.stream).not.toHaveBeenCalled();
});

test("enforces quota before running the model", async () => {
  mocks.quota.mockRejectedValue(
    new UsageLimitError({
      canUse: false,
      currentUsageUsd: 1,
      periodEnd: null,
      quotaUsd: 1,
      remainingQuotaUsd: 0,
      subscriptionType: "free",
      usagePeriodId: "period",
    }),
  );
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(await response.json()).toMatchObject({ code: "USAGE_QUOTA_EXCEEDED" });
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.stream).not.toHaveBeenCalled();
});

test("binds page lookup and usage to authenticated ownership and forwards cancellation", async () => {
  const req = request();
  expect((await POST(req)).status).toBe(200);
  const where = mocks.page.mock.calls[0]?.[0].where;
  const query = new PgDialect().sqlToQuery(where);
  expect(query.params).toEqual([input.targetEditor.slice(5), owner.id]);
  expect(mocks.quota).toHaveBeenCalledWith(expect.anything(), owner.id);
  expect(mocks.stream).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining(input),
      signal: req.signal,
      user: owner,
    }),
  );
});

test("hides unavailable and other-owner pages without generating content", async () => {
  mocks.page.mockResolvedValue(undefined);
  expect((await POST(request())).status).toBe(404);
  expect(mocks.stream).not.toHaveBeenCalled();
});

test("supports an authenticated user's empty journal day without creating rows", async () => {
  expect(
    (
      await POST(
        request({
          ...input,
          blocks: [],
          targetEditor: "journal-entry:2026-11-05",
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.stream).toHaveBeenCalledWith(
    expect.objectContaining({ user: owner }),
  );
});

test("rejects malformed JSON and client execution overrides before lookup", async () => {
  expect(
    (await POST(new Request("http://localhost", { body: "{", method: "POST" })))
      .status,
  ).toBe(400);
  expect((await POST(request({ ...input, tools: {} }))).status).toBe(400);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.stream).not.toHaveBeenCalled();
});

test("does not start generation for an aborted request", async () => {
  const controller = new AbortController();
  controller.abort();
  expect((await POST(request(input, controller.signal))).status).toBe(499);
  expect(mocks.stream).not.toHaveBeenCalled();
});
