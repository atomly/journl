import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  miniModel: vi.fn(async () => ({ modelId: "mini", provider: "openai" })),
  nanoModel: vi.fn(async () => ({ modelId: "nano", provider: "openai" })),
  stream: vi.fn(),
  usage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@mastra/ai-sdk", () => ({ handleChatStream: mocks.stream }));
vi.mock("~/ai/mastra/agents/journl-agent", () => ({
  getJournlUserThread: (user: { id: string }) => `journl:${user.id}`,
  journlMini: { getModel: mocks.miniModel, id: "journl-mini" },
  journlNano: { getModel: mocks.nanoModel, id: "journl-nano" },
  setJournlRequestContext: (context: unknown) => context,
}));
vi.mock("~/ai/mastra/mastra", () => ({ mastra: {} }));
vi.mock("~/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("~/workflows/model-usage", () => ({ startModelUsage: mocks.usage }));

import { streamJournlChat } from "./chat";
import { parseJournlChatRequest } from "./chat-request";

const user = {
  createdAt: new Date(),
  email: "real@example.com",
  emailVerified: true,
  id: "owner",
  name: "Real user",
  updatedAt: new Date(),
};
const context = {
  activeEditors: [],
  currentDate: "2026-11-05",
  highlightedText: [],
  reasoning: "instant",
  view: { name: "other" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stream.mockImplementation(
    async () =>
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
  );
});

describe("authenticated chat run", () => {
  it("binds memory and context to the server identity and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const request = await parseJournlChatRequest({
      context,
      messages: [
        {
          id: "1",
          parts: [{ text: "Find my notes", type: "text" }],
          role: "user",
        },
      ],
    });
    const response = await streamJournlChat({ request, signal, user });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "journl-nano",
        params: expect.objectContaining({
          abortSignal: signal,
          maxSteps: 5,
          memory: { resource: "owner", thread: "journl:owner" },
          requestContext: { ...context, user: { name: "Real user" } },
          toolCallConcurrency: 4,
        }),
        sendSources: true,
        version: "v7",
      }),
    );
    const onError = mocks.stream.mock.calls[0]?.[0].onError;
    expect(onError(new Error("secret-provider-payload"))).not.toContain(
      "secret",
    );
  });

  it("retains write routing, reasoning options, and usage ownership", async () => {
    const request = await parseJournlChatRequest({
      context: { ...context, reasoning: "thinking" },
      messages: [
        {
          id: "1",
          parts: [{ text: "Rewrite this paragraph", type: "text" }],
          role: "user",
        },
      ],
    });
    await streamJournlChat({
      request,
      signal: new AbortController().signal,
      user,
    });
    const options = mocks.stream.mock.calls[0]?.[0];
    expect(options.agentId).toBe("journl-mini");
    expect(options.params.providerOptions.openai.reasoningEffort).toBe(
      "medium",
    );
    await options.params.onStepFinish({
      toolResults: [],
      usage: { inputTokens: 10, outputTokens: 20, reasoningTokens: 3 },
    });
    expect(mocks.usage).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({ quantity: 10 }),
          expect.objectContaining({ quantity: 20 }),
          expect.objectContaining({ quantity: 3 }),
        ]),
        modelId: "mini",
        modelProvider: "openai",
        userId: "owner",
      }),
    );
  });

  it("accounts for each step and its searches once using the reported model", async () => {
    const request = await parseJournlChatRequest({
      context,
      messages: [
        {
          id: "1",
          parts: [{ text: "Rewrite this", type: "text" }],
          role: "user",
        },
      ],
    });
    await streamJournlChat({
      request,
      signal: new AbortController().signal,
      user,
    });
    const params = mocks.stream.mock.calls[0]?.[0].params;
    const model = { modelId: "actual-model", provider: "actual-provider" };
    await params.onStepFinish({
      model,
      toolResults: [
        {
          payload: {
            result: { action: { type: "search" } },
            toolName: "web_search",
          },
        },
        {
          payload: {
            result: { action: { type: "open_page" } },
            toolName: "web_search",
          },
        },
      ],
      usage: { inputTokens: 10, outputTokens: 20, reasoningTokens: 3 },
    });
    await params.onStepFinish({
      model,
      toolResults: [],
      usage: { inputTokens: 4, outputTokens: 5 },
    });
    await params.onFinish?.({
      steps: [],
      totalUsage: { inputTokens: 14, outputTokens: 25, reasoningTokens: 3 },
    });
    expect(params.onFinish).toBeUndefined();
    expect(mocks.usage.mock.calls).toEqual([
      [
        {
          metrics: [
            { quantity: 10, unit: "input_tokens" },
            { quantity: 20, unit: "output_tokens" },
            { quantity: 3, unit: "reasoning_tokens" },
            { quantity: 1, unit: "web_search_calls" },
          ],
          modelId: "actual-model",
          modelProvider: "actual-provider",
          userId: "owner",
        },
      ],
      [
        {
          metrics: [
            { quantity: 4, unit: "input_tokens" },
            { quantity: 5, unit: "output_tokens" },
            { quantity: 0, unit: "reasoning_tokens" },
          ],
          modelId: "actual-model",
          modelProvider: "actual-provider",
          userId: "owner",
        },
      ],
    ]);
    expect(mocks.miniModel).not.toHaveBeenCalled();
  });
});
