import { describe, expect, it } from "vitest";
import { InvalidChatRequest, parseJournlChatRequest } from "./chat-request";

const request = {
  context: {
    activeEditors: ["page:my-page"],
    currentDate: "2026-11-05",
    highlightedText: ["A passage"],
    reasoning: "thinking",
    view: { id: "my-page", name: "page", title: "My page" },
  },
  messages: [
    {
      id: "m1",
      parts: [{ text: "Find my notes", type: "text" }],
      role: "user",
    },
  ],
};

describe("chat request boundary", () => {
  it("retains SDK messages and consumer context while discarding execution overrides", async () => {
    const result = await parseJournlChatRequest({
      ...request,
      agentId: "other-agent",
      context: { ...request.context, user: { name: "Impersonated" } },
      maxSteps: 999,
      memory: { resource: "another-user", thread: "another-thread" },
    });
    expect(result).toEqual(request);
    expect(result.context).not.toHaveProperty("user");
  });

  it("preserves completed client tool messages for automatic continuations", async () => {
    const message = {
      id: "m2",
      parts: [
        {
          input: { title: "New page" },
          output: { targetEditor: "page:new" },
          state: "output-available",
          toolCallId: "call1",
          type: "tool-createPage",
        },
      ],
      role: "assistant",
    };
    const result = await parseJournlChatRequest({
      ...request,
      messages: [...request.messages, message],
      trigger: "submit-message",
    });
    expect(result.messages.at(-1)).toEqual(message);
    expect(result.trigger).toBe("submit-message");
  });

  it.each([
    null,
    { ...request, messages: [] },
    { ...request, messages: [{ parts: "invalid", role: "user" }] },
    { ...request, context: { ...request.context, reasoning: "invalid" } },
    { ...request, context: { ...request.context, activeEditors: ["invalid"] } },
    { ...request, trigger: "unknown" },
  ])("rejects malformed input before creating a run", async (body) => {
    await expect(parseJournlChatRequest(body)).rejects.toBeInstanceOf(
      InvalidChatRequest,
    );
  });
});
