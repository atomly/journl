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
import {
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
  it.each(["success", "error", "malformed", "aborted"] as const)(
    "accounts for native %s exactly once after the stream drains",
    async (outcome) => {
      const { Agent: RealAgent } =
        await vi.importActual<typeof import("@mastra/core/agent")>(
          "@mastra/core/agent",
        );
      const controller = new AbortController();
      const nativeFinish = vi.fn();
      const model = new MockLanguageModelV4({
        doStream: async ({ abortSignal }) => ({
          stream: new ReadableStream({
            start(stream) {
              stream.enqueue({ type: "stream-start", warnings: [] });
              stream.enqueue({ id: "proposal", type: "text-start" });
              stream.enqueue({
                delta: JSON.stringify(
                  outcome === "malformed"
                    ? { operations: [{ type: "delete-everything" }] }
                    : { operations: [operation] },
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
        }),
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
            if (outcome === "aborted" && chunk.type === "data-document-edit")
              controller.abort();
          },
        );
        const attempts = outcome === "malformed" ? 2 : 1;
        expect(model.doStreamCalls).toHaveLength(attempts);
        expect(mocks.usage).toHaveBeenCalledTimes(1);
        expect(mocks.usage).toHaveBeenCalledWith({
          metrics: [
            {
              quantity: outcome === "aborted" ? 0 : 10 * attempts,
              unit: "input_tokens",
            },
            {
              quantity: outcome === "aborted" ? 0 : 20 * attempts,
              unit: "output_tokens",
            },
            {
              quantity: outcome === "aborted" ? 0 : 3 * attempts,
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
  it.each([true, false])(
    "bounds correction of invalid block references (corrected: %s)",
    async (corrected) => {
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
                corrected && calls === 2
                  ? [operation]
                  : [{ id: "missing", type: "remove" }];
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
        expect(calls).toBe(2);
        expect(request.blocks).toEqual(before);
        expect(generated(chunks)).toHaveLength(corrected ? 1 : 0);
        expect(errors).toHaveLength(corrected ? 0 : 1);
        expect(mocks.usage).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            metrics: [
              { quantity: 20, unit: "input_tokens" },
              { quantity: 40, unit: "output_tokens" },
              { quantity: 6, unit: "reasoning_tokens" },
            ],
          }),
        );
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
          "The operation batch is invalid",
        );
      } finally {
        log.mockRestore();
      }
    },
  );
});

describe("document writer proposal stream", () => {
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
      z.object({ operations: z.array(zDocumentOperation) }).parse(progress[1])
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
    // Insert payloads used to be {}, because the document parser accepts unknown
    // input before validating it. The model now receives the recursive variants.
    const insert = (
      schema as {
        properties: {
          operations: {
            items: {
              oneOf: {
                properties: { type: { const: string }; block?: unknown };
              }[];
            };
          };
        };
      }
    ).properties.operations.items.oneOf.find(
      (variant) => variant.properties.type.const === "insert",
    );
    expect(insert?.properties.block).not.toEqual({});
    expect(JSON.stringify(insert?.properties.block)).toContain("$ref");
    expect(JSON.stringify(schema)).toContain('"children"');
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
      data: { operations: [], status: "generating" },
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
      data: { operations: [], status: "generating" },
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
        partials: [{ operations: [operation], status: "generated" }],
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
    expect(mocks.agentOptions).not.toHaveProperty("tools");
    expect(mocks.agentOptions).not.toHaveProperty("memory");
    const [prompt, options] = mocks.stream.mock.calls[0] ?? [];
    expect(JSON.parse(prompt)).toEqual({
      blocks: request.blocks,
      instruction: request.instruction,
    });
    expect(options).toMatchObject({
      maxSteps: 1,
      providerOptions: {
        openai: {
          reasoningEffort: "high",
          store: false,
          strictJsonSchema: false,
        },
      },
      structuredOutput: {
        errorStrategy: "strict",
        jsonPromptInjection: false,
      },
    });
    expect(options).not.toHaveProperty("tools");
    expect(options).not.toHaveProperty("memory");
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
