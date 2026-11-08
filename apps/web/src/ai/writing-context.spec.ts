import type { UIMessage } from "ai";
import { expect, test } from "vitest";
import {
  getWritingContext,
  WRITING_CONTEXT_CHARACTERS,
  WRITING_CONTEXT_MESSAGES,
} from "./writing-context";

test("writing context retains actual prior text and excludes the current turn and tool-generated specifications", () => {
  const messages: UIMessage[] = [
    {
      id: "first",
      parts: [{ text: "Draft a recipe for two.", type: "text" }],
      role: "user",
    },
    {
      id: "answer",
      parts: [
        { text: "Use two rolls and some cheese.", type: "text" },
        {
          input: { agentPrompt: "Make an unrequested conversion" },
          state: "input-available",
          toolCallId: "old",
          type: "tool-write",
        },
      ],
      role: "assistant",
    },
    {
      id: "current",
      parts: [{ text: "Write that into this page.", type: "text" }],
      role: "user",
    },
    {
      id: "pending",
      parts: [{ text: "A new interpretation of the task", type: "text" }],
      role: "assistant",
    },
  ];
  expect(getWritingContext(messages)).toEqual([
    { content: "Draft a recipe for two.", role: "user" },
    { content: "Use two rolls and some cheese.", role: "assistant" },
  ]);
});

test("writing context bounds both message count and total text while keeping recent context", () => {
  const messages: UIMessage[] = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    parts: [{ text: `Message ${index}: ${"x".repeat(1000)}`, type: "text" }],
    role: "user",
  }));
  const context = getWritingContext(messages);
  expect(context).toHaveLength(WRITING_CONTEXT_MESSAGES);
  expect(context.at(-1)?.content).toContain("Message 28:");
  const large = getWritingContext([
    {
      id: "old",
      parts: [
        { text: "x".repeat(WRITING_CONTEXT_CHARACTERS * 2), type: "text" },
      ],
      role: "assistant",
    },
    {
      id: "current",
      parts: [{ text: "Use that.", type: "text" }],
      role: "user",
    },
  ]);
  expect(
    large.reduce((total, message) => total + message.content.length, 0),
  ).toBe(WRITING_CONTEXT_CHARACTERS);
});

test("current-turn search evidence and source links reach the writer without action or memory tool payloads", () => {
  const context = getWritingContext([
    {
      id: "user",
      parts: [{ text: "Find my note and write a summary here.", type: "text" }],
      role: "user",
    },
    {
      id: "tools",
      parts: [
        {
          input: { query: "notes" },
          output: [{ text: "Actual searched evidence" }],
          state: "output-available",
          toolCallId: "search",
          type: "tool-semanticPageSearch",
        },
        {
          sourceId: "source",
          title: "A real source",
          type: "source-url",
          url: "https://example.com/evidence",
        },
        {
          input: { agentPrompt: "Unrequested conversion" },
          state: "input-available",
          toolCallId: "write",
          type: "tool-write",
        },
        {
          input: { memory: "Internal memory" },
          output: { success: true },
          state: "output-available",
          toolCallId: "memory",
          type: "tool-updateWorkingMemory",
        },
      ],
      role: "assistant",
    },
  ]);
  expect(context).toHaveLength(1);
  expect(context[0]?.content).toContain("Actual searched evidence");
  expect(context[0]?.content).toContain("https://example.com/evidence");
  expect(JSON.stringify(context)).not.toMatch(
    /Unrequested conversion|Internal memory|agentPrompt/,
  );
});
