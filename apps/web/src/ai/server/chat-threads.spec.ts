import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getChatRootThreadId } from "../chat-thread";
import {
  branchChatThread,
  createChatThread,
  readChatThread,
  requireChatThread,
} from "./chat-threads";

let memory: Memory;
let store: LibSQLStore;
const owner = "history-owner";
const root = getChatRootThreadId(owner);
const text = (
  messages: Awaited<ReturnType<typeof readChatThread>>["messages"],
) =>
  messages.map((message) =>
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" "),
  );

beforeEach(async () => {
  store = new LibSQLStore({ id: crypto.randomUUID(), url: ":memory:" });
  memory = new Memory({
    options: {
      generateTitle: false,
      semanticRecall: false,
      workingMemory: { enabled: false },
    },
    storage: store,
  });
  await memory.createThread({ resourceId: owner, threadId: root });
  await memory.saveMessages({
    messages: [
      "First prompt",
      "First answer",
      "Second prompt",
      "Second answer",
      "Later prompt",
      "Later answer",
    ].map((value, index) => ({
      content: {
        format: 2 as const,
        parts: [{ text: value, type: "text" as const }],
      },
      createdAt: new Date(1700000000000 + index),
      id: `m${index}`,
      resourceId: owner,
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      threadId: root,
      type: "text" as const,
    })),
  });
});
afterEach(async () => store.close());
async function ownedThreads(resourceId = owner) {
  return (await memory.listThreads({ filter: { resourceId }, perPage: false }))
    .threads;
}

describe("native Mastra conversation branches", () => {
  it("edits an earlier prompt with only preceding history and leaves the source intact", async () => {
    const before = await readChatThread(memory, owner, root);
    const branch = await branchChatThread(memory, owner, {
      kind: "edit",
      messageId: "m2",
      threadId: root,
    });
    expect(text(branch.messages)).toEqual(["First prompt", "First answer"]);
    expect(branch.messages.map((message) => message.id)).not.toEqual([
      "m0",
      "m1",
    ]);
    expect(await readChatThread(memory, owner, root)).toEqual(before);
    expect(await readChatThread(memory, owner, branch.threadId)).toEqual({
      hasMore: false,
      messages: branch.messages,
      threadId: branch.threadId,
    });
  });
  it("creates an empty branch when the first prompt is edited", async () => {
    const branch = await branchChatThread(memory, owner, {
      kind: "edit",
      messageId: "m0",
      threadId: root,
    });
    expect(branch.messages).toEqual([]);
    expect(
      (await readChatThread(memory, owner, branch.threadId)).messages,
    ).toEqual([]);
    expect((await readChatThread(memory, owner, root)).messages).toHaveLength(
      6,
    );
  });
  it.each(["m2", "m3"])(
    "retries from the user prompt for %s, excluding the old answer and later turns",
    async (messageId) => {
      const branch = await branchChatThread(memory, owner, {
        kind: "retry",
        messageId,
        threadId: root,
      });
      expect(text(branch.messages)).toEqual([
        "First prompt",
        "First answer",
        "Second prompt",
      ]);
      expect(branch.messages.at(-1)?.role).toBe("user");
      const next = await branchChatThread(memory, owner, {
        kind: "edit",
        messageId: branch.messages.at(-1)?.id ?? "",
        threadId: branch.threadId,
      });
      expect(text(next.messages)).toEqual(["First prompt", "First answer"]);
      expect((await ownedThreads()).map((thread) => thread.id)).toEqual(
        expect.arrayContaining([root, branch.threadId, next.threadId]),
      );
    },
  );
  it("does not read, clone or continue another owner's thread", async () => {
    const before = await ownedThreads();
    await expect(
      readChatThread(memory, "intruder", root),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      branchChatThread(memory, "intruder", {
        kind: "edit",
        messageId: "m0",
        threadId: root,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      requireChatThread(memory, "intruder", root),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await ownedThreads()).toEqual(before);
    expect(await ownedThreads("intruder")).toEqual([]);
  });
  it("rejects unrelated owned threads and unknown pivots before creating a branch", async () => {
    await memory.createThread({ resourceId: owner, threadId: "unrelated" });
    await expect(
      requireChatThread(memory, owner, "unrelated"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const input of [
      { kind: "edit" as const, messageId: "missing" },
      { kind: "edit" as const, messageId: "m1" },
    ]) {
      await expect(
        branchChatThread(memory, owner, { ...input, threadId: root }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(await ownedThreads()).toHaveLength(2);
  });
  it("returns empty history only for the authenticated owner's new original conversation", async () => {
    expect(
      await readChatThread(
        memory,
        "new-owner",
        getChatRootThreadId("new-owner"),
      ),
    ).toMatchObject({ messages: [] });
    await expect(
      readChatThread(memory, owner, "missing"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

it("recovers a first prompt that never reached Mastra in a new native branch", async () => {
  const pendingOwner = "pending-owner";
  const sourceId = getChatRootThreadId(pendingOwner);
  const branch = await branchChatThread(memory, pendingOwner, {
    kind: "retry",
    messageId: "unsaved-user",
    pendingPrompt: { text: "Retry this unsaved prompt" },
    threadId: sourceId,
  });
  expect(text(branch.messages)).toEqual(["Retry this unsaved prompt"]);
  expect(branch.messages[0]?.id).not.toBe("unsaved-user");
  expect(
    (await readChatThread(memory, pendingOwner, sourceId)).messages,
  ).toEqual([]);
});
it("anchors an unsaved prompt before newer source turns without copying those turns", async () => {
  const before = await readChatThread(memory, owner, root);
  const branch = await branchChatThread(memory, owner, {
    kind: "retry",
    messageId: "unsaved-user",
    pendingPrompt: { previousMessageId: "m1", text: "Unsaved follow-up" },
    threadId: root,
  });
  expect(text(branch.messages)).toEqual([
    "First prompt",
    "First answer",
    "Unsaved follow-up",
  ]);
  expect(await readChatThread(memory, owner, root)).toEqual(before);
  await expect(
    branchChatThread(memory, owner, {
      kind: "retry",
      messageId: "unsaved-user",
      pendingPrompt: { previousMessageId: "missing", text: "Unsaved" },
      threadId: root,
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("uses the saved prompt when a caller supplies different pending text", async () => {
  const branch = await branchChatThread(memory, owner, {
    kind: "retry",
    messageId: "m2",
    pendingPrompt: { text: "Replacement must not overwrite saved text" },
    threadId: root,
  });
  expect(text(branch.messages)).toEqual([
    "First prompt",
    "First answer",
    "Second prompt",
  ]);
});

it("retains completed tool output and reasoning in the copied prefix", async () => {
  await memory.saveMessages({
    messages: [
      {
        content: {
          format: 2,
          parts: [
            {
              details: [],
              reasoning: "A saved reasoning step",
              type: "reasoning",
            },
            {
              toolInvocation: {
                args: { id: "page-1" },
                result: { message: "Opened page" },
                state: "result",
                toolCallId: "saved-tool-call",
                toolName: "navigatePage",
              },
              type: "tool-invocation",
            },
            { text: "First answer", type: "text" },
          ],
        },
        createdAt: new Date(1700000000001),
        id: "m1",
        resourceId: owner,
        role: "assistant",
        threadId: root,
        type: "text",
      },
    ],
  });
  const before = await readChatThread(memory, owner, root);
  const branch = await branchChatThread(memory, owner, {
    kind: "edit",
    messageId: "m2",
    threadId: root,
  });
  expect(branch.messages[1]?.parts).toEqual(before.messages[1]?.parts);
  expect(branch.messages[1]?.parts).toContainEqual(
    expect.objectContaining({
      state: "output-available",
      toolCallId: "saved-tool-call",
      type: "tool-navigatePage",
    }),
  );
  expect(await readChatThread(memory, owner, root)).toEqual(before);
});

it("starts an independent empty chat without touching legacy account history", async () => {
  const before = await readChatThread(memory, owner, root);
  const chat = await createChatThread(memory, owner);
  expect(chat.threadId).not.toBe(root);
  expect(chat.messages).toEqual([]);
  expect(chat.hasMore).toBe(false);
  await requireChatThread(memory, owner, chat.threadId);
  expect(await readChatThread(memory, owner, root)).toEqual(before);
});

it("reads history in bounded pages while keeping earlier messages accessible", async () => {
  await memory.saveMessages({
    messages: Array.from({ length: 80 }, (_, index) => ({
      content: {
        format: 2 as const,
        parts: [{ text: `Paged ${index}`, type: "text" as const }],
      },
      createdAt: new Date(1800000000000 + index),
      id: `paged-${index}`,
      resourceId: owner,
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      threadId: root,
      type: "text" as const,
    })),
  });
  const latest = await readChatThread(memory, owner, root);
  expect(latest.messages).toHaveLength(40);
  expect(text(latest.messages)[0]).toBe("Paged 40");
  expect(text(latest.messages).at(-1)).toBe("Paged 79");
  expect(latest.hasMore).toBe(true);
  const older = await readChatThread(memory, owner, root, 1);
  expect(text(older.messages)[0]).toBe("Paged 0");
  expect(older.hasMore).toBe(true);
  const oldest = await readChatThread(memory, owner, root, 2);
  expect(oldest.messages).toHaveLength(6);
  expect(oldest.hasMore).toBe(false);
});

it("shares high-level user memory with a fresh chat without importing its transcript", async () => {
  const shared = new Memory({
    options: {
      generateTitle: false,
      semanticRecall: false,
      workingMemory: { enabled: true, scope: "resource" },
    },
    storage: store,
  });
  await shared.updateWorkingMemory({
    resourceId: owner,
    threadId: root,
    workingMemory: "Prefers concise answers and vegetarian recipes.",
  });
  const fresh = await createChatThread(shared, owner);
  expect(fresh.messages).toEqual([]);
  expect(
    await shared.getWorkingMemory({
      resourceId: owner,
      threadId: fresh.threadId,
    }),
  ).toBe("Prefers concise answers and vegetarian recipes.");
  expect(
    await shared.getWorkingMemory({
      resourceId: "other-owner",
      threadId: fresh.threadId,
    }),
  ).not.toBe("Prefers concise answers and vegetarian recipes.");
});
