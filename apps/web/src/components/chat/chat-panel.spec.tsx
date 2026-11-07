// @vitest-environment jsdom
import type { UIMessage } from "ai";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  messages: [] as UIMessage[],
  status: "submitted",
}));
vi.mock("./chat-presentation", () => ({
  useChatPresentation: () => fixture,
}));
vi.mock("./conversations", () => ({ ChatConversations: () => null }));
vi.mock("./composer", () => ({ ChatComposer: () => null }));
vi.mock("./message", () => ({ ChatMessage: () => null }));
vi.mock("@acme/ui/message-scroller", () => {
  const Container = ({ children }: { children?: ReactNode }) => children;
  return {
    MessageScroller: Container,
    MessageScrollerButton: () => null,
    MessageScrollerContent: Container,
    MessageScrollerItem: Container,
    MessageScrollerProvider: Container,
    MessageScrollerViewport: Container,
  };
});

import { ChatPanel } from "./chat-panel";

test("thinking survives an empty assistant message and completed intermediate steps, then ends with the request", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = () =>
    act(async () => root.render(<ChatPanel welcome={null} />));
  try {
    fixture.messages = [
      { id: "user", parts: [{ text: "Write", type: "text" }], role: "user" },
    ];
    fixture.status = "submitted";
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Thinking");
    fixture.messages.push({
      id: "assistant",
      parts: [{ type: "step-start" }],
      role: "assistant",
    });
    fixture.status = "streaming";
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Thinking");
    fixture.messages[1] = {
      id: "assistant",
      parts: [{ state: "done", text: "Read the note", type: "reasoning" }],
      role: "assistant",
    };
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Thinking");
    fixture.messages[1] = {
      id: "assistant",
      parts: [{ state: "streaming", text: "Writing now", type: "text" }],
      role: "assistant",
    };
    await render();
    expect(host.querySelector('[role="status"]')).toBeNull();
    fixture.messages[1] = { id: "assistant", parts: [], role: "assistant" };
    fixture.status = "ready";
    await render();
    expect(host.querySelector('[role="status"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
