import { Agent, convertMessages } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
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

import { zWriteInput, zWriteOutput } from "~/ai/tools/write/schema";
import { streamJournlChat } from "./chat";
import { parseJournlChatRequest } from "./chat-request";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usage.mockResolvedValue(undefined);
});

it("pauses mixed server and browser tool calls before generating an ungrounded reply", async () => {
  const store = new LibSQLStore({ id: crypto.randomUUID(), url: ":memory:" });
  const memory = new Memory({
    options: {
      generateTitle: false,
      semanticRecall: false,
      workingMemory: { enabled: true, scope: "resource" },
    },
    storage: store,
  });
  await memory.createThread({ resourceId: "owner", threadId: "journl:owner" });
  try {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        const first = calls++ === 0;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              if (first) {
                for (const toolName of ["updateWorkingMemory", "write"])
                  controller.enqueue({
                    input:
                      toolName === "write"
                        ? "{}"
                        : JSON.stringify({
                            memory: "Prefers concise answers.",
                          }),
                    toolCallId: toolName,
                    toolName,
                    type: "tool-call",
                  });
              } else {
                controller.enqueue({ id: "premature", type: "text-start" });
                controller.enqueue({
                  delta: "PREMATURE_REPLY_BEFORE_BROWSER_RESULT",
                  id: "premature",
                  type: "text-delta",
                });
                controller.enqueue({ id: "premature", type: "text-end" });
              }
              controller.enqueue({
                finishReason: {
                  raw: undefined,
                  unified: first ? "tool-calls" : "stop",
                },
                type: "finish",
                usage: {
                  inputTokens: {
                    cacheRead: 0,
                    cacheWrite: 0,
                    noCache: 1,
                    total: 1,
                  },
                  outputTokens: { reasoning: 0, text: 1, total: 1 },
                },
              });
              controller.close();
            },
          }),
        };
      },
    });
    mocks.getAgent.mockReturnValue(
      new Agent({
        id: "native-chat-test",
        instructions: "Use both tools.",
        memory,
        model,
        name: "Mixed tool test",
        tools: {
          write: createTool({
            description: "Edit in the browser",
            id: "write",
            inputSchema: zWriteInput,
            outputSchema: zWriteOutput,
          }),
        },
      }),
    );
    const response = await streamJournlChat({
      request: await parseJournlChatRequest({
        context: {
          activeEditors: [],
          currentDate: "2026-11-08",
          highlightedText: [],
          reasoning: "instant",
          view: { name: "other" },
        },
        messages: [
          {
            id: "user",
            parts: [
              {
                text: "Write a paragraph and remember my preference.",
                type: "text",
              },
            ],
            role: "user",
          },
        ],
      }),
      signal: new AbortController().signal,
      user: {
        createdAt: new Date(),
        email: "owner@example.invalid",
        emailVerified: true,
        id: "owner",
        name: "Owner",
        updatedAt: new Date(),
      },
    });
    const body = await response.text();
    expect(
      await memory.getWorkingMemory({
        resourceId: "owner",
        threadId: "journl:owner",
      }),
    ).toBe("Prefers concise answers.");
    expect(model.doStreamCalls).toHaveLength(1);
    expect(body).toContain('"toolName":"write"');
    expect(body).not.toContain("PREMATURE_REPLY_BEFORE_BROWSER_RESULT");
  } finally {
    await store.close();
  }
});

it.each([
  { newRequest: false, status: "applied" },
  { newRequest: false, status: "cancelled" },
  { newRequest: false, status: "error" },
  { newRequest: true, status: "applied" },
])(
  "native history finalizes $status writing without a model (new request: $newRequest)",
  async ({ status, newRequest }) => {
    const store = new LibSQLStore({ id: crypto.randomUUID(), url: ":memory:" });
    const memory = new Memory({
      options: {
        generateTitle: false,
        semanticRecall: false,
        workingMemory: { enabled: true, scope: "resource" },
      },
      storage: store,
    });
    await memory.createThread({
      resourceId: "owner",
      threadId: "journl:owner",
    });
    await memory.updateWorkingMemory({
      resourceId: "owner",
      threadId: "journl:owner",
      workingMemory: "Prefers concise answers.",
    });
    try {
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ id: "summary", type: "text-start" });
              controller.enqueue({
                delta: "Writing result acknowledged.",
                id: "summary",
                type: "text-delta",
              });
              controller.enqueue({ id: "summary", type: "text-end" });
              controller.enqueue({
                finishReason: { raw: undefined, unified: "stop" },
                type: "finish",
                usage: {
                  inputTokens: {
                    cacheRead: 0,
                    cacheWrite: 0,
                    noCache: 1,
                    total: 1,
                  },
                  outputTokens: { reasoning: 0, text: 1, total: 1 },
                },
              });
              controller.close();
            },
          }),
        }),
        modelId: "native-model",
        provider: "native-provider",
      });
      const agent = new Agent({
        id: "native-chat-test",
        instructions: "Default action-phase instructions.",
        memory,
        model,
        name: "Native chat test",
        tools: {
          write: createTool({
            description: "Edit writing",
            id: "write",
            inputSchema: zWriteInput,
            outputSchema: zWriteOutput,
          }),
        },
      });
      mocks.getAgent.mockReturnValue(agent);
      const request = await parseJournlChatRequest({
        context: {
          activeEditors: [],
          currentDate: "2026-11-07",
          highlightedText: [],
          reasoning: "instant",
          view: { name: "other" },
        },
        messages: [
          {
            id: "user",
            parts: [{ text: "Edit this page", type: "text" }],
            role: "user",
          },
          {
            id: "assistant",
            parts: [
              {
                input: {},
                output: { message: "Original writing result", status },
                state: "output-available",
                toolCallId: "write-first",
                type: "tool-write",
              },
            ],
            role: "assistant",
          },
          ...(newRequest
            ? [
                {
                  id: "next-user",
                  parts: [{ text: "Now try another edit", type: "text" }],
                  role: "user",
                },
              ]
            : []),
        ],
      });
      await memory.saveMessages({
        messages: convertMessages(request.messages.slice(0, 2))
          .to("Mastra.V2")
          .map((message) => ({
            ...message,
            resourceId: "owner",
            threadId: "journl:owner",
          })),
      });
      const invocation = {
        request,
        signal: new AbortController().signal,
        user: {
          createdAt: new Date(),
          email: "owner@example.invalid",
          emailVerified: true,
          id: "owner",
          name: "Owner",
          updatedAt: new Date(),
        },
      };
      const response = await streamJournlChat(invocation);
      const expected = newRequest
        ? "Writing result acknowledged."
        : status === "applied"
          ? "Edit applied."
          : status === "cancelled"
            ? "Writing stopped."
            : "The edit did not apply.";
      expect(await response.text()).toContain(expected);
      expect(model.doStreamCalls).toHaveLength(newRequest ? 1 : 0);
      if (newRequest) {
        expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain(
          "Original writing result",
        );
        expect(
          model.doStreamCalls[0]?.tools?.some(
            (tool) => tool.name === "updateWorkingMemory",
          ),
        ).toBe(true);
      }
      expect(
        await memory.getWorkingMemory({
          resourceId: "owner",
          threadId: "journl:owner",
        }),
      ).toBe("Prefers concise answers.");
      const history = await memory.recall({
        resourceId: "owner",
        threadId: "journl:owner",
      });
      expect(JSON.stringify(history.messages)).toContain(expected);
      if (!newRequest) {
        expect(await (await streamJournlChat(invocation)).text()).toContain(
          expected,
        );
        const repeated = await memory.recall({
          resourceId: "owner",
          threadId: "journl:owner",
        });
        expect(repeated.messages.map((message) => message.id)).toEqual(
          history.messages.map((message) => message.id),
        );
        const original = history.messages.find(
          (message) => message.id === "assistant",
        );
        const saved = repeated.messages.find(
          (message) => message.id === "assistant",
        );
        expect(saved?.createdAt).toEqual(original?.createdAt);
        expect(
          saved?.content.parts.filter(
            (part) => part.type === "text" && part.text.startsWith(expected),
          ),
        ).toHaveLength(1);
        expect(model.doStreamCalls).toHaveLength(0);
        if (status === "applied") {
          const assistant = request.messages.find(
            (message) => message.role === "assistant",
          );
          if (!assistant) throw new Error("Missing test assistant");
          const foreign = { ...assistant, id: "foreign-assistant" };
          await memory.createThread({
            resourceId: "outsider",
            threadId: "foreign-thread",
          });
          await memory.saveMessages({
            messages: convertMessages([foreign])
              .to("Mastra.V2")
              .map((message) => ({
                ...message,
                resourceId: "outsider",
                threadId: "foreign-thread",
              })),
          });
          const before = await memory.recall({
            resourceId: "outsider",
            threadId: "foreign-thread",
          });
          await expect(
            streamJournlChat({
              ...invocation,
              request: { ...request, messages: [foreign] },
            }),
          ).rejects.toThrow("does not belong to this conversation");
          expect(
            (
              await memory.recall({
                resourceId: "outsider",
                threadId: "foreign-thread",
              })
            ).messages,
          ).toEqual(before.messages);
        }
      }
    } finally {
      await store.close();
    }
  },
);

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
