import { describeExternal, websiteSource } from "@acme/references";
import { afterEach, expect, test, vi } from "vitest";
import {
  createPreviewPipeline,
  type PreviewProvider,
} from "./preview-pipeline";

const context = { ownerId: "a" };
const url = "https://example.com/article";
function provider(
  resolve = vi.fn(async () => ({ title: "Enriched" })),
  publicCache = false,
): PreviewProvider {
  return {
    resolve,
    source: websiteSource,
    ...(publicCache ? { cacheScope: "public" as const } : {}),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("a new provider supplies presentation and resolves through unchanged orchestration", async () => {
  const source = {
    describe: (url: URL) =>
      url.hostname === "example.com"
        ? {
            compactLabel: "TEST-1",
            excerpt: url.href,
            graphTitle: "Test item",
            icon: "unknown-icon",
            provider: "test-platform",
            sourceLabel: "Test platform",
            title: "Fallback",
          }
        : null,
    id: "test-platform",
  };
  const pipeline = createPreviewPipeline([
    { resolve: async () => ({ title: "Platform item" }), source },
  ]);
  expect(describeExternal(url, [source])?.compactLabel).toBe("TEST-1");
  expect(await pipeline.resolve(url, context)).toMatchObject({
    icon: "unknown-icon",
    metadataState: "enriched",
    provider: "test-platform",
    sourceLabel: "Test platform",
    title: "Platform item",
  });
});

test("private results and in-flight requests default to owner/connection/revision scope", async () => {
  let finish: (value: { title: string }) => void = () => {};
  const resolve = vi.fn(
    () =>
      new Promise<{ title: string }>((r) => {
        finish = r;
      }),
  );
  const pipeline = createPreviewPipeline([provider(resolve)]);
  const a = pipeline.resolve(url, context);
  const same = pipeline.resolve(url, context);
  await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
  finish({ title: "A" });
  expect(await a).toEqual(await same);
  resolve.mockResolvedValue({ title: "Other scope" });
  for (const next of [
    { ownerId: "b" },
    { connection: { id: "one", revision: "1" }, ownerId: "a" },
    { connection: { id: "one", revision: "2" }, ownerId: "a" },
    { connection: { id: "two", revision: "2" }, ownerId: "a" },
  ])
    await pipeline.resolve(url, next);
  expect(resolve).toHaveBeenCalledTimes(5);
  expect(await pipeline.resolve(url, context)).toMatchObject({ title: "A" });
});

test("explicit public results coalesce across owners and ignore URL fragments", async () => {
  const resolve = vi.fn(async () => ({ title: "Public" }));
  const pipeline = createPreviewPipeline([provider(resolve, true)]);
  const [a, b] = await Promise.all([
    pipeline.resolve(url, context),
    pipeline.resolve(`${url}#part`, { ownerId: "b" }),
  ]);
  expect(a.title).toEqual(b.title);
  expect(a.href).toBe(url);
  expect(b.href).toBe(`${url}#part`);
  expect(resolve).toHaveBeenCalledTimes(1);
});

test("bounded concurrency queues admitted requests; overload is never negative-cached", async () => {
  let finish: (value: { title: string }) => void = () => {};
  const resolve = vi.fn(
    () =>
      new Promise<{ title: string }>((r) => {
        finish = r;
      }),
  );
  const pipeline = createPreviewPipeline([provider(resolve)], {
    concurrency: 1,
    maxPending: 2,
  });
  const first = pipeline.resolve(url, context);
  const second = pipeline.resolve(`${url}/2`, context);
  await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
  expect(await pipeline.resolve(`${url}/3`, context)).toMatchObject({
    enrichment: "busy",
    href: `${url}/3`,
  });
  resolve.mockResolvedValue({ title: "Retry" });
  finish({ title: "First" });
  await Promise.all([first, second]);
  expect(await pipeline.resolve(`${url}/3`, context)).toMatchObject({
    title: "Retry",
  });
  expect(resolve).toHaveBeenCalledTimes(3);
});

test("missing/failed enrichment retains usable links and expires negative results", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  const resolve = vi.fn().mockRejectedValue(new Error("offline"));
  const pipeline = createPreviewPipeline([provider(resolve)]);
  expect(await pipeline.resolve(url, context)).toMatchObject({
    enrichment: "failed",
    href: url,
    metadataState: "url-only",
    status: "ready",
  });
  await pipeline.resolve(url, context);
  expect(resolve).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(31_000);
  resolve.mockResolvedValue(null);
  expect(await pipeline.resolve(url, context)).toMatchObject({
    enrichment: "missing",
  });
  expect(resolve).toHaveBeenCalledTimes(2);
});

test("eviction and expiring user budgets are bounded; invalid targets never resolve", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  const resolve = vi.fn(async () => ({ title: "A" }));
  const pipeline = createPreviewPipeline([provider(resolve)], {
    maxCache: 1,
    missesPerMinute: 2,
  });
  await pipeline.resolve(url, context);
  await pipeline.resolve(`${url}/2`, context);
  expect(await pipeline.resolve(url, context)).toMatchObject({
    enrichment: "busy",
  });
  await vi.advanceTimersByTimeAsync(61_000);
  await pipeline.resolve(url, context);
  expect(resolve).toHaveBeenCalledTimes(3);
  expect(await pipeline.resolve("http://127.0.0.1/admin", context)).toEqual({
    status: "unavailable",
  });
  expect(await pipeline.resolve(url, { ownerId: "" })).toEqual({
    status: "unavailable",
  });
});

test("fragment navigation survives pending, cached, and busy results", async () => {
  let finish: (value: { title: string }) => void = () => {};
  const resolve = vi.fn(
    () =>
      new Promise<{ title: string }>((r) => {
        finish = r;
      }),
  );
  const pipeline = createPreviewPipeline([provider(resolve)], {
    maxPending: 1,
  });
  const first = pipeline.resolve(`${url}#one`, context);
  const pending = pipeline.resolve(`${url}#two`, context);
  await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
  expect(await pipeline.resolve(`${url}/other#busy`, context)).toMatchObject({
    enrichment: "busy",
    href: `${url}/other#busy`,
  });
  finish({ title: "Shared metadata" });
  expect(await first).toMatchObject({ href: `${url}#one` });
  expect(await pending).toMatchObject({ href: `${url}#two` });
  expect(await pipeline.resolve(`${url}#cached`, context)).toMatchObject({
    href: `${url}#cached`,
    title: "Shared metadata",
  });
  expect(resolve).toHaveBeenCalledTimes(1);
});
