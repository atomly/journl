// @vitest-environment jsdom
import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useWriteTool } from "./client";

const fixture = vi.hoisted(() => {
  const run = vi.fn();
  return { active: true, entry: { id: "page:one", session: { run } }, run };
});
vi.mock("~/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({
    getEditors: () =>
      fixture.active ? new Map([["page:one", fixture.entry]]) : new Map(),
    getEditTarget: () => fixture.entry,
  }),
}));

test("a writing tool completes through the real SDK message queue without deadlocking", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.run.mockResolvedValue({ message: "Applied", status: "applied" });
  let tool: ReturnType<typeof useWriteTool> | undefined;
  function MountTool() {
    tool = useWriteTool();
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<MountTool />));
  const chat = new Chat<UIMessage>({
    onToolCall: async ({ toolCall }) => {
      await tool?.execute(toolCall, chat);
    },
    transport: {
      reconnectToStream: async () => null,
      sendMessages: async () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue({ messageId: "assistant", type: "start" });
            controller.enqueue({ type: "start-step" });
            controller.enqueue({
              input: {
                agentPrompt: "Rewrite the paragraph",
                reasoningEffort: "low",
              },
              toolCallId: "write-one",
              toolName: "write",
              type: "tool-input-available",
            });
            controller.enqueue({ type: "finish-step" });
            controller.enqueue({ finishReason: "tool-calls", type: "finish" });
            controller.close();
          },
        }),
    },
  });
  try {
    await chat.sendMessage({ text: "Rewrite this paragraph" });
    expect(chat.status).toBe("ready");
    expect(chat.lastMessage?.parts).toContainEqual(
      expect.objectContaining({
        output: { message: "Applied", status: "applied" },
        state: "output-available",
        toolCallId: "write-one",
        type: "tool-write",
      }),
    );
    expect(fixture.run).toHaveBeenCalledExactlyOnceWith({
      instruction: "Rewrite the paragraph",
      reasoningEffort: "low",
    });
  } finally {
    await chat.stop();
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

test("a stale captured target is rejected instead of writing in the newly active document", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.active = false;
  fixture.run.mockClear();
  let tool: ReturnType<typeof useWriteTool> | undefined;
  function Mount() {
    tool = useWriteTool();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Mount />));
  const chat = new Chat<UIMessage>({});
  const output = vi.spyOn(chat, "addToolOutput").mockResolvedValue();
  try {
    await tool?.execute(
      {
        input: { agentPrompt: "Rewrite this" },
        toolCallId: "stale",
        toolName: "write",
      },
      chat,
    );
    expect(fixture.run).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ status: "error" }),
      }),
    );
  } finally {
    fixture.active = true;
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
