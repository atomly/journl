import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ stream: vi.fn(), usage: vi.fn() }));
vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    stream = mocks.stream;
    getModel = async () => ({
      modelId: "gpt-5-mini",
      provider: "openai.responses",
    });
  },
}));
vi.mock("~/workflows/model-usage", () => ({ startModelUsage: mocks.usage }));

import { researchPublicWeb } from "./public-research";

beforeEach(() => vi.clearAllMocks());
test.each(["stop", "error"])(
  "research accounts hosted search once after a native %s result",
  async (finish) => {
    mocks.stream.mockResolvedValue({
      finishReason: Promise.resolve(finish),
      fullStream: (async function* () {
        yield {
          payload: {
            preliminary: true,
            result: { action: { type: "search" } },
            toolCallId: "r",
            toolName: "webSearch",
          },
          type: "tool-result",
        };
        yield {
          payload: {
            result: { action: { type: "search" } },
            toolCallId: "r",
            toolName: "webSearch",
          },
          type: "tool-result",
        };
        yield {
          payload: {
            sourceType: "url",
            title: "Source",
            url: "https://example.com/source",
          },
          type: "source",
        };
      })(),
      text: Promise.resolve(
        "Verified facts [Source](https://example.com/source).",
      ),
      totalUsage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 3,
      }),
    });
    const result = researchPublicWeb("news", "server-owner");
    if (finish === "stop")
      await expect(result).resolves.toMatchObject({
        findings: expect.stringContaining("Verified facts"),
        sources: [{ title: "Source", url: "https://example.com/source" }],
      });
    else await expect(result).rejects.toThrow("did not complete");
    expect(mocks.usage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        metrics: expect.arrayContaining([
          { quantity: 1, unit: "web_search_calls" },
        ]),
        userId: "server-owner",
      }),
    );
  },
);
