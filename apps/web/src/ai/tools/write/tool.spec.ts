import { Agent } from "@mastra/core/agent";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { write } from "./tool";

test("the native provider receives a strict argument-free writing contract", async () => {
  let checked = false;
  const model = new MockLanguageModelV4({
    doStream: async ({ tools }) => {
      const tool = tools?.find(
        (tool) => tool.type === "function" && tool.name === "write",
      );
      expect(tool).toMatchObject({
        inputSchema: { additionalProperties: false },
        strict: true,
        type: "function",
      });
      if (tool?.type !== "function") throw new Error("Missing write tool");
      expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual([]);
      checked = true;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              input: "{}",
              toolCallId: "write-one",
              toolName: "write",
              type: "tool-call",
            });
            controller.enqueue({
              finishReason: { raw: undefined, unified: "tool-calls" },
              type: "finish",
              usage: {
                inputTokens: {
                  cacheRead: 0,
                  cacheWrite: 0,
                  noCache: 10,
                  total: 10,
                },
                outputTokens: { reasoning: 0, text: 5, total: 5 },
              },
            });
            controller.close();
          },
        }),
      };
    },
  });
  const agent = new Agent({
    id: "writing-contract-test",
    instructions: "Edit writing.",
    model,
    name: "Writing contract test",
    tools: { write },
  });
  const result = await agent.stream("Add lorem ipsum", { maxSteps: 1 });
  const calls = [];
  for await (const chunk of result.fullStream)
    if (chunk.type === "tool-call") calls.push(chunk);
  expect(checked).toBe(true);
  expect(calls).toHaveLength(1);
});
