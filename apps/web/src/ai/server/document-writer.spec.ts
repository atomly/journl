import {
  applyDocumentOperations,
  type DocumentOperation,
  parseBlock,
  zDocumentOperation,
} from "@acme/document";
import {
  standardSchemaToJSONSchema,
  toStandardSchema,
} from "@mastra/core/schema";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import {
  APICallError,
  parseJsonEventStream,
  readUIMessageStream,
  type UIMessageChunk,
  uiMessageChunkSchema,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  agentOptions: {} as Record<string, unknown>,
  model: vi.fn(async () => ({
    modelId: "gpt-5-mini",
    provider: "openai.responses",
  })),
  stream: vi.fn(),
  usage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    constructor(options: Record<string, unknown>) {
      mocks.agentOptions = options;
    }
    getModel = mocks.model;
    stream = mocks.stream;
  },
}));
vi.mock("~/workflows/model-usage", () => ({ startModelUsage: mocks.usage }));

import { webSearch } from "~/ai/tools/web-search";
import { streamDocumentWriter } from "./document-writer";
import type { DocumentWriterRequest } from "./document-writer-request";

const user = {
  createdAt: new Date(),
  email: "owner@example.com",
  emailVerified: true,
  id: "owner",
  name: "Owner",
  updatedAt: new Date(),
};
const block = parseBlock({
  content: [{ styles: { bold: true }, text: "Original", type: "text" }],
  id: "a",
  props: { textAlignment: "center" },
  type: "paragraph",
});
const operation: DocumentOperation = {
  data: {
    content: [{ styles: { bold: true }, text: "Rewritten", type: "text" }],
    props: { textAlignment: "center" },
    type: "paragraph",
  },
  id: "a",
  type: "update",
};
const request: DocumentWriterRequest = {
  blocks: [block],
  instruction: "Rewrite this",
  targetEditor: "page:test",
};
const reportedUsage = { inputTokens: 10, outputTokens: 20, reasoningTokens: 3 };

function output({
  object = { operations: [operation] } as unknown,
  partials = [{ operations: [{ id: "a", type: "update" }] }] as unknown[],
  finishReason = "stop" as string | undefined,
  terminal = undefined as string | undefined,
  error = undefined as Error | undefined,
  beforeFinish = () => {},
  omitFinish = false,
} = {}) {
  return {
    error: undefined,
    finishReason: Promise.resolve(finishReason),
    fullStream: new ReadableStream({
      async start(controller) {
        for (const partial of partials)
          controller.enqueue({ object: partial, type: "object" });
        await beforeFinish();
        if (terminal)
          controller.enqueue({
            payload: { error: "secret-provider-payload" },
            type: terminal,
          });
        if (error) controller.error(error);
        else {
          controller.enqueue({ object, type: "object-result" });
          if (!omitFinish)
            controller.enqueue({
              payload: { finishReason, totalUsage: reportedUsage },
              type: "finish",
            });
          controller.close();
        }
      },
    }),
    object: Promise.resolve(object),
    totalUsage: Promise.resolve(reportedUsage),
  };
}

// Read the real AI SDK transport and message state. No SSE parser or stream
// helpers are replaced, and the document schema/operations remain real.
async function consume(
  response: Response,
  onChunk?: (chunk: UIMessageChunk) => void,
) {
  if (!response.body) throw new Error("Missing response body");
  const chunks: UIMessageChunk[] = [];
  const errors: unknown[] = [];
  const native = parseJsonEventStream({
    schema: uiMessageChunkSchema,
    stream: response.body,
  });
  const stream = native.pipeThrough(
    new TransformStream({
      transform(result, controller) {
        if (!result.success) throw result.error;
        chunks.push(result.value);
        onChunk?.(result.value);
        controller.enqueue(result.value);
      },
    }),
  );
  const messages = [];
  for await (const message of readUIMessageStream({
    onError: (error) => errors.push(error),
    stream,
  })) {
    messages.push(structuredClone(message));
  }
  return { chunks, errors, messages };
}

const generated = (chunks: UIMessageChunk[]) =>
  chunks.filter(
    (chunk) =>
      chunk.type === "data-document-edit" &&
      (chunk.data as { status?: string }).status === "generated",
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usage.mockResolvedValue(undefined);
  mocks.model.mockResolvedValue({
    modelId: "gpt-5-mini",
    provider: "openai.responses",
  });
  mocks.stream.mockImplementation(async () => output());
});

describe("usage accounting through the installed Mastra Agent", () => {
  it.each([
    "success",
    "error",
    "malformed",
    "aborted",
    "unauthorized",
    "quota",
  ] as const)(
    "accounts for native %s exactly once after the stream drains",
    async (outcome) => {
      const { Agent: RealAgent } =
        await vi.importActual<typeof import("@mastra/core/agent")>(
          "@mastra/core/agent",
        );
      const controller = new AbortController();
      const nativeFinish = vi.fn();
      const model = new MockLanguageModelV4({
        doStream: async ({ abortSignal }) => {
          if (outcome === "unauthorized" || outcome === "quota") {
            throw new APICallError({
              data: {
                error: {
                  code:
                    outcome === "quota"
                      ? "insufficient_quota"
                      : "invalid_api_key",
                },
              },
              isRetryable: true,
              message: "Synthetic API failure",
              requestBodyValues: {},
              statusCode: outcome === "quota" ? 429 : 401,
              url: "https://example.invalid",
            });
          }
          return {
            stream: new ReadableStream({
              start(stream) {
                stream.enqueue({ type: "stream-start", warnings: [] });
                stream.enqueue({ id: "proposal", type: "text-start" });
                stream.enqueue({
                  delta: JSON.stringify(
                    outcome === "malformed"
                      ? { operations: [{ type: "delete-everything" }] }
                      : {
                          operations:
                            outcome === "aborted"
                              ? [operation, operation]
                              : [operation],
                        },
                  ),
                  id: "proposal",
                  type: "text-delta",
                });
                stream.enqueue({ id: "proposal", type: "text-end" });
                if (outcome === "aborted") {
                  abortSignal?.addEventListener(
                    "abort",
                    () =>
                      stream.error(
                        new DOMException("Request cancelled", "AbortError"),
                      ),
                    { once: true },
                  );
                  return;
                }
                stream.enqueue({
                  finishReason: {
                    raw: undefined,
                    unified: outcome === "error" ? "error" : "stop",
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
        modelId: "gpt-5-mini",
        provider: "openai.responses",
      });
      const agent = new RealAgent({
        id: "document-writer-native-test",
        instructions: String(mocks.agentOptions.instructions),
        model,
        name: "Document writer native test",
      });
      let nativeResult: Awaited<ReturnType<typeof agent.stream>> | undefined;
      mocks.model.mockImplementation(async () => await agent.getModel());
      mocks.stream.mockImplementation(async (prompt, options) => {
        nativeResult = await agent.stream(prompt, {
          ...options,
          onFinish: nativeFinish,
        });
        return nativeResult;
      });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const { chunks } = await consume(
          await streamDocumentWriter({
            request,
            signal: controller.signal,
            user,
          }),
          (chunk) => {
            if (
              outcome === "aborted" &&
              chunk.type === "data-document-edit" &&
              Array.isArray((chunk.data as { operations?: unknown }).operations)
            )
              controller.abort();
          },
        );
        const attempts = outcome === "malformed" ? 3 : 1;
        const noUsage = ["aborted", "quota", "unauthorized"].includes(outcome);
        expect(model.doStreamCalls).toHaveLength(attempts);
        expect(mocks.usage).toHaveBeenCalledTimes(1);
        expect(mocks.usage).toHaveBeenCalledWith({
          metrics: [
            {
              quantity: noUsage ? 0 : 10 * attempts,
              unit: "input_tokens",
            },
            {
              quantity: noUsage ? 0 : 20 * attempts,
              unit: "output_tokens",
            },
            {
              quantity: noUsage ? 0 : 3 * attempts,
              unit: "reasoning_tokens",
            },
          ],
          modelId: "gpt-5-mini",
          modelProvider: "openai.responses",
          userId: "owner",
        });
        expect(generated(chunks)).toHaveLength(outcome === "success" ? 1 : 0);
        if (
          outcome === "error" ||
          outcome === "malformed" ||
          outcome === "aborted"
        ) {
          expect(nativeFinish).not.toHaveBeenCalled();
        }
        if (outcome === "aborted") {
          expect(await nativeResult?.finishReason).toBe("aborted");
          expect(chunks).toContainEqual({ type: "abort" });
        }
      } finally {
        log.mockRestore();
      }
    },
  );
});

describe("native validation retries", () => {
  it.each([
    { correctOn: 2, kind: "atom" },
    { correctOn: 3, kind: "atom" },
    { correctOn: 0, kind: "atom" },
    { correctOn: 2, kind: "reference" },
    { correctOn: 3, kind: "move" },
    { correctOn: 2, kind: "children" },
  ])(
    "bounds correction of $kind errors (success attempt: $correctOn)",
    async ({ correctOn, kind }) => {
      const { Agent: RealAgent } =
        await vi.importActual<typeof import("@mastra/core/agent")>(
          "@mastra/core/agent",
        );
      let calls = 0;
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: new ReadableStream({
            start(stream) {
              calls += 1;
              const operations =
                correctOn && calls === correctOn
                  ? [operation]
                  : kind === "children"
                    ? [
                        {
                          ...operation,
                          data: {
                            ...(operation.type === "update"
                              ? operation.data
                              : {}),
                            children: [],
                          },
                        },
                      ]
                    : kind === "reference"
                      ? [{ id: "missing", type: "remove" }]
                      : kind === "move"
                        ? [
                            {
                              afterId: null,
                              id: "a",
                              parentId: "a",
                              type: "move",
                            },
                          ]
                        : [
                            {
                              afterId: "a",
                              block: {
                                content: "PRIVATE_DOC_TEXT",
                                id: "image",
                                type: "image",
                              },
                              parentId: null,
                              type: "insert",
                            },
                          ];
              stream.enqueue({ type: "stream-start", warnings: [] });
              stream.enqueue({ id: "proposal", type: "text-start" });
              stream.enqueue({
                delta: JSON.stringify({ operations }),
                id: "proposal",
                type: "text-delta",
              });
              stream.enqueue({ id: "proposal", type: "text-end" });
              stream.enqueue({
                finishReason: { raw: undefined, unified: "stop" },
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
        }),
        modelId: "gpt-5-mini",
        provider: "openai.responses",
      });
      const agent = new RealAgent({
        id: "writer-retry-test",
        instructions: String(mocks.agentOptions.instructions),
        model,
        name: "Writer retry test",
      });
      mocks.stream.mockImplementation((prompt, options) =>
        agent.stream(prompt, options),
      );
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const before = structuredClone(request.blocks);
        const { chunks, errors } = await consume(
          await streamDocumentWriter({
            request,
            signal: new AbortController().signal,
            user,
          }),
        );
        const correction = chunks.findIndex(
          (chunk) =>
            chunk.type === "data-document-edit" &&
            (chunk.data as { status?: string }).status === "correcting",
        );
        expect(correction).toBeGreaterThanOrEqual(0);
        expect(
          chunks
            .slice(correction + 1)
            .some(
              (chunk) =>
                chunk.type === "data-document-edit" &&
                (chunk.data as { status?: string }).status === "generating",
            ),
        ).toBe(false);
        const corrected = correctOn > 0;
        expect(calls).toBe(correctOn || 3);
        expect(request.blocks).toEqual(before);
        expect(generated(chunks)).toHaveLength(corrected ? 1 : 0);
        expect(errors).toHaveLength(corrected ? 0 : 1);
        expect(mocks.usage).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            metrics: [
              { quantity: 10 * calls, unit: "input_tokens" },
              { quantity: 20 * calls, unit: "output_tokens" },
              { quantity: 3 * calls, unit: "reasoning_tokens" },
            ],
          }),
        );
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
          kind === "children"
            ? "remove these undeclared fields: children"
            : kind === "atom"
              ? "operations[0].block.content: this field must be absent; omit it"
              : kind === "reference"
                ? "An operation references a block outside the current editable scope"
                : "A move must not place a block inside itself or any of its descendants",
        );
        const systemFeedback = model.doStreamCalls[1]?.prompt.filter(
          (message) => message.role === "system",
        );
        expect(JSON.stringify(systemFeedback)).not.toContain(
          "PRIVATE_DOC_TEXT",
        );
      } finally {
        log.mockRestore();
      }
    },
  );
});

it("a native generation timeout stops a stalled stream without applying or retrying", async () => {
  const { Agent: RealAgent } =
    await vi.importActual<typeof import("@mastra/core/agent")>(
      "@mastra/core/agent",
    );
  const model = new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ id: "pending", type: "text-start" });
          controller.enqueue({
            delta: JSON.stringify({ operations: [operation] }),
            id: "pending",
            type: "text-delta",
          });
          abortSignal?.addEventListener(
            "abort",
            () => controller.error(abortSignal.reason),
            { once: true },
          );
        },
      }),
    }),
    modelId: "gpt-5-mini",
    provider: "openai.responses",
  });
  const agent = new RealAgent({
    id: "writer-timeout-test",
    instructions: "Edit the supplied document",
    model,
    name: "Writer timeout test",
  });
  mocks.stream.mockImplementation((prompt, options) =>
    agent.stream(prompt, {
      ...options,
      modelSettings: {
        ...options.modelSettings,
        timeout: { stepMs: 50, totalMs: 10_000 },
      },
    }),
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const before = structuredClone(request.blocks);
    const { chunks, errors } = await consume(
      await streamDocumentWriter({
        request,
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(model.doStreamCalls).toHaveLength(1);
    expect(generated(chunks)).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(request.blocks).toEqual(before);
  } finally {
    log.mockRestore();
  }
});

describe("document writer proposal stream", () => {
  it.each([false, true])(
    "native preferences stay read-only and completed research is charged (abort: %s)",
    async (cancelled) => {
      const { Agent: RealAgent } =
        await vi.importActual<typeof import("@mastra/core/agent")>(
          "@mastra/core/agent",
        );
      const store = new LibSQLStore({
        id: crypto.randomUUID(),
        url: ":memory:",
      });
      const memory = new Memory({
        options: {
          generateTitle: false,
          semanticRecall: false,
          workingMemory: { enabled: true, scope: "resource" },
        },
        storage: store,
      });
      const threadId = "journl:owner";
      await memory.createThread({ resourceId: user.id, threadId });
      await memory.updateWorkingMemory({
        resourceId: user.id,
        threadId,
        workingMemory: "Use Cedar Ledger in fictional examples.",
      });
      await memory.saveMessages({
        messages: [
          {
            content: {
              format: 2,
              parts: [
                {
                  text: "PRIVATE_OLD_CHAT_MUST_NOT_ENTER_WRITER",
                  type: "text",
                },
              ],
            },
            createdAt: new Date(1700000000000),
            id: "historic",
            resourceId: user.id,
            role: "user",
            threadId,
            type: "text",
          },
        ],
      });
      const before = await memory.recall({ resourceId: user.id, threadId });
      const cancellation = new AbortController();
      const model = new MockLanguageModelV4({
        doStream: async ({ prompt, tools, abortSignal }) => {
          expect(JSON.stringify(prompt)).toContain(
            "Use Cedar Ledger in fictional examples.",
          );
          expect(JSON.stringify(prompt)).not.toContain(
            "PRIVATE_OLD_CHAT_MUST_NOT_ENTER_WRITER",
          );
          expect(tools?.map((tool) => tool.name)).toEqual(["webSearch"]);
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({
                  input: "{}",
                  providerExecuted: true,
                  toolCallId: "research",
                  toolName: "webSearch",
                  type: "tool-call",
                });
                const result = {
                  action: { queries: ["MDN HTTP"], type: "search" },
                  sources: [
                    {
                      type: "url",
                      url: "https://developer.mozilla.org/en-US/docs/Web/HTTP",
                    },
                  ],
                };
                controller.enqueue({
                  preliminary: true,
                  result,
                  toolCallId: "research",
                  toolName: "webSearch",
                  type: "tool-result",
                });
                controller.enqueue({
                  result,
                  toolCallId: "research",
                  toolName: "webSearch",
                  type: "tool-result",
                });
                if (cancelled) {
                  abortSignal?.addEventListener(
                    "abort",
                    () => controller.error(abortSignal.reason),
                    { once: true },
                  );
                  return;
                }
                controller.enqueue({ id: "proposal", type: "text-start" });
                controller.enqueue({
                  delta: JSON.stringify({ operations: [operation] }),
                  id: "proposal",
                  type: "text-delta",
                });
                controller.enqueue({ id: "proposal", type: "text-end" });
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
          };
        },
      });
      const agent = new RealAgent({
        id: "research-writer-test",
        instructions: String(mocks.agentOptions.instructions),
        memory,
        model,
        name: "Research writer test",
        tools: { webSearch },
      });
      mocks.stream.mockImplementation(async (prompt, options) => {
        const result = await agent.stream(prompt, options);
        return {
          get finishReason() {
            return result.finishReason;
          },
          fullStream: (async function* () {
            for await (const chunk of result.fullStream) {
              yield chunk;
              if (
                cancelled &&
                chunk.type === "tool-result" &&
                !chunk.payload.preliminary
              )
                cancellation.abort();
            }
          })(),
          get totalUsage() {
            return result.totalUsage;
          },
        };
      });
      try {
        const output = await consume(
          await streamDocumentWriter({
            request,
            signal: cancellation.signal,
            user,
          }),
        );
        expect(generated(output.chunks)).toHaveLength(cancelled ? 0 : 1);
        expect(mocks.usage).toHaveBeenCalledOnce();
        expect(mocks.usage.mock.calls[0]?.[0].metrics).toContainEqual({
          quantity: 1,
          unit: "web_search_calls",
        });
        expect(
          (await memory.recall({ resourceId: user.id, threadId })).messages,
        ).toEqual(before.messages);
        expect(
          await memory.getWorkingMemory({ resourceId: user.id, threadId }),
        ).toBe("Use Cedar Ledger in fictional examples.");
      } finally {
        await store.close();
      }
    },
  );

  it("keeps actual conversation context before the current authoritative request", async () => {
    await consume(
      await streamDocumentWriter({
        request: {
          ...request,
          conversation: [
            { content: "A recipe for two people.", role: "assistant" },
          ],
          instruction: "Write that recipe into this page.",
        },
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(mocks.stream.mock.calls[0]?.[0]).toEqual([
      {
        content: "A recipe for two people.",
        role: "assistant",
      },
      { content: JSON.stringify({ blocks: request.blocks }), role: "user" },
      {
        content: "Write that recipe into this page.",
        role: "user",
      },
    ]);
  });

  it("streams a recipe as distinct headings, paragraphs, and sibling list blocks", async () => {
    const recipe: DocumentOperation[] = [
      {
        data: {
          content: "Smoky turkey melt",
          props: { level: 1 },
          type: "heading",
        },
        id: "a",
        type: "update",
      },
      ...[
        { content: "Ready in 25 minutes.", id: "intro", type: "paragraph" },
        {
          content: "Ingredients",
          id: "ingredients",
          props: { level: 2 },
          type: "heading",
        },
        { content: "Turkey", id: "turkey", type: "bulletListItem" },
        { content: "Chipotle mayo", id: "mayo", type: "bulletListItem" },
        {
          content: "Method",
          id: "method",
          props: { level: 2 },
          type: "heading",
        },
        { content: "Toast the bread.", id: "toast", type: "numberedListItem" },
        {
          content: "Assemble the sandwich.",
          id: "assemble",
          type: "numberedListItem",
        },
      ].map((block, index, blocks) => ({
        afterId: index === 0 ? "a" : (blocks[index - 1]?.id ?? "a"),
        block: parseBlock(block),
        parentId: null,
        type: "insert" as const,
      })),
    ];
    mocks.stream.mockImplementation(async () =>
      output({
        object: { operations: recipe },
        partials: recipe.map((_operation, index) => ({
          operations: recipe.slice(0, index + 1),
        })),
      }),
    );
    const { chunks, errors } = await consume(
      await streamDocumentWriter({
        request: { ...request, instruction: "Write a sandwich recipe." },
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(errors).toEqual([]);
    expect(
      chunks.filter((chunk) => chunk.type === "data-document-edit"),
    ).toHaveLength(recipe.length + 1);
    const final = generated(chunks)[0];
    if (final?.type !== "data-document-edit")
      throw new Error("Missing final edit");
    const operations = z
      .object({ operations: z.array(zDocumentOperation) })
      .parse(final.data).operations;
    const accepted = applyDocumentOperations(request.blocks, operations);
    const progress = chunks
      .map((chunk) =>
        chunk.type === "data-document-edit" ? chunk.data : undefined,
      )
      .filter(
        (data) =>
          z.object({ status: z.literal("generating") }).safeParse(data).success,
      );
    expect(
      z.object({ operations: z.array(zDocumentOperation) }).parse(progress[2])
        .operations[1],
    ).toEqual(operations[1]);
    expect(accepted[0]?.id).toBe("a");
    expect(
      accepted.slice(1).every((block) => /^[a-f0-9-]{36}$/.test(block.id)),
    ).toBe(true);
    expect(accepted.map((item) => item.type)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "bulletListItem",
      "bulletListItem",
      "heading",
      "numberedListItem",
      "numberedListItem",
    ]);
    expect(accepted.every((item) => !item.children?.length)).toBe(true);

    const options = mocks.stream.mock.calls[0]?.[1];
    const schema = standardSchemaToJSONSchema(
      toStandardSchema(options.structuredOutput.schema),
      { io: "input" },
    );
    expect(JSON.stringify(schema)).toContain('"tableCell"');
    expect(JSON.stringify(schema)).not.toContain('"$ref"');
    expect(JSON.stringify(schema)).not.toContain('"children"');
    const atomSchemas: { properties: Record<string, unknown> }[] = [];
    const visitSchema = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(visitSchema);
        return;
      }
      const entry = value as { properties?: { type?: { const?: string } } };
      if (["image", "divider"].includes(entry.properties?.type?.const ?? ""))
        atomSchemas.push(entry as { properties: Record<string, unknown> });
      Object.values(value).forEach(visitSchema);
    };
    visitSchema(schema);
    expect(atomSchemas.length).toBeGreaterThanOrEqual(2);
    for (const atom of atomSchemas)
      expect(atom.properties).not.toHaveProperty("content");
  });

  it("streams transient previews and emits only a complete, atomically valid proposal", async () => {
    const before = structuredClone(request);
    const response = await streamDocumentWriter({
      request,
      signal: new AbortController().signal,
      user,
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    const { chunks, errors, messages } = await consume(response);
    expect(errors).toEqual([]);
    expect(chunks).toContainEqual({
      data: { status: "generating" },
      transient: true,
      type: "data-document-edit",
    });
    expect(generated(chunks)).toEqual([
      {
        data: { operations: [operation], status: "generated" },
        type: "data-document-edit",
      },
    ]);
    expect(messages.at(-1)?.parts).toEqual([
      {
        data: { operations: [operation], status: "generated" },
        type: "data-document-edit",
      },
    ]);
    expect(
      applyDocumentOperations(request.blocks, [operation])[0],
    ).toMatchObject({
      content: [{ styles: { bold: true }, text: "Rewritten" }],
      id: "a",
      props: { textAlignment: "center" },
    });
    expect(request).toEqual(before);
  });

  it.each([
    ["missing target", [operation, { id: "outside-scope", type: "remove" }]],
    [
      "duplicate ID",
      [operation, { afterId: null, block, parentId: null, type: "insert" }],
    ],
    [
      "malformed block",
      [
        {
          afterId: null,
          block: {
            id: "7de10000-0000-4000-8000-000000000001",
            type: "invented",
          },
          parentId: null,
          type: "insert",
        },
      ],
    ],
    ["malformed operation", [{ type: "delete-everything" }]],
    [
      "image with invalid empty content",
      [
        {
          afterId: "a",
          block: {
            content: "",
            id: "image",
            props: { url: "https://example.com/image.png" },
            type: "image",
          },
          parentId: null,
          type: "insert",
        },
      ],
    ],
    [
      "divider with invalid empty content",
      [
        {
          afterId: "a",
          block: { content: "", id: "divider", type: "divider" },
          parentId: null,
          type: "insert",
        },
      ],
    ],
    ["unknown operation fields", [{ ...operation, userId: "forged" }]],
    [
      "opaque legacy insert",
      [
        {
          afterId: null,
          block: {
            id: "7de10000-0000-4000-8000-000000000002",
            payload: { private: "content" },
            type: "legacyUnknown",
          },
          parentId: null,
          type: "insert",
        },
      ],
    ],
    [
      "opaque legacy update",
      [
        {
          data: { payload: { private: "content" }, type: "legacyUnknown" },
          id: "a",
          type: "update",
        },
      ],
    ],
    [
      "nested opaque legacy insert",
      [
        {
          afterId: null,
          block: {
            children: [
              {
                id: "7de10000-0000-4000-8000-000000000002",
                payload: {},
                type: "legacyUnknown",
              },
            ],
            id: "7de10000-0000-4000-8000-000000000003",
            type: "paragraph",
          },
          parentId: null,
          type: "insert",
        },
      ],
    ],
  ])(
    "rejects %s without exposing a generated batch or changing input",
    async (_name, operations) => {
      const before = structuredClone(request.blocks);
      mocks.stream.mockImplementation(async () =>
        output({ object: { operations } }),
      );
      const { chunks, errors } = await consume(
        await streamDocumentWriter({
          request,
          signal: new AbortController().signal,
          user,
        }),
      );
      expect(generated(chunks)).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(chunks).toContainEqual({
        errorText: "The document edit could not be generated. Please retry.",
        type: "error",
      });
      expect(request.blocks).toEqual(before);
      expect(mocks.usage).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["length", "content-filter", "error", "suspended", undefined])(
    "rejects an interrupted finish: %s",
    async (finishReason) => {
      mocks.stream.mockImplementation(async () => ({
        ...output(),
        finishReason: Promise.resolve(finishReason),
      }));
      const { chunks, errors } = await consume(
        await streamDocumentWriter({
          request,
          signal: new AbortController().signal,
          user,
        }),
      );
      expect(generated(chunks)).toEqual([]);
      expect(errors).toHaveLength(1);
    },
  );

  it.each(["error", "tripwire"])(
    "rejects a native %s even if the model provides an otherwise valid object",
    async (terminal) => {
      mocks.stream.mockImplementation(async () => output({ terminal }));
      const { chunks } = await consume(
        await streamDocumentWriter({
          request,
          signal: new AbortController().signal,
          user,
        }),
      );
      expect(generated(chunks)).toEqual([]);
      expect(JSON.stringify(chunks)).not.toContain("secret-provider-payload");
    },
  );

  it("rejects a stream that closes without its native finish event", async () => {
    mocks.stream.mockImplementation(async () => output({ omitFinish: true }));
    const { chunks, errors } = await consume(
      await streamDocumentWriter({
        request,
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(generated(chunks)).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it("sanitizes a provider stream failure", async () => {
    mocks.stream.mockImplementation(async () =>
      output({ error: new Error("secret-provider-payload") }),
    );
    const { chunks, errors } = await consume(
      await streamDocumentWriter({
        request,
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(generated(chunks)).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(chunks)).not.toContain("secret-provider-payload");
  });

  it("forwards request cancellation and records reported usage without completing the proposal", async () => {
    const controller = new AbortController();
    const cancelled = new Promise<void>((resolve) =>
      controller.signal.addEventListener("abort", () => resolve(), {
        once: true,
      }),
    );
    mocks.stream.mockImplementation(async () =>
      output({ beforeFinish: () => cancelled }),
    );
    const { chunks, errors } = await consume(
      await streamDocumentWriter({ request, signal: controller.signal, user }),
      (chunk) => {
        if (chunk.type === "data-document-edit") controller.abort();
      },
    );
    expect(mocks.stream.mock.calls[0]?.[1].abortSignal).toBe(controller.signal);
    expect(generated(chunks)).toEqual([]);
    expect(chunks).toContainEqual({
      data: { status: "generating" },
      transient: true,
      type: "data-document-edit",
    });
    expect(chunks).toContainEqual({ type: "abort" });
    expect(errors).toEqual([]);
    expect(mocks.usage).toHaveBeenCalledTimes(1);
  });

  it("honors a native cancellation even before the request signal changes", async () => {
    mocks.stream.mockImplementation(async () => output({ terminal: "abort" }));
    const { chunks } = await consume(
      await streamDocumentWriter({
        request,
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(generated(chunks)).toEqual([]);
    expect(chunks).toContainEqual({ type: "abort" });
  });

  it("does not start a model run for an already cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    const { chunks } = await consume(
      await streamDocumentWriter({ request, signal: controller.signal, user }),
    );
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.usage).not.toHaveBeenCalled();
    expect(generated(chunks)).toEqual([]);
    expect(chunks).toContainEqual({ type: "abort" });
  });

  it("keeps previews generating even when a partial object claims completion", async () => {
    mocks.stream.mockImplementation(async () =>
      output({
        finishReason: "length",
        partials: [
          { operations: [operation, { type: "update" }], status: "generated" },
        ],
      }),
    );
    const { chunks } = await consume(
      await streamDocumentWriter({
        request,
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(generated(chunks)).toEqual([]);
    expect(chunks).toContainEqual({
      data: { operations: [operation], status: "generating" },
      transient: true,
      type: "data-document-edit",
    });
  });

  it("uses a bounded agent with the shared schema, native strict validation, and trusted usage identity", async () => {
    const extra = {
      ...request,
      model: "forged",
      reasoningEffort: "high" as const,
      tools: { forged: {} },
      userId: "forged",
    };
    await consume(
      await streamDocumentWriter({
        request: extra,
        signal: new AbortController().signal,
        user,
      }),
    );
    expect(mocks.agentOptions).toMatchObject({
      id: "document-writer",
      model: { modelId: "gpt-5-mini" },
    });
    expect(Object.keys(mocks.agentOptions.tools as object)).toEqual([
      "webSearch",
    ]);
    expect(mocks.agentOptions.memory).toEqual(expect.any(Function));
    const [prompt, options] = mocks.stream.mock.calls[0] ?? [];
    expect(prompt).toEqual([
      { content: JSON.stringify({ blocks: request.blocks }), role: "user" },
      { content: request.instruction, role: "user" },
    ]);
    expect(options).toMatchObject({
      maxSteps: 1,
      memory: {
        options: { lastMessages: false, readOnly: true, semanticRecall: false },
        resource: user.id,
        thread: "journl:owner",
      },
      providerOptions: {
        openai: {
          reasoningEffort: "high",
          store: false,
          strictJsonSchema: true,
        },
      },
      structuredOutput: {
        errorStrategy: "strict",
        jsonPromptInjection: false,
      },
    });
    expect(options).not.toHaveProperty("tools");
    expect(options).not.toHaveProperty("onFinish");
    const schema = options.structuredOutput.schema;
    const nativeSchema = toStandardSchema(schema);
    expect(
      await nativeSchema["~standard"].validate({
        operations: [
          {
            afterId: null,
            block: { id: "new", type: "unknown" },
            parentId: null,
            type: "insert",
          },
        ],
      }),
    ).toHaveProperty("issues");
    // Native schema injection can serialize the shared transform's input.
    expect(
      standardSchemaToJSONSchema(nativeSchema, { io: "input" }),
    ).toMatchObject({
      properties: { operations: { type: "array" } },
      type: "object",
    });
    expect(mocks.usage).toHaveBeenCalledWith({
      metrics: [
        { quantity: 10, unit: "input_tokens" },
        { quantity: 20, unit: "output_tokens" },
        { quantity: 3, unit: "reasoning_tokens" },
      ],
      modelId: "gpt-5-mini",
      modelProvider: "openai.responses",
      userId: "owner",
    });
  });

  it("keeps a valid proposal available if usage dispatch fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.usage.mockRejectedValueOnce(new Error("usage queue unavailable"));
    try {
      const { chunks, errors } = await consume(
        await streamDocumentWriter({
          request,
          signal: new AbortController().signal,
          user,
        }),
      );
      expect(generated(chunks)).toHaveLength(1);
      expect(errors).toEqual([]);
      expect(log).toHaveBeenCalledWith(
        "[usage tracking] error:",
        expect.any(Error),
      );
    } finally {
      log.mockRestore();
    }
  });

  it("keeps a valid proposal available if the SDK cannot report usage", async () => {
    const error = new Error("Usage unavailable after stream failure");
    mocks.stream.mockImplementation(async () => ({
      ...output(),
      get totalUsage() {
        return Promise.reject(error);
      },
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { chunks, errors } = await consume(
        await streamDocumentWriter({
          request,
          signal: new AbortController().signal,
          user,
        }),
      );
      expect(generated(chunks)).toHaveLength(1);
      expect(errors).toEqual([]);
      expect(mocks.usage).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "[usage tracking] error:",
        error,
      );
    } finally {
      log.mockRestore();
    }
  });
});

it("streams a completed table operation once, never its schema-valid unfinished cells", async () => {
  const table: DocumentOperation = {
    data: {
      content: {
        rows: [
          {
            cells: [
              { content: "A", type: "tableCell" },
              { content: "B", type: "tableCell" },
            ],
          },
          {
            cells: [
              { content: "1", type: "tableCell" },
              { content: "2", type: "tableCell" },
            ],
          },
        ],
        type: "tableContent",
      },
      type: "table",
    },
    id: "a",
    type: "update",
  };
  mocks.stream.mockImplementation(async () =>
    output({
      object: { operations: [table] },
      partials: [
        { operations: [{ data: { type: "table" }, id: "a", type: "update" }] },
        {
          operations: [
            {
              ...table,
              data: {
                content: { rows: [{ cells: ["A"] }], type: "tableContent" },
                type: "table",
              },
            },
          ],
        },
        { operations: [table, { type: "insert" }] },
        { operations: [table, { parentId: null, type: "insert" }] },
      ],
    }),
  );
  const { chunks, errors } = await consume(
    await streamDocumentWriter({
      request,
      signal: new AbortController().signal,
      user,
    }),
  );
  const previews = chunks.filter(
    (chunk) =>
      chunk.type === "data-document-edit" &&
      (chunk.data as { operations?: unknown; status?: string }).status ===
        "generating" &&
      Array.isArray((chunk.data as { operations?: unknown }).operations),
  );
  expect(errors).toEqual([]);
  expect(previews).toEqual([
    {
      data: { operations: [table], status: "generating" },
      transient: true,
      type: "data-document-edit",
    },
  ]);
  expect(generated(chunks)).toHaveLength(1);
});

it("compiles compact table additions only at complete operation boundaries", async () => {
  const existing = parseBlock({
    content: {
      headerRows: 1,
      rows: [
        {
          cells: [
            { content: "Name", type: "tableCell" },
            { content: "Status", type: "tableCell" },
          ],
        },
        {
          cells: [
            { content: "Alice", type: "tableCell" },
            { content: "Ready", type: "tableCell" },
          ],
        },
      ],
      type: "tableContent",
    },
    id: "table",
    type: "table",
  });
  const addition = {
    id: "table",
    rows: [
      {
        cells: [
          { content: "Bob", type: "tableCell" },
          { content: "New", type: "tableCell" },
        ],
      },
    ],
    type: "appendTableRows",
  };
  const conclusion = {
    afterId: "table",
    block: { content: "Finished", id: "conclusion", type: "paragraph" },
    parentId: null,
    type: "insert",
  };
  mocks.stream.mockImplementation(async () =>
    output({
      object: { operations: [addition, conclusion] },
      partials: [
        {
          operations: [
            {
              ...addition,
              rows: [{ cells: [{ content: "B", type: "tableCell" }] }],
            },
          ],
        },
        { operations: [addition, { type: "insert" }] },
        { operations: [addition, { parentId: null, type: "insert" }] },
      ],
    }),
  );
  const { chunks, errors } = await consume(
    await streamDocumentWriter({
      request: { ...request, blocks: [existing] },
      signal: new AbortController().signal,
      user,
    }),
  );
  expect(errors).toEqual([]);
  const previews = chunks.filter(
    (chunk) =>
      chunk.type === "data-document-edit" &&
      (chunk.data as { status?: string }).status === "generating" &&
      Array.isArray((chunk.data as { operations?: unknown }).operations),
  );
  expect(previews).toHaveLength(1);
  const preview = previews[0] as { data: { operations: DocumentOperation[] } };
  expect(preview.data.operations.map((operation) => operation.type)).toEqual([
    "update",
  ]);
  const displayed = applyDocumentOperations(
    [existing],
    preview.data.operations,
  );
  expect(displayed[0]).toMatchObject({
    content: {
      rows: expect.arrayContaining([
        {
          cells: [
            { content: "Bob", type: "tableCell" },
            { content: "New", type: "tableCell" },
          ],
        },
      ]),
    },
  });
  expect(generated(chunks)).toHaveLength(1);
});
