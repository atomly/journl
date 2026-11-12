import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ research: vi.fn() }));
vi.mock("~/ai/server/public-research", () => ({
  researchPublicWeb: mocks.research,
}));

import { research } from "./research";

const execute = research.execute;
if (!execute) throw new Error("Research tool requires execute");
const result = {
  findings: "Verified finding.",
  sources: [{ title: "Source", url: "https://example.com/source" }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.research.mockResolvedValue(result);
});
const context = () => {
  const requestContext = new RequestContext();
  requestContext.set("researchUserId", "owner");
  requestContext.set("researchCache", new Map());
  return { requestContext };
};
test("concurrent equivalent queries share one server research run within a request", async () => {
  const ctx = context();
  const [a, b] = await Promise.all([
    execute({ query: " Official  News " }, ctx),
    execute({ query: "official news" }, ctx),
  ]);
  expect(a).toEqual(result);
  expect(b).toEqual(result);
  expect(mocks.research).toHaveBeenCalledTimes(1);
  await execute({ query: "official news" }, context());
  expect(mocks.research).toHaveBeenCalledTimes(2);
});
test("failed research is evicted and can be retried, with authenticated identity and cancellation", async () => {
  const controller = new AbortController();
  const ctx = { ...context(), abortSignal: controller.signal };
  mocks.research.mockRejectedValueOnce(new Error("Provider failed"));
  await expect(execute({ query: "news" }, ctx)).rejects.toThrow(
    "Provider failed",
  );
  await expect(execute({ query: "news" }, ctx)).resolves.toEqual(result);
  expect(mocks.research).toHaveBeenLastCalledWith(
    "news",
    "owner",
    controller.signal,
  );
});
test("research cannot run without server-owned identity and cache", async () => {
  await expect(
    execute({ query: "news" }, { requestContext: new RequestContext() }),
  ).rejects.toThrow("authenticated research context");
  expect(mocks.research).not.toHaveBeenCalled();
});
