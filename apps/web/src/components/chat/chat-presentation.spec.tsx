// @vitest-environment jsdom
import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ChatPresentationProvider,
  useChatActions,
  useChatPresentation,
  useComposerDraft,
} from "./chat-presentation";

const fixture = vi.hoisted(() => ({
  actions: 0,
  chat: null as Chat<UIMessage> | null,
  drafts: 0,
  editMessage: vi.fn(),
  retryResponse: vi.fn(),
  states: 0,
}));
vi.mock("~/hooks/use-journl-chat", () => ({
  useJournlChat: () => ({
    chat: fixture.chat,
    conversations: {
      editMessage: fixture.editMessage,
      loading: false,
      ready: true,
      retryResponse: fixture.retryResponse,
    },
  }),
}));
function Transcript() {
  const { messages } = useChatPresentation();
  fixture.states++;
  return <p>{messages.length} messages</p>;
}
function Actions() {
  const { status } = useChatActions();
  fixture.actions++;
  return <p>{status}</p>;
}
function Draft() {
  const { draft, setDraft } = useComposerDraft();
  fixture.drafts++;
  return (
    <button type="button" onClick={() => setDraft("New draft")}>
      {draft || "Type"}
    </button>
  );
}
let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.chat = new Chat<UIMessage>({ messages: [] });
  fixture.states = fixture.actions = fixture.drafts = 0;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <ChatPresentationProvider>
        <Transcript />
        <Actions />
        <Draft />
      </ChatPresentationProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
test("typing a shared composer draft does not rerender the transcript or actions", async () => {
  const before = { actions: fixture.actions, states: fixture.states };
  await act(async () => host.querySelector("button")?.click());
  expect(host.textContent).toContain("New draft");
  expect(fixture.states).toBe(before.states);
  expect(fixture.actions).toBe(before.actions);
});
test("native message updates do not rerender composer draft or stable actions", async () => {
  const before = { actions: fixture.actions, drafts: fixture.drafts };
  await act(async () => {
    if (fixture.chat)
      fixture.chat.messages = [
        {
          id: "assistant",
          parts: [{ state: "done", text: "Streaming text", type: "text" }],
          role: "assistant",
        },
      ];
  });
  expect(host.textContent).toContain("1 messages");
  expect(fixture.drafts).toBe(before.drafts);
  expect(fixture.actions).toBe(before.actions);
});
