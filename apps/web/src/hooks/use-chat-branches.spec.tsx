// @vitest-environment jsdom
import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useChatBranches } from "./use-chat-branches";

const api = vi.hoisted(() => ({
  branch: vi.fn(),
  history: vi.fn(),
  list: vi.fn(),
}));
vi.mock("~/trpc/react", () => {
  const client = {
    chat: {
      branch: { mutate: api.branch },
      history: { query: api.history },
      list: { query: api.list },
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
  api.list.mockResolvedValue([
    { id: "journl:owner", title: "Original conversation" },
  ]);
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

test("loads the saved branch before allowing a send and restores it from owner-scoped tab storage", async () => {
  sessionStorage.setItem("journl:chat-thread:owner", "saved-branch");
  const saved = [
    {
      id: "saved",
      parts: [{ text: "Saved prompt", type: "text" as const }],
      role: "user" as const,
    },
  ];
  api.history.mockResolvedValue({ messages: saved, threadId: "saved-branch" });
  await mount();
  expect(api.history).toHaveBeenCalledWith({ threadId: "saved-branch" });
  expect(current.ready).toBe(true);
  expect(current.loading).toBe(false);
  expect(chat.messages).toEqual(saved);
});

test("failed history loading keeps sending disabled and supports an explicit retry", async () => {
  api.history.mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(current.ready).toBe(false);
  expect(current.error).toContain("Could not load");
  await act(async () => current.select("journl:owner"));
  expect(current.ready).toBe(true);
  expect(current.error).toBeNull();
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
    expect(sessionStorage.getItem("journl:chat-thread:owner")).toBe(
      "retry-branch",
    );
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

test("does not switch branches during a native generation or an outstanding history request", async () => {
  await mount();
  const status = vi.spyOn(chat, "status", "get").mockReturnValue("streaming");
  api.history.mockClear();
  await act(async () => current.select("other"));
  expect(api.history).not.toHaveBeenCalled();
  status.mockRestore();
  let finish!: (value: { messages: []; threadId: string }) => void;
  api.history.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let switching: Promise<void>;
  await act(async () => {
    switching = current.select("other");
  });
  await act(async () => current.editMessage("old-user", "Changed"));
  expect(api.branch).not.toHaveBeenCalled();
  await act(async () => {
    finish({ messages: [], threadId: "other" });
    await switching;
  });
  expect(current.threadId).toBe("other");
});
