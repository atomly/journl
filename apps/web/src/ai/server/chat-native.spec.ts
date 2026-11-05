import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  getAgent: vi.fn(),
  getModel: vi.fn(),
  usage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("~/ai/mastra/mastra", () => ({
  mastra: { getAgentById: mocks.getAgent },
}));
vi.mock("~/ai/mastra/agents/journl-agent", () => ({
  getJournlUserThread: () => "journl:owner",
  journlMini: { getModel: mocks.getModel, id: "native-chat-test" },
  journlNano: { getModel: mocks.getModel, id: "native-chat-test" },
  setJournlRequestContext: () => undefined,
}));
vi.mock("~/workflows/model-usage", () => ({ startModelUsage: mocks.usage }));

import { streamJournlChat } from "./chat";
import { parseJournlChatRequest } from "./chat-request";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usage.mockResolvedValue(undefined);
});

describe("chat accounting through the installed Mastra transport", () => {
  it.each(["success", "error", "aborted"] as const)(
    "retains reported step usage exactly once after native %s",
    async (outcome) => {
      const cancellation = new AbortController();
      let calls = 0;
      const model = new MockLanguageModelV4({
        doStream: async ({ abortSignal }) => {
          calls += 1;
          const interrupted = outcome === "aborted" && calls === 2;
          return {
            stream: new ReadableStream({
              start(stream) {
                stream.enqueue({ type: "stream-start", warnings: [] });
                if (interrupted) {
                  stream.enqueue({ id: "partial", type: "text-start" });
                  stream.enqueue({
                    delta: "Partial answer",
                    id: "partial",
                    type: "text-delta",
                  });
                  abortSignal?.addEventListener(
                    "abort",
                    () => {
                      stream.error(
                        new DOMException("Request cancelled", "AbortError"),
                      );
                    },
                    { once: true },
                  );
                  return;
                }
                stream.enqueue({
                  id: "source-1",
                  sourceType: "url",
                  title: "A retained source",
                  type: "source",
                  url: "https://example.com/source",
                });
                if (outcome === "aborted") {
                  stream.enqueue({
                    input: "{}",
                    toolCallId: "continue-1",
                    toolName: "continueChat",
                    type: "tool-call",
                  });
                }
                stream.enqueue({
                  finishReason: {
                    raw: undefined,
                    unified:
                      outcome === "aborted"
                        ? "tool-calls"
                        : outcome === "error"
                          ? "error"
                          : "stop",
                  },
                  type: "finish",
                  usage: {
                    inputTokens: {
                      cacheRead: 0,
                      cacheWrite: 0,
                      noCache: 10,
                      total: 10,
                    },
                    outputTokens: { reasoning: 3, text: 17, total: 20 },
                  },
                });
                stream.close();
              },
            }),
          };
        },
        modelId: "native-model",
        provider: "native-provider",
      });
      const agent = new Agent({
        id: "native-chat-test",
        instructions: "Answer the user.",
        model,
        name: "Native chat test",
        tools: {
          continueChat: createTool({
            description: "Continue the answer in another step.",
            execute: async () => ({ continued: true }),
            id: "continueChat",
            inputSchema: z.object({}),
          }),
        },
      });
      mocks.getAgent.mockReturnValue(agent);
      mocks.getModel.mockImplementation(() => agent.getModel());
      const request = await parseJournlChatRequest({
        context: {
          activeEditors: [],
          currentDate: "2026-11-05",
          highlightedText: [],
          reasoning: "instant",
          view: { name: "other" },
        },
        messages: [
          {
            id: "1",
            parts: [{ text: "Rewrite this", type: "text" }],
            role: "user",
          },
        ],
      });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const response = await streamJournlChat({
          request,
          signal: cancellation.signal,
          user: {
            createdAt: new Date(),
            email: "owner@example.com",
            emailVerified: true,
            id: "owner",
            name: "Owner",
            updatedAt: new Date(),
          },
        });
        if (!response.body) throw new Error("Missing response body");
        const chunks = [];
        for await (const result of parseJsonEventStream({
          schema: uiMessageChunkSchema,
          stream: response.body,
        })) {
          if (!result.success) throw result.error;
          chunks.push(result.value);
          if (outcome === "aborted" && result.value.type === "text-delta")
            cancellation.abort();
        }
        expect(model.doStreamCalls).toHaveLength(outcome === "aborted" ? 2 : 1);
        expect(mocks.usage).toHaveBeenCalledExactlyOnceWith({
          metrics: [
            { quantity: 10, unit: "input_tokens" },
            { quantity: 20, unit: "output_tokens" },
            { quantity: 3, unit: "reasoning_tokens" },
          ],
          modelId: "native-model",
          modelProvider: "native-provider",
          userId: "owner",
        });
        expect(chunks).toContainEqual(
          expect.objectContaining({
            type: "source-url",
            url: "https://example.com/source",
          }),
        );
        if (outcome === "aborted")
          expect(chunks).toContainEqual({ type: "abort" });
      } finally {
        log.mockRestore();
      }
    },
  );
});
