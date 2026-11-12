// @vitest-environment jsdom
import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act, StrictMode, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useChatBranches } from "./use-chat-branches";

const api = vi.hoisted(() => ({
  branch: vi.fn(),
  create: vi.fn(),
  history: vi.fn(),
}));
vi.mock("~/trpc/react", () => {
  const client = {
    chat: {
      branch: { mutate: api.branch },
      create: { mutate: api.create },
      history: { query: api.history },
    },
  };
  return { useTRPCClient: () => client };
});
let chat: Chat<UIMessage>;
let current: ReturnType<typeof useChatBranches>;
let root: Root;
let host: HTMLDivElement;
function Harness() {
  const thread = useRef("journl:owner");
  current = useChatBranches(chat, "owner", thread);
  return <p>{current.threadId}</p>;
}
async function mount() {
  await act(async () => root.render(<Harness />));
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  vi.clearAllMocks();
  chat = new Chat<UIMessage>({ messages: [] });
  api.create.mockResolvedValue({
    hasMore: false,
    messages: [],
    threadId: "journl:owner",
    title: "New chat",
  });
  api.history.mockResolvedValue({ messages: [], threadId: "journl:owner" });
  api.branch.mockResolvedValue({
    messages: [],
    threadId: "branch",
    title: "Edited: prompt",
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

test("always starts fresh even when the tab has a previously selected chat", async () => {
  sessionStorage.setItem("journl:active-chat:owner", "saved-branch");
  await mount();
  expect(api.history).not.toHaveBeenCalled();
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(current.ready).toBe(true);
  expect(chat.messages).toEqual([]);
});

test("failed creation keeps sending disabled and supports an explicit retry", async () => {
  api.create.mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(current.ready).toBe(false);
  expect(current.error).toContain("Could not start");
  await act(async () => current.retryStart());
  expect(current.ready).toBe(true);
  expect(current.error).toBeNull();
  expect(api.history).not.toHaveBeenCalled();
});

test("a failed branch request preserves active messages and shows its error", async () => {
  await mount();
  const original = [
    {
      id: "u1",
      parts: [{ text: "Original prompt", type: "text" as const }],
      role: "user" as const,
    },
  ];
  chat.messages = original;
  api.branch.mockRejectedValueOnce(new Error("This message is not saved yet."));
  await act(async () => {
    await expect(current.editMessage("u1", "Changed")).rejects.toThrow(
      "not saved",
    );
  });
  expect(chat.messages).toEqual(original);
  expect(current.threadId).toBe("journl:owner");
  expect(current.error).toContain("not saved");
});

test("activates remapped history before generating and does not pass obsolete message IDs", async () => {
  await mount();
  chat.messages = [
    {
      id: "old-user",
      parts: [{ text: "Original prompt", type: "text" }],
      role: "user",
    },
    {
      id: "old-answer",
      parts: [{ text: "Old answer", type: "text" }],
      role: "assistant",
    },
  ];
  const generate = vi.spyOn(chat, "regenerate").mockImplementation(async () => {
    expect(chat.messages.at(-1)?.id).toBe("cloned-user");
  });
  api.branch.mockResolvedValue({
    messages: [
      {
        id: "cloned-user",
        parts: [{ text: "Original prompt", type: "text" }],
        role: "user",
      },
    ],
    threadId: "retry-branch",
    title: "Retry: prompt",
  });
  await act(async () => current.retryResponse({ messageId: "old-answer" }));
  expect(api.branch).toHaveBeenCalledExactlyOnceWith({
    kind: "retry",
    messageId: "old-user",
    pendingPrompt: { previousMessageId: undefined, text: "Original prompt" },
    threadId: "journl:owner",
  });
  expect(generate).toHaveBeenCalledExactlyOnceWith();
});

test("an edited prompt is a new SDK message on its branch", async () => {
  await mount();
  const send = vi.spyOn(chat, "sendMessage").mockResolvedValue(undefined);
  await act(async () => current.editMessage("old-user", "Revised prompt"));
  expect(send).toHaveBeenCalledExactlyOnceWith({ text: "Revised prompt" });
  expect(current.threadId).toBe("branch");
});

test("does not fork during generation", async () => {
  await mount();
  vi.spyOn(chat, "status", "get").mockReturnValue("streaming");
  await act(async () => current.editMessage("old-user", "Changed"));
  expect(api.branch).not.toHaveBeenCalled();
});

test("first load creates a fresh chat and does not open account-wide history", async () => {
  sessionStorage.setItem("journl:chat-thread:owner", "journl:owner");
  api.create.mockResolvedValue({
    hasMore: false,
    messages: [],
    threadId: "fresh-chat",
    title: "New chat",
  });
  await mount();
  expect(api.history).not.toHaveBeenCalled();
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(current.threadId).toBe("fresh-chat");
  expect(chat.messages).toEqual([]);
});

test("startup retry cannot replace an active conversation", async () => {
  await mount();
  const original = [
    {
      id: "old",
      parts: [{ text: "An existing prompt", type: "text" as const }],
      role: "user" as const,
    },
  ];
  chat.messages = original;
  await act(async () => current.retryStart());
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(chat.messages).toEqual(original);
});

test("StrictMode creates only one initial native chat", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    ),
  );
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(current.ready).toBe(true);
});
