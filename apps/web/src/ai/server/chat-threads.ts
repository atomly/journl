import { randomUUID } from "node:crypto";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import type { MastraDBMessage } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";

import { getChatRootThreadId } from "../chat-thread";

export class ChatThreadError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "BAD_REQUEST",
    message: string,
  ) {
    super(message);
    this.name = "ChatThreadError";
  }
}

/** All history reads and clones pass through the same authenticated boundary. */
export async function requireChatThread(
  memory: Memory,
  owner: string,
  threadId: string,
) {
  const thread = await memory.getThreadById({ threadId });
  const root = getChatRootThreadId(owner);
  if (
    !thread ||
    thread.resourceId !== owner ||
    (threadId !== root && thread.metadata?.chatRoot !== root)
  ) {
    throw new ChatThreadError("NOT_FOUND", "Conversation not found.");
  }
  return thread;
}

async function recallChat(memory: Memory, owner: string, threadId: string) {
  return memory.recall({
    hideSignals: true,
    orderBy: { direction: "ASC", field: "createdAt" },
    perPage: false,
    resourceId: owner,
    threadId,
  });
}

export async function createChatThread(memory: Memory, owner: string) {
  const thread = await memory.createThread({
    metadata: { chatRoot: getChatRootThreadId(owner), kind: "conversation" },
    resourceId: owner,
    title: `Chat · ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
  });
  return {
    hasMore: false,
    messages: [],
    threadId: thread.id,
    title: thread.title || "New chat",
  };
}

export async function readChatThread(
  memory: Memory,
  owner: string,
  threadId: string,
  page = 0,
) {
  // The original conversation does not exist until its first message is sent.
  if (
    threadId === getChatRootThreadId(owner) &&
    !(await memory.getThreadById({ threadId }))
  ) {
    return { hasMore: false, messages: [], threadId };
  }
  await requireChatThread(memory, owner, threadId);
  const { messages, hasMore } = await memory.recall({
    hideSignals: true,
    orderBy: { direction: "DESC", field: "createdAt" },
    page,
    perPage: 40,
    resourceId: owner,
    threadId,
  });
  messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    hasMore,
    messages: toAISdkMessages(messages, { version: "v7" }),
    threadId,
  };
}

export async function branchChatThread(
  memory: Memory,
  owner: string,
  input: {
    threadId: string;
    messageId: string;
    kind: "edit" | "retry";
    pendingPrompt?: { text: string; previousMessageId?: string };
  },
) {
  const source = await memory.getThreadById({ threadId: input.threadId });
  const unsavedRoot =
    !source &&
    input.threadId === getChatRootThreadId(owner) &&
    input.pendingPrompt;
  if (!unsavedRoot) await requireChatThread(memory, owner, input.threadId);
  const { messages } = source
    ? await recallChat(memory, owner, input.threadId)
    : { messages: [] };
  const pivot = messages.findIndex((message) => message.id === input.messageId);
  let prefix: MastraDBMessage[];
  let prompt: string;
  let pendingText: string | undefined;
  if (pivot < 0) {
    // A transport failure can leave a prompt only in AI SDK state. Its previous
    // saved message anchors the prefix; never infer it from the latest server turn.
    const pending = input.pendingPrompt;
    const previous = pending?.previousMessageId;
    const previousIndex = previous
      ? messages.findIndex((message) => message.id === previous)
      : -1;
    if (!pending || (previous && previousIndex < 0)) {
      throw new ChatThreadError(
        "BAD_REQUEST",
        "This message is not saved yet. Reload the conversation and retry.",
      );
    }
    prefix = previous ? messages.slice(0, previousIndex + 1) : [];
    prompt = pending.text;
    if (input.kind === "retry") pendingText = pending.text;
  } else {
    let userIndex = pivot;
    if (input.kind === "edit" && messages[pivot]?.role !== "user") {
      throw new ChatThreadError(
        "BAD_REQUEST",
        "Only user messages can be edited.",
      );
    }
    while (userIndex >= 0 && messages[userIndex]?.role !== "user")
      userIndex -= 1;
    const userMessage = messages[userIndex];
    if (!userMessage || userIndex < 0)
      throw new ChatThreadError(
        "BAD_REQUEST",
        "No prompt was found for this response.",
      );
    prefix = messages.slice(
      0,
      input.kind === "edit" ? userIndex : userIndex + 1,
    );
    prompt = toAISdkMessages([userMessage], { version: "v7" })
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }
  const title = `${input.kind === "edit" ? "Edited" : "Retry"}: ${prompt.slice(0, 60)}`;
  const metadata = {
    chatRoot: getChatRootThreadId(owner),
    kind: input.kind,
    pivotMessageId: input.messageId,
    sourceThreadId: input.threadId,
  };
  // An empty native clone filter means "all messages". Create an empty thread
  // for a first-prompt edit so no discarded response enters the new history.
  const thread = prefix.length
    ? (
        await memory.cloneThread({
          metadata,
          options: {
            messageFilter: { messageIds: prefix.map((message) => message.id) },
          },
          resourceId: owner,
          sourceThreadId: input.threadId,
          title,
        })
      ).thread
    : await memory.createThread({ metadata, resourceId: owner, title });
  if (pendingText !== undefined) {
    await memory.saveMessages({
      messages: [
        {
          content: { format: 2, parts: [{ text: pendingText, type: "text" }] },
          createdAt: new Date(),
          id: randomUUID(),
          resourceId: owner,
          role: "user",
          threadId: thread.id,
          type: "text",
        },
      ],
    });
  }
  return { ...(await readChatThread(memory, owner, thread.id)), title };
}
