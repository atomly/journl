// @vitest-environment jsdom
import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useChatUnread } from "./use-chat-unread";

const fixture = vi.hoisted(() => ({
  chat: null as Chat<UIMessage> | null,
  ready: false,
}));
vi.mock("~/hooks/use-journl-chat", () => ({
  useJournlChat: () => ({
    chat: fixture.chat,
    conversations: { ready: fixture.ready },
  }),
}));
let root: Root;
let host: HTMLDivElement;
function Harness({ open = false }: { open?: boolean }) {
  const { hasUnreadMessages } = useChatUnread(open);
  return <p>{hasUnreadMessages ? "Unread" : "Read"}</p>;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.chat = new Chat<UIMessage>({ messages: [] });
  fixture.ready = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const reply = (id: string): UIMessage => ({
  id,
  parts: [{ text: "A reply", type: "text" }],
  role: "assistant",
});

test("restored replies stay read, and new replies in a closed chat become unread", async () => {
  await act(async () => root.render(<Harness />));
  await act(async () => {
    if (fixture.chat) fixture.chat.messages = [reply("stored")];
  });
  fixture.ready = true;
  await act(async () => root.render(<Harness />));
  expect(host.textContent).toBe("Read");
  await act(async () => {
    if (fixture.chat)
      fixture.chat.messages = [...fixture.chat.messages, reply("incoming")];
  });
  expect(host.textContent).toBe("Unread");
  await act(async () => root.render(<Harness open />));
  expect(host.textContent).toBe("Read");
});

test("history and readiness restored in the same render do not mark old replies unread", async () => {
  await act(async () => root.render(<Harness />));
  await act(async () => {
    fixture.ready = true;
    if (fixture.chat)
      fixture.chat.messages = [reply("stored-1"), reply("stored-2")];
    root.render(<Harness />);
  });
  expect(host.textContent).toBe("Read");
});
