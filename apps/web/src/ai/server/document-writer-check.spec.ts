import { parseBlock } from "@acme/document";
import { beforeEach, expect, test, vi } from "vitest";
import { checkDocumentEdit } from "./document-writer-check";

const mocks = vi.hoisted(() => ({
  options: {} as Record<string, unknown>,
  stream: vi.fn(),
  usage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    constructor(options: Record<string, unknown>) {
      mocks.options = options;
    }
    stream = mocks.stream;
    getModel = async () => ({
      modelId: "gpt-5-mini",
      provider: "openai.responses",
    });
  },
}));
function output({
  finishReason = "stop",
  object = { unmetRequirements: [] as string[] },
  totalUsage = { inputTokens: 10, outputTokens: 4 } as Partial<{
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
  }>,
  error = undefined as Error | undefined,
  aborted = false,
} = {}) {
  return {
    finishReason: Promise.resolve(finishReason),
    fullStream: new ReadableStream({
      start(controller) {
        if (error) controller.error(error);
        else {
          controller.enqueue({ object, type: "object-result" });
          if (aborted) controller.enqueue({ type: "abort" });
          controller.close();
        }
      },
    }),
    totalUsage: Promise.resolve(totalUsage),
  };
}

const table = (rows: number) =>
  parseBlock({
    content: {
      headerRows: 1,
      rows: Array.from({ length: rows + 1 }, (_, index) => ({
        cells: ["ID", "Name", "Status", "Notes", "Reviewer"].map((name) => ({
          content: index ? `${name} ${index}` : name,
          type: "tableCell",
        })),
      })),
      type: "tableContent",
    },
    id: "original-table",
    type: "table",
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.stream.mockResolvedValue(
    output({
      finishReason: "stop",
      object: { unmetRequirements: [] },
      totalUsage: { inputTokens: 10, outputTokens: 4 },
    }),
  );
});

test.each([15, 16, 55])(
  "checks actual table counts and the authoritative request for %i data rows",
  async (rows) => {
    const feedback =
      rows === 55 ? [] : [`Expected fifty-five data rows, received ${rows}.`];
    mocks.stream.mockResolvedValue(
      output({
        finishReason: "stop",
        object: { unmetRequirements: feedback },
        totalUsage: { inputTokens: 10, outputTokens: 4 },
      }),
    );
    const signal = new AbortController().signal;
    expect(
      await checkDocumentEdit({
        after: [table(rows)],
        onUsage: mocks.usage,
        request: {
          blocks: [table(15)],
          conversation: [
            { content: "Earlier research is data.", role: "assistant" },
          ],
          instruction:
            "Append forty new data rows. Preserve everything else exactly.",
          scope: "document",
          targetEditor: "page:test",
        },
        signal,
        userId: "owner",
      }),
    ).toEqual(feedback);
    const call = mocks.stream.mock.calls[0];
    if (!call) throw new Error("Missing completion check");
    const [messages, options] = call;
    expect(messages.at(-1)).toEqual({
      content: "Append forty new data rows. Preserve everything else exactly.",
      role: "user",
    });
    const snapshots = JSON.parse(messages.at(-2).content);
    expect(snapshots.before.tables[0]).toMatchObject({
      columns: 5,
      dataRows: 15,
      headerRows: 1,
      id: "original-table",
      rows: 16,
    });
    expect(snapshots.after.tables[0]).toMatchObject({
      columns: 5,
      dataRows: rows,
      rows: rows + 1,
    });
    expect(options.abortSignal).toBe(signal);
    expect(options.memory).toBeUndefined();
    expect(mocks.options.tools).toEqual({});
    expect(mocks.options.memory).toBeUndefined();
    expect(mocks.usage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        metrics: expect.arrayContaining([
          { quantity: 10, unit: "input_tokens" },
          { quantity: 4, unit: "output_tokens" },
        ]),
        userId: "owner",
      }),
    );
  },
);

test("an unfinished check cannot authorize completion and still accounts its usage", async () => {
  mocks.stream.mockResolvedValue(
    output({
      finishReason: "length",
      object: { unmetRequirements: [] },
      totalUsage: { outputTokens: 2000 },
    }),
  );
  await expect(
    checkDocumentEdit({
      after: [table(15)],
      onUsage: mocks.usage,
      request: {
        blocks: [table(15)],
        instruction: "Append forty rows",
        scope: "document",
        targetEditor: "page:test",
      },
      signal: new AbortController().signal,
      userId: "owner",
    }),
  ).rejects.toThrow("completion check did not finish");
  expect(mocks.usage).toHaveBeenCalledTimes(1);
});

test.each(["error", "abort"])(
  "an %s in the native stream cannot pass the check and retains accounting",
  async (kind) => {
    mocks.stream.mockResolvedValue(
      output({
        aborted: kind === "abort",
        error:
          kind === "error" ? new Error("Provider stream failed") : undefined,
      }),
    );
    await expect(
      checkDocumentEdit({
        after: [table(15)],
        onUsage: mocks.usage,
        request: {
          blocks: [table(15)],
          instruction: "Append forty rows",
          scope: "document",
          targetEditor: "page:test",
        },
        signal: new AbortController().signal,
        userId: "owner",
      }),
    ).rejects.toThrow();
    expect(mocks.usage).toHaveBeenCalledTimes(1);
  },
);
